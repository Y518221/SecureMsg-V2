import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// Rate limiting and request queue
let requestQueue: (() => Promise<any>)[] = [];
let isProcessingQueue = false;
const RATE_LIMIT_DELAY_MS = 4000; // 1 request per 4 seconds = 15 requests/minute

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      try {
        await request();
      } catch (error) {
        console.error("[BOT] Queue processing error:", error);
      }
      // Wait before next request to respect rate limits
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }
  }
  isProcessingQueue = false;
}

function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    processQueue();
  });
}

// Exponential backoff retry logic
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimitError = error?.status === 429 || /quota|rate limit/i.test(error?.message);
      
      if (!isRateLimitError && attempt === 0) {
        // Not a rate limit error, don't retry
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s, 16s
        console.log(`[BOT] Rate limited, retrying after ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
}

type BotKnowledge = {
  version: string;
  bot?: {
    name?: string;
    source_of_truth?: string;
  };
  source_of_truth?: string;
  topics: string[];
  fallbacks: {
    empty_input: string;
    unknown: string;
    low_confidence?: string;
  };
  safety: {
    blocked_requests: string[];
    refusal_template: string;
  };
  intents?: BotIntent[];
};

type BotIntent = {
  id: string;
  keywords?: string[];
  reply?: {
    short?: string;
    detailed?: string;
  };
};

const FALLBACK_KNOWLEDGE: BotKnowledge = {
  version: "fallback",
  bot: {
    name: "Support Bot",
    source_of_truth: "README.md",
  },
  topics: [],
  fallbacks: {
    empty_input: "Tell me what you need help with and I will guide you step by step.",
    unknown: "I can help with security, groups, messages, files, unread badges, and account issues. Ask me a specific problem.",
  },
  safety: {
    blocked_requests: [
      "password reset",
      "account takeover",
      "encryption key",
      "secret",
      "bypass",
      "legal advice",
      "environment variables"
    ],
    refusal_template:
      "I cannot help with that request. I can explain supported SecureMsg features and safe troubleshooting steps.",
  },
};

const ENABLE_GEMINI_BOT = process.env.ENABLE_GEMINI_BOT !== "false";
const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

function loadKnowledge(): BotKnowledge {
  try {
    const filePath = path.join(process.cwd(), "server", "data", "bot-knowledge.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as BotKnowledge;
    return parsed || FALLBACK_KNOWLEDGE;
  } catch {
    return FALLBACK_KNOWLEDGE;
  }
}

function buildSystemPrompt(knowledge: BotKnowledge): string {
  return `You are SecureMsg Support Bot, a helpful and friendly assistant that answers questions about SecureMsg - a secure messaging application.

IMPORTANT GUIDELINES:
1. You ONLY provide information about SecureMsg features, security, and troubleshooting
2. You are helpful, friendly, and security-conscious
3. Keep answers concise but thorough, and always finish the final sentence
4. Safe account/contact questions are allowed. If a user asks how to find a client, user, account, or contact, explain SecureMsg's supported lookup flow: search/add by Secure ID, then start an encrypted chat after the session is unlocked.
5. Refuse only clearly unsafe requests to take over, impersonate, hack, bypass security/RLS, reveal secrets/API keys, or extract private encryption material. Use this refusal: "${knowledge.safety.refusal_template}"
6. If you don't know the answer, suggest checking the README or official documentation
7. Never guess or make up features - only describe what's actually in SecureMsg
8. Supported topics: ${knowledge.topics.join(", ")}

Answer helpfully and accurately. Stay focused on SecureMsg support. Use at most 4 short bullets when listing details.`;
}

function findKnowledgeReply(knowledge: BotKnowledge, userText: string) {
  const normalized = userText.toLowerCase();
  const intent = knowledge.intents?.find((candidate) =>
    candidate.keywords?.some((keyword) => matchesKeyword(normalized, keyword))
  );

  if (!intent?.reply) return null;

  return [intent.reply.short, intent.reply.detailed]
    .filter(Boolean)
    .join(" ");
}

function matchesKeyword(normalizedText: string, keyword: string) {
  const normalizedKeyword = keyword.toLowerCase();
  if (normalizedText.includes(normalizedKeyword)) return true;

  const keywordTerms = normalizedKeyword
    .split(/\W+/)
    .filter((term) => term.length > 2);

  return keywordTerms.length > 0 && keywordTerms.every((term) => normalizedText.includes(term));
}

function getSafeFallback(knowledge: BotKnowledge, userText: string) {
  const normalized = userText.toLowerCase();

  if (
    normalized.includes("securemsg") ||
    normalized.includes("privacy") ||
    normalized.includes("protect") ||
    normalized.includes("data") ||
    normalized.includes("message")
  ) {
    return "SecureMsg protects conversations by encrypting message content in the client before it is sent. The server stores encrypted payloads, while session passwords and derived keys stay in browser memory and are not stored on the server.";
  }

  return knowledge.fallbacks.low_confidence || knowledge.fallbacks.unknown;
}

function getCandidateModels() {
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const models = configuredModel
    ? [configuredModel, ...DEFAULT_GEMINI_MODELS]
    : DEFAULT_GEMINI_MODELS;

  return Array.from(new Set(models)).filter((model) => {
    if (/^gemini-1\.5-/i.test(model)) {
      console.warn(`[BOT] Skipping unsupported Gemini 1.5 model from config: ${model}`);
      return false;
    }
    return true;
  });
}

function isBlockedRequest(knowledge: BotKnowledge, userText: string) {
  const normalized = userText.toLowerCase();
  const blockedPhrases = knowledge.safety.blocked_requests.map((term) => term.toLowerCase());

  return blockedPhrases.some((phrase) => {
    if (normalized.includes(phrase)) return true;

    if (phrase.includes("account takeover") || phrase.includes("impersonation")) {
      return /\b(take\s*over|impersonat(e|ion)|hack|steal)\b/.test(normalized) &&
        /\b(account|user|client)\b/.test(normalized);
    }

    if (phrase.includes("bypass")) {
      return /\b(bypass|disable|evade)\b/.test(normalized) &&
        /\b(security|rls|policy|permission)\b/.test(normalized);
    }

    if (phrase.includes("secret")) {
      return /\b(secret|service[_ -]?role|api[_ -]?key|private[_ -]?key|env)\b/.test(normalized) &&
        /\b(show|reveal|dump|get|leak|extract)\b/.test(normalized);
    }

    return false;
  });
}

export const botService = {
  async reply(userText: string) {
    return enqueueRequest(async () => {
      const startTime = Date.now();
      console.log(`[BOT] Starting reply generation for: "${userText?.substring(0, 50)}..."`);

      const knowledge = loadKnowledge();
      const normalized = (userText || "").trim();

      if (!normalized) {
        console.log(`[BOT] Empty input, returning fallback in ${Date.now() - startTime}ms`);
        return knowledge.fallbacks.empty_input;
      }

      if (isBlockedRequest(knowledge, normalized)) {
        console.log(`[BOT] Blocked request detected, returning refusal in ${Date.now() - startTime}ms`);
        return knowledge.safety.refusal_template;
      }

      const knowledgeReply = findKnowledgeReply(knowledge, normalized);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("[BOT] GEMINI_API_KEY not set");
        return knowledgeReply || getSafeFallback(knowledge, normalized);
      }

      if (!ENABLE_GEMINI_BOT) {
        console.log(`[BOT] Gemini disabled by ENABLE_GEMINI_BOT=false, returning local fallback in ${Date.now() - startTime}ms`);
        return knowledgeReply || getSafeFallback(knowledge, normalized);
      }

      const candidateModels = getCandidateModels();
      if (candidateModels.length === 0) {
        console.error("[BOT] No supported Gemini models configured");
        return knowledgeReply || getSafeFallback(knowledge, normalized);
      }

      console.log(`[BOT] Attempting models in order: ${candidateModels.join(", ")}`);

      const ai = new GoogleGenAI({ apiKey });
      const systemPrompt = buildSystemPrompt(knowledge);
      const prompt = `${systemPrompt}\n\nUser Question: ${userText}`;
      let lastRetryableError: string | null = null;

      for (const model of candidateModels) {
        const modelStartTime = Date.now();
        console.log(`[BOT] Trying model: ${model}`);

        try {
          const response = await retryWithBackoff(async () => {
            return await ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                temperature: 0.4,
                maxOutputTokens: 1024,
              },
            });
          });

          const apiCallTime = Date.now() - modelStartTime;
          console.log(`[BOT] Model ${model} succeeded in ${apiCallTime}ms`);

          const finishReason = response.candidates?.[0]?.finishReason;
          const text = response.text;
          if (text?.trim()) {
            if (finishReason === "MAX_TOKENS") {
              console.warn(`[BOT] Model ${model} hit maxOutputTokens; returning fallback instead of partial text`);
              return knowledgeReply || getSafeFallback(knowledge, normalized);
            }
            console.log(`[BOT] Total reply time: ${Date.now() - startTime}ms`);
            return text.trim();
          }
          return knowledgeReply || getSafeFallback(knowledge, normalized);
        } catch (error: any) {
          const apiCallTime = Date.now() - modelStartTime;
          const message = error?.message || String(error);
          console.error(`[BOT] Model ${model} failed in ${apiCallTime}ms:`, message);

          const isQuotaError = error?.status === 429 || error?.code === 429 || /quota/i.test(message);
          const isServiceError =
            error?.status === 503 ||
            error?.status === 502 ||
            error?.status === 504 ||
            /high demand/i.test(message) ||
            /temporar/i.test(message);
          const isNotFoundError =
            error?.status === 404 ||
            /not found/i.test(message) ||
            /not supported/i.test(message);

          if (isQuotaError) {
            lastRetryableError = message;
            continue;
          }

          if (isServiceError || isNotFoundError) {
            continue;
          }

          console.log(`[BOT] Non-retryable error for model ${model}, returning fallback`);
          return knowledgeReply || getSafeFallback(knowledge, normalized);
        }
      }

      console.error(`[BOT] No available Gemini model worked for generateContent after ${Date.now() - startTime}ms`);
      const finalMessage = lastRetryableError
        ? "The AI service is temporarily rate limited, but I can still help with SecureMsg security, groups, messages, files, unread badges, and account issues. What problem are you facing?"
        : knowledgeReply || getSafeFallback(knowledge, normalized);
      console.log(`[BOT] Returning error message after ${Date.now() - startTime}ms`);
      return finalMessage;
    });
  }
};

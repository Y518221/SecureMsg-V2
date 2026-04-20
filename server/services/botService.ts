import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

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
  };
  safety: {
    blocked_requests: string[];
    refusal_template: string;
  };
  intents?: any[];
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
  const blockedRequests = knowledge.safety.blocked_requests.join(", ");
  
  return `You are SecureMsg Support Bot, a helpful and friendly assistant that answers questions about SecureMsg - a secure messaging application.

IMPORTANT GUIDELINES:
1. You ONLY provide information about SecureMsg features, security, and troubleshooting
2. You are helpful, friendly, and security-conscious
3. Keep answers concise but thorough
4. If asked about blocked topics (${blockedRequests}), politely refuse using: "${knowledge.safety.refusal_template}"
5. If you don't know the answer, suggest checking the README or official documentation
6. Never guess or make up features - only describe what's actually in SecureMsg
7. Supported topics: ${knowledge.topics.join(", ")}

Answer helpfully and accurately. Stay focused on SecureMsg support.`;
}

export const botService = {
  async reply(userText: string) {
    const knowledge = loadKnowledge();
    const normalized = (userText || "").trim();

    if (!normalized) {
      return knowledge.fallbacks.empty_input;
    }

    const blocked = knowledge.safety.blocked_requests.some(term =>
      normalized.toLowerCase().includes(term.toLowerCase())
    );
    if (blocked) {
      return knowledge.safety.refusal_template;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[BOT] GEMINI_API_KEY not set");
      return knowledge.fallbacks.unknown;
    }

    const candidateModels = Array.from(
      new Set([
        process.env.GEMINI_MODEL,
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
      ])
    ).filter(Boolean) as string[];

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = buildSystemPrompt(knowledge);
    const prompt = `${systemPrompt}\n\nUser Question: ${userText}`;
    let lastRetryableError: string | null = null;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        });

        const text = response.text;
        if (text?.trim()) return text.trim();
        return knowledge.fallbacks.unknown;
      } catch (error: any) {
        const message = error?.message || String(error);
        console.error(`[BOT] Gemini model attempt failed (${model}):`, message);

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

        return knowledge.fallbacks.unknown;
      }
    }

    console.error("[BOT] No available Gemini model worked for generateContent");
    return lastRetryableError
      ? "Support bot is temporarily unavailable because Gemini quota or rate limits were reached. Please try again later."
      : "Support bot is temporarily unavailable. Please check the Gemini model configuration.";
  }
};

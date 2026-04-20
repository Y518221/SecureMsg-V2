import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/genai";

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

    // Check for empty input
    if (!normalized) {
      return knowledge.fallbacks.empty_input;
    }

    // Check for blocked requests (quick safety check)
    const blocked = knowledge.safety.blocked_requests.some(term =>
      normalized.toLowerCase().includes(term.toLowerCase())
    );
    if (blocked) {
      return knowledge.safety.refusal_template;
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("[BOT] GEMINI_API_KEY not set");
        return knowledge.fallbacks.unknown;
      }

      const client = new GoogleGenerativeAI({ apiKey });
      const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

      const systemPrompt = buildSystemPrompt(knowledge);
      
      const response = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: systemPrompt + "\n\nUser Question: " + userText
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        }
      });

      const text = response.response.text();
      return text || knowledge.fallbacks.unknown;
    } catch (error: any) {
      console.error("[BOT] Gemini API error:", error.message);
      return "I'm having trouble generating a response right now. Please try again.";
    }
  }
};

    return knowledge.fallbacks.unknown;
  },
};

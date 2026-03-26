import fs from "fs";
import path from "path";

type BotIntent = {
  id: string;
  keywords: string[];
  confidence?: number;
  reply: string | { short?: string; detailed?: string };
};

type BotKnowledge = {
  version: string;
  bot_name?: string;
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
  intents: BotIntent[];
};

const FALLBACK_KNOWLEDGE: BotKnowledge = {
  version: "fallback",
  bot_name: "Support Bot",
  source_of_truth: "README.md",
  topics: [],
  fallbacks: {
    empty_input: "Tell me what you need help with and I will guide you step by step.",
    unknown: "I can help with security, groups, messages, files, unread badges, and account issues. Ask me a specific problem.",
  },
  safety: {
    blocked_requests: [],
    refusal_template:
      "I cannot help with that request. I can explain supported SecureMsg features and safe troubleshooting steps.",
  },
  intents: [],
};

function normalizeReply(reply: BotIntent["reply"]): string {
  if (typeof reply === "string") return reply;
  if (reply && typeof reply === "object") {
    if (typeof reply.short === "string" && reply.short.trim()) return reply.short;
    if (typeof reply.detailed === "string" && reply.detailed.trim()) return reply.detailed;
  }
  return "Support bot is temporarily unavailable.";
}

function loadKnowledge(): BotKnowledge {
  try {
    const filePath = path.join(process.cwd(), "server", "data", "bot-knowledge.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as BotKnowledge;
    if (!parsed?.intents || !Array.isArray(parsed.intents)) return FALLBACK_KNOWLEDGE;
    return parsed;
  } catch {
    return FALLBACK_KNOWLEDGE;
  }
}

function scoreIntent(input: string, intent: BotIntent): number {
  return intent.keywords.reduce((score, keyword) => {
    return input.includes(keyword) ? score + 1 : score;
  }, 0);
}

export const botService = {
  reply(userText: string) {
    const knowledge = loadKnowledge();
    const normalized = (userText || "").trim().toLowerCase();
    if (!normalized) return knowledge.fallbacks.empty_input;

    const blocked = knowledge.safety.blocked_requests.some(term => normalized.includes(term.toLowerCase()));
    if (blocked) return knowledge.safety.refusal_template;

    let best: { intent: BotIntent; score: number } | null = null;
    for (const intent of knowledge.intents) {
      const score = scoreIntent(normalized, intent);
      if (!best || score > best.score) {
        best = { intent, score };
      }
    }

    if (best && best.score > 0) {
      const intentConfidence = typeof best.intent.confidence === "number" ? best.intent.confidence : 0.5;
      if (best.score === 1 && intentConfidence < 0.8 && knowledge.fallbacks.low_confidence) {
        return knowledge.fallbacks.low_confidence;
      }
      return normalizeReply(best.intent.reply);
    }

    return knowledge.fallbacks.unknown;
  },
};

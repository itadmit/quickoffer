import { getSetting, getSettings } from "../settings";
import { openaiLLM, openaiTranscription, type OpenAIConfig } from "./openai";
import type { LLMProvider, TranscriptionProvider } from "./types";

export * from "./types";

/**
 * Provider factory. Provider / model / key come from app_settings (admin
 * dashboard), env is fallback (PRODUCT.md §7.6). Groq and any
 * OpenAI-compatible endpoint are the same adapter with a different baseURL.
 */

const KNOWN_BASE_URLS: Record<string, string> = {
  openai: "",
  groq: "https://api.groq.com/openai/v1",
};

const PROVIDER_KEY_SETTING = {
  openai: "ai.key_openai",
  groq: "ai.key_groq",
} as const;

/**
 * Stage key first, then the provider's own key, then env.
 *
 * The middle step is what lets a stage change provider without carrying a key
 * with it: `ai.key_groq` stays valid whether or not anything is currently
 * pointed at Groq, so switching back is a provider change and nothing else.
 */
async function resolveKey(stored: string, provider: string): Promise<string> {
  if (stored) return stored;
  const setting = PROVIDER_KEY_SETTING[provider as keyof typeof PROVIDER_KEY_SETTING];
  return setting ? await getSetting(setting) : "";
}

export async function getTranscriptionProvider(): Promise<TranscriptionProvider> {
  const s = await getSettings([
    "transcription.provider",
    "transcription.model",
    "transcription.api_key",
    "transcription.base_url",
  ]);
  const apiKey = await resolveKey(s["transcription.api_key"], s["transcription.provider"]);
  if (!apiKey) {
    throw new Error("Transcription API key not configured (admin → ספקי AI)");
  }
  const cfg: OpenAIConfig = {
    providerName: s["transcription.provider"],
    apiKey,
    model: s["transcription.model"],
    baseURL:
      s["transcription.base_url"] ||
      KNOWN_BASE_URLS[s["transcription.provider"]] ||
      undefined,
  };
  // openai / groq / custom all speak the OpenAI audio API
  return openaiTranscription(cfg);
}

export async function getLLMProvider(): Promise<LLMProvider> {
  const s = await getSettings([
    "llm.provider",
    "llm.model",
    "llm.api_key",
    "llm.base_url",
    "llm.classify_model",
  ]);
  const apiKey = await resolveKey(s["llm.api_key"], s["llm.provider"]);
  if (!apiKey) {
    throw new Error("LLM API key not configured (admin → ספקי AI)");
  }
  switch (s["llm.provider"]) {
    case "openai":
    case "groq":
    case "custom":
      return openaiLLM({
        providerName: s["llm.provider"],
        apiKey,
        model: s["llm.model"],
        // Empty is the default and means "one model for both stages"
        classifyModel: s["llm.classify_model"] || undefined,
        baseURL: s["llm.base_url"] || KNOWN_BASE_URLS[s["llm.provider"]] || undefined,
      });
    // anthropic / gemini: future implementations of LLMProvider (§7.6)
    default:
      throw new Error(`Unsupported LLM provider: ${s["llm.provider"]}`);
  }
}

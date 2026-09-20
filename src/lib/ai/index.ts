import { getSettings } from "../settings";
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

export async function getTranscriptionProvider(): Promise<TranscriptionProvider> {
  const s = await getSettings([
    "transcription.provider",
    "transcription.model",
    "transcription.api_key",
    "transcription.base_url",
  ]);
  if (!s["transcription.api_key"]) {
    throw new Error("Transcription API key not configured (admin → ספקי AI)");
  }
  const cfg: OpenAIConfig = {
    providerName: s["transcription.provider"],
    apiKey: s["transcription.api_key"],
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
  ]);
  if (!s["llm.api_key"]) {
    throw new Error("LLM API key not configured (admin → ספקי AI)");
  }
  switch (s["llm.provider"]) {
    case "openai":
    case "groq":
    case "custom":
      return openaiLLM({
        providerName: s["llm.provider"],
        apiKey: s["llm.api_key"],
        model: s["llm.model"],
        baseURL: s["llm.base_url"] || KNOWN_BASE_URLS[s["llm.provider"]] || undefined,
      });
    // anthropic / gemini: future implementations of LLMProvider (§7.6)
    default:
      throw new Error(`Unsupported LLM provider: ${s["llm.provider"]}`);
  }
}

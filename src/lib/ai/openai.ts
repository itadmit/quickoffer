import OpenAI, { toFile } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import {
  classifySystemPrompt,
  correctionSystemPrompt,
  onboardingSystemPrompt,
  structureSystemPrompt,
  TRANSCRIPTION_HINTS,
} from "./prompts";
import {
  CorrectionResultSchema,
  IntentSchema,
  OnboardingAnswerSchema,
  QuoteJSONSchema,
  type LLMProvider,
  type TranscriptionProvider,
  type Usage,
  type WithUsage,
} from "./types";

/**
 * OpenAI implementation of both pipeline stages. Also serves any
 * OpenAI-compatible endpoint (Groq, custom) via `baseURL` - that's the
 * `custom` provider in the admin dashboard.
 */

export type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  providerName: string; // "openai" | "groq" | "custom"
};

// Rough ILS cost per 1M tokens / per minute, for the admin counters only.
const USD_TO_ILS = 3.7;
const LLM_PRICE_USD_PER_M: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1-nano": { in: 0.1, out: 0.4 },
  "gpt-5-mini": { in: 0.25, out: 2 },
  "gpt-5-nano": { in: 0.05, out: 0.4 },
  "gpt-5.4-mini": { in: 0.25, out: 2 },
  "gpt-5.4-nano": { in: 0.05, out: 0.4 },
  // Groq
  "openai/gpt-oss-120b": { in: 0.15, out: 0.6 },
  "openai/gpt-oss-20b": { in: 0.075, out: 0.3 },
};
const ASR_PRICE_USD_PER_MIN: Record<string, number> = {
  "whisper-1": 0.006,
  "gpt-4o-transcribe": 0.006,
  "gpt-4o-mini-transcribe": 0.003,
  "whisper-large-v3": 0.00185,
  "whisper-large-v3-turbo": 0.00067,
};

function llmCost(model: string, inTok = 0, outTok = 0): number {
  const p = LLM_PRICE_USD_PER_M[model] ?? { in: 0.5, out: 2 };
  return ((inTok * p.in + outTok * p.out) / 1_000_000) * USD_TO_ILS;
}

function client(cfg: OpenAIConfig) {
  return new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL || undefined,
    timeout: 60_000,
    maxRetries: 1,
  });
}

// ------------------------------------------------------------ transcription

export function openaiTranscription(cfg: OpenAIConfig): TranscriptionProvider {
  return {
    async transcribe(audio, opts) {
      const started = Date.now();
      const file = await toFile(audio, opts.fileName ?? "voice.ogg", {
        type: opts.mimetype ?? "audio/ogg",
      });
      const res = await client(cfg).audio.transcriptions.create({
        file,
        model: cfg.model,
        language: opts.language,
        prompt: [...TRANSCRIPTION_HINTS, ...opts.hints].join(", "),
        response_format: "json",
      });
      const ms = Date.now() - started;
      // Ogg/Opus from WhatsApp is ~1.2KB/s (verified 5.8KB for 5s); estimate minutes for cost
      const minutes = audio.length / 1200 / 60;
      const usage: Usage = {
        provider: cfg.providerName,
        model: cfg.model,
        ms,
        cost: minutes * (ASR_PRICE_USD_PER_MIN[cfg.model] ?? 0.006) * USD_TO_ILS,
      };
      return { text: (res.text ?? "").trim(), usage };
    },
  };
}

// ---------------------------------------------------------------------- LLM

async function structured<S extends z.ZodTypeAny>(
  cfg: OpenAIConfig,
  system: string,
  user: string,
  schema: S,
  name: string,
): Promise<WithUsage<z.infer<S>>> {
  const started = Date.now();
  const completion = await client(cfg).chat.completions.parse({
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: zodResponseFormat(schema, name),
  });
  const msg = completion.choices[0]?.message;
  if (!msg?.parsed) {
    throw new Error(
      msg?.refusal ? `LLM refusal: ${msg.refusal}` : "LLM returned no parsed output",
    );
  }
  const inTok = completion.usage?.prompt_tokens;
  const outTok = completion.usage?.completion_tokens;
  return {
    result: msg.parsed as z.infer<S>,
    usage: {
      provider: cfg.providerName,
      model: cfg.model,
      ms: Date.now() - started,
      inputTokens: inTok,
      outputTokens: outTok,
      cost: llmCost(cfg.model, inTok, outTok),
      raw: msg.parsed,
    },
  };
}

export function openaiLLM(cfg: OpenAIConfig): LLMProvider {
  return {
    structureQuote(transcript, profile) {
      return structured(
        cfg,
        structureSystemPrompt(profile),
        `תמלול:\n"""\n${transcript}\n"""`,
        QuoteJSONSchema,
        "quote",
      );
    },
    applyCorrection(quote, instruction, profile) {
      return structured(
        cfg,
        correctionSystemPrompt(profile),
        `ההצעה הנוכחית:\n${JSON.stringify(quote, null, 2)}\n\nהוראת התיקון:\n"""\n${instruction}\n"""`,
        CorrectionResultSchema,
        "correction",
      );
    },
    classifyMessage(text, ctx) {
      return structured(
        cfg,
        classifySystemPrompt(ctx),
        `ההודעה:\n"""\n${text}\n"""`,
        IntentSchema,
        "intent",
      );
    },
    parseOnboardingAnswer(text, step, suggestedName) {
      return structured(
        cfg,
        onboardingSystemPrompt(step, suggestedName),
        `התשובה:\n"""\n${text}\n"""`,
        OnboardingAnswerSchema,
        "onboarding_answer",
      );
    },
  };
}

import OpenAI, { toFile } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { parseResetSeconds } from "./limits";
import type { z } from "zod";
import {
  classifySystemPrompt,
  correctionSystemPrompt,
  onboardingSystemPrompt,
  structureSystemPrompt,
  transcriptionPrompt,
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
  /**
   * Model for the classify stage, when it should differ from `model`.
   *
   * Classification is the easy half of the job, and on a rate limited tier the
   * two models draw from separate token buckets, so splitting the stages buys
   * headroom the account does not otherwise have. Measured on 24.9.2026
   * against the 16 cases in tests/groq-eval.ts: gpt-oss-20b scored identically
   * to gpt-oss-120b (15/16, same single failure) and was 28% faster.
   *
   * Undefined - the default - runs both stages on `model`.
   */
  classifyModel?: string;
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
    // One request must not be able to spend the whole background budget.
    timeout: 25_000,
    // Retrying is done by withRetry below, which knows the budget. Left to the
    // SDK, a 429 carrying `retry-after: 30` makes it sleep 30s and try again,
    // twice - past the route's 60s maxDuration, so the function is killed
    // mid-flight and the wait buys nothing.
    maxRetries: 0,
  });
}

/**
 * How long the provider says to wait, in ms, or null if this was not a rate
 * limit. Pure, so the header shapes can be tested against what Groq actually
 * sends: `retry-after` in seconds on a 429, and `x-ratelimit-reset-tokens` in
 * Go duration form ("1m26.4s", "547ms") on every response.
 */
export function rateLimitWaitMs(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { status?: number; headers?: unknown };
  if (e.status !== 429) return null;
  const h = e.headers;
  // HTTP header names are case insensitive. Headers handles that itself; a
  // plain object (what some OpenAI-compatible clients hand back) does not, so
  // fold the keys rather than guessing which casing the provider chose.
  const folded =
    h instanceof Headers || !h || typeof h !== "object"
      ? null
      : new Map(Object.entries(h as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
  const get = (name: string): string | null => {
    if (h instanceof Headers) return h.get(name);
    return folded?.get(name) ?? null;
  };
  // Number(null) is 0, so a missing header must be rejected before parsing or
  // an absent retry-after reads as "retry immediately" - the one behaviour a
  // provider that is already turning us away must never see.
  const num = (name: string): number | null => {
    const raw = get(name);
    if (raw === null || raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const ms = num("retry-after-ms");
  if (ms !== null) return ms;
  const seconds = num("retry-after");
  if (seconds !== null) return seconds * 1000;
  const reset = parseResetSeconds(get("x-ratelimit-reset-tokens"));
  return reset === null ? null : reset * 1000;
}

/**
 * Wait out a rate limit in place when it is short enough to be worth it.
 *
 * The route has 60 seconds, and the pipeline has already spent some of it
 * downloading and transcribing, so the budget here is what is left over with
 * room to still answer. A refill the provider says will take longer than that
 * is not waited for at all: it is thrown, and `handleInbound` hands the
 * message to the cron tick instead of holding a serverless function open for
 * a minute to achieve nothing.
 */
const RETRY_BUDGET_MS = 20_000;
const TRANSIENT_ATTEMPTS = 3;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const waitMs = rateLimitWaitMs(err);
      if (waitMs !== null) {
        // A rate limit is retried once, and only if the queue in front of us
        // is short. The small margin covers clock skew against the provider.
        if (attempt > 1 || waitMs > RETRY_BUDGET_MS) throw err;
        await new Promise((r) => setTimeout(r, waitMs + 250));
        continue;
      }
      // Transient faults keep the short exponential backoff the SDK used to do.
      const status = (err as { status?: number }).status;
      const transient = status === undefined || status >= 500 || status === 408 || status === 409;
      if (!transient || attempt >= TRANSIENT_ATTEMPTS) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

// ------------------------------------------------------------ transcription

const ACCEPTED_EXT = new Set(["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm"]);
const MIME_EXT: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
};

/**
 * Whisper endpoints (OpenAI, Groq) validate by file extension. WhatsApp and
 * Telegram voice notes arrive as ".oga" (Ogg/Opus), which Groq rejects
 * ("file must be one of the following types") - so name the upload by MIME type.
 */
export function uploadName(fileName: string | undefined, mimetype: string | undefined): string {
  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (ACCEPTED_EXT.has(ext)) return fileName!;
  const mime = (mimetype ?? "audio/ogg").split(";")[0].trim().toLowerCase();
  return `voice.${MIME_EXT[mime] ?? "ogg"}`;
}

export function openaiTranscription(cfg: OpenAIConfig): TranscriptionProvider {
  return {
    async transcribe(audio, opts) {
      const started = Date.now();
      const file = await toFile(audio, uploadName(opts.fileName, opts.mimetype), {
        type: (opts.mimetype ?? "audio/ogg").split(";")[0].trim(),
      });
      const res = await withRetry(() =>
        client(cfg).audio.transcriptions.create({
          file,
          model: cfg.model,
          language: opts.language,
          prompt: transcriptionPrompt(opts.hints),
          response_format: "json",
        }),
      );
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
  model = cfg.model,
): Promise<WithUsage<z.infer<S>>> {
  const started = Date.now();
  const completion = await withRetry(() =>
    client(cfg).chat.completions.parse({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: zodResponseFormat(schema, name),
    }),
  );
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
      model,
      ms: Date.now() - started,
      inputTokens: inTok,
      outputTokens: outTok,
      cost: llmCost(model, inTok, outTok),
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
        cfg.classifyModel || cfg.model,
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

import { getSettings } from "../settings";

/**
 * How much AI capacity is left (admin dashboard).
 *
 * Neither Groq nor OpenAI expose a credits/balance endpoint - on Groq's free
 * tier there is no balance at all, only rate limits. What *does* exist, and
 * what actually decides whether the next voice note gets an answer, is the
 * `x-ratelimit-*` header set every completion comes back with. Verified live
 * against Groq on 24.9.2026:
 *
 *   chat/completions  x-ratelimit-limit-requests: 1000   (per day)
 *                     x-ratelimit-limit-tokens:   8000   (per minute)
 *   audio/transcriptions
 *                     x-ratelimit-limit-requests: 2000   (per day)
 *
 * The buckets leak rather than reset on a boundary: `reset` is the time to
 * regain what was just spent (86400/1000 = 86.4s per request), so a quiet hour
 * refills the day's allowance on its own.
 */

export type RateLimit = {
  limit: number | null;
  remaining: number | null;
  /** seconds until the spent amount is back, as the provider reported it */
  resetSeconds: number | null;
};

export type ChannelUsage = {
  stage: "llm" | "transcription";
  provider: string;
  model: string;
  ok: boolean;
  error?: string;
  requests: RateLimit;
  tokens: RateLimit;
};

/** "1m26.4s" · "547ms" · "43.2s" · "2h30m0s" → seconds */
export function parseResetSeconds(raw: string | null): number | null {
  if (!raw) return null;
  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;
  let total = 0;
  let matched = false;
  for (const [, value, unit] of raw.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g)) {
    matched = true;
    const n = Number(value);
    total += unit === "ms" ? n / 1000 : unit === "s" ? n : unit === "m" ? n * 60 : unit === "h" ? n * 3600 : n * 86400;
  }
  return matched ? total : null;
}

function num(h: Headers, name: string): number | null {
  const v = h.get(name);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readLimits(h: Headers): { requests: RateLimit; tokens: RateLimit } {
  return {
    requests: {
      limit: num(h, "x-ratelimit-limit-requests"),
      remaining: num(h, "x-ratelimit-remaining-requests"),
      resetSeconds: parseResetSeconds(h.get("x-ratelimit-reset-requests")),
    },
    tokens: {
      limit: num(h, "x-ratelimit-limit-tokens"),
      remaining: num(h, "x-ratelimit-remaining-tokens"),
      resetSeconds: parseResetSeconds(h.get("x-ratelimit-reset-tokens")),
    },
  };
}

const EMPTY: RateLimit = { limit: null, remaining: null, resetSeconds: null };

const BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
};

function endpoint(baseUrl: string, provider: string, path: string): string {
  const base = (baseUrl || BASE_URLS[provider] || BASE_URLS.openai).replace(/\/$/, "");
  return `${base}${path}`;
}

/**
 * The cheapest request that still comes back with the headers: one token out.
 * Costs one request from the daily allowance, which is the price of knowing
 * how many are left.
 */
async function probeLLM(): Promise<ChannelUsage> {
  const s = await getSettings(["llm.provider", "llm.model", "llm.api_key", "llm.base_url"]);
  const provider = s["llm.provider"];
  const key = s["llm.api_key"] || (provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY) || "";
  const base = { stage: "llm" as const, provider, model: s["llm.model"] };
  if (!key) return { ...base, ok: false, error: "אין מפתח API", requests: EMPTY, tokens: EMPTY };
  try {
    const res = await fetch(endpoint(s["llm.base_url"], provider, "/chat/completions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: s["llm.model"],
        messages: [{ role: "user", content: "." }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const limits = readLimits(res.headers);
    // A 429 is not a failed probe - it is the answer, and the headers are still there.
    if (!res.ok && res.status !== 429) {
      return { ...base, ok: false, error: `HTTP ${res.status}`, ...limits };
    }
    return { ...base, ok: true, ...limits };
  } catch (err) {
    return { ...base, ok: false, error: err instanceof Error ? err.message : String(err), requests: EMPTY, tokens: EMPTY };
  }
}

/** 0.4s of silence, 8kHz mono - the smallest file Whisper endpoints accept. */
function silentWav(seconds = 0.4, rate = 8000): Buffer {
  const frames = Math.round(seconds * rate);
  const data = Buffer.alloc(frames * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function probeTranscription(): Promise<ChannelUsage> {
  const s = await getSettings([
    "transcription.provider",
    "transcription.model",
    "transcription.api_key",
    "transcription.base_url",
  ]);
  const provider = s["transcription.provider"];
  const key =
    s["transcription.api_key"] ||
    (provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY) ||
    "";
  const base = { stage: "transcription" as const, provider, model: s["transcription.model"] };
  if (!key) return { ...base, ok: false, error: "אין מפתח API", requests: EMPTY, tokens: EMPTY };
  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(silentWav())], { type: "audio/wav" }), "probe.wav");
    form.append("model", s["transcription.model"]);
    const res = await fetch(endpoint(s["transcription.base_url"], provider, "/audio/transcriptions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    const limits = readLimits(res.headers);
    if (!res.ok && res.status !== 429) {
      return { ...base, ok: false, error: `HTTP ${res.status}`, ...limits };
    }
    return { ...base, ok: true, ...limits };
  } catch (err) {
    return { ...base, ok: false, error: err instanceof Error ? err.message : String(err), requests: EMPTY, tokens: EMPTY };
  }
}

/** What one voice note costs, measured (§7): 1 transcription + classify + structure. */
export const REQUESTS_PER_QUOTE = { transcription: 1, llm: 2 } as const;

export type AiCapacity = {
  llm: ChannelUsage;
  transcription: ChannelUsage;
  /** quotes still possible today, whichever allowance runs out first */
  quotesLeftToday: number | null;
  /** ceiling imposed by the per-minute token bucket - the one that bites first */
  quotesPerMinute: number | null;
  bottleneck: "llm-requests" | "transcription-requests" | "llm-tokens" | null;
  checkedAt: string;
};

/**
 * @param tokensPerQuote measured from processing_runs when we have data,
 *   so the estimate tracks the prompt instead of a constant going stale.
 */
export async function probeAiCapacity(tokensPerQuote = 2900): Promise<AiCapacity> {
  const [llm, transcription] = await Promise.all([probeLLM(), probeTranscription()]);

  const byLlm =
    llm.requests.remaining !== null ? Math.floor(llm.requests.remaining / REQUESTS_PER_QUOTE.llm) : null;
  const byAsr =
    transcription.requests.remaining !== null
      ? Math.floor(transcription.requests.remaining / REQUESTS_PER_QUOTE.transcription)
      : null;
  const candidates = [byLlm, byAsr].filter((n): n is number => n !== null);
  const quotesLeftToday = candidates.length ? Math.min(...candidates) : null;

  const quotesPerMinute =
    llm.tokens.limit !== null && tokensPerQuote > 0
      ? Math.floor((llm.tokens.limit / tokensPerQuote) * 10) / 10
      : null;

  let bottleneck: AiCapacity["bottleneck"] = null;
  if (quotesLeftToday !== null) bottleneck = byLlm === quotesLeftToday ? "llm-requests" : "transcription-requests";
  // A per-minute ceiling under ~3 quotes matters more than the daily one.
  if (quotesPerMinute !== null && quotesPerMinute < 3) bottleneck = "llm-tokens";

  return {
    llm,
    transcription,
    quotesLeftToday,
    quotesPerMinute,
    bottleneck,
    checkedAt: new Date().toISOString(),
  };
}

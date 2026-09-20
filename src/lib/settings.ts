import { db } from "./db";
import { appSettings } from "./db/schema";
import { decryptSecret, encryptSecret } from "./crypto";

/**
 * app_settings — provider/model/key configuration edited from /admin.
 * Env vars are fallback only (PRODUCT.md §7.6, §16).
 */

export const SETTING_KEYS = {
  "transcription.provider": { secret: false, env: null, default: "openai" },
  "transcription.model": { secret: false, env: null, default: "whisper-1" },
  "transcription.api_key": { secret: true, env: "OPENAI_API_KEY", default: "" },
  "transcription.base_url": { secret: false, env: null, default: "" },
  "llm.provider": { secret: false, env: null, default: "openai" },
  "llm.model": { secret: false, env: null, default: "gpt-4o-mini" },
  "llm.api_key": { secret: true, env: "OPENAI_API_KEY", default: "" },
  "llm.base_url": { secret: false, env: null, default: "" },
  "ibot.token": { secret: true, env: "IBOT_TOKEN", default: "" },
  "ibot.instance_id": { secret: false, env: "IBOT_INSTANCE_ID", default: "" },
  "ibot.webhook_token": { secret: true, env: "IBOT_WEBHOOK_TOKEN", default: "" },
  "ibot.base_url": { secret: false, env: null, default: "https://ibot-chat.com/api/v1/" },
  "ibot.last_webhook_at": { secret: false, env: null, default: "" },
  "ibot.instance_status": { secret: false, env: null, default: "unknown" },
  "ibot.instance_checked_at": { secret: false, env: null, default: "" },
  "app.url": { secret: false, env: "APP_URL", default: "http://localhost:3000" },
  // The bot's WhatsApp number (digits). Temporary: Quick Shop's number until QuickVoice gets its own.
  "bot.phone": { secret: false, env: "BOT_PHONE", default: "972552554432" },
} as const;

export type SettingKey = keyof typeof SETTING_KEYS;

const CACHE_TTL_MS = 60_000;
let cache: { at: number; values: Map<string, string | null> } | null = null;

async function loadAll(): Promise<Map<string, string | null>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.values;
  const rows = await db.select().from(appSettings);
  const values = new Map<string, string | null>();
  for (const r of rows) values.set(r.key, r.value);
  cache = { at: Date.now(), values };
  return values;
}

export function invalidateSettingsCache() {
  cache = null;
}

export async function getSetting(key: SettingKey): Promise<string> {
  const meta = SETTING_KEYS[key];
  const values = await loadAll();
  const stored = values.get(key);
  if (stored) return meta.secret ? decryptSecret(stored) : stored;
  if (meta.env && process.env[meta.env]) return process.env[meta.env]!;
  return meta.default;
}

export async function getSettings<K extends SettingKey>(
  keys: readonly K[],
): Promise<Record<K, string>> {
  const out = {} as Record<K, string>;
  for (const k of keys) out[k] = await getSetting(k);
  return out;
}

export async function setSetting(
  key: SettingKey,
  value: string,
  updatedBy = "admin",
) {
  const meta = SETTING_KEYS[key];
  const stored = meta.secret && value ? encryptSecret(value) : value;
  await db
    .insert(appSettings)
    .values({ key, value: stored, isSecret: meta.secret, updatedBy })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: stored, isSecret: meta.secret, updatedAt: new Date(), updatedBy },
    });
  invalidateSettingsCache();
}

/** For the admin UI: where does each value come from, masked if secret. */
export async function describeSettings() {
  const values = await loadAll();
  return (Object.keys(SETTING_KEYS) as SettingKey[]).map((key) => {
    const meta = SETTING_KEYS[key];
    const stored = values.get(key);
    let source: "db" | "env" | "default" = "default";
    let value = meta.default as string;
    if (stored) {
      source = "db";
      value = meta.secret ? decryptSecret(stored) : stored;
    } else if (meta.env && process.env[meta.env]) {
      source = "env";
      value = process.env[meta.env]!;
    }
    return { key, secret: meta.secret, source, value };
  });
}

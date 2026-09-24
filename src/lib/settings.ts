import { db } from "./db";
import { appSettings } from "./db/schema";
import { decryptSecret, encryptSecret } from "./crypto";

/**
 * app_settings - provider/model/key configuration edited from /admin.
 * Env vars are fallback only (PRODUCT.md §7.6, §16).
 */

export const SETTING_KEYS = {
  "transcription.provider": { secret: false, env: null, default: "openai" },
  "transcription.model": { secret: false, env: null, default: "whisper-1" },
  // key env fallback is provider-specific, resolved in lib/ai/index.ts (OPENAI_API_KEY / GROQ_API_KEY)
  "transcription.api_key": { secret: true, env: null, default: "" },
  "transcription.base_url": { secret: false, env: null, default: "" },
  "llm.provider": { secret: false, env: null, default: "openai" },
  "llm.model": { secret: false, env: null, default: "gpt-4o-mini" },
  "llm.api_key": { secret: true, env: null, default: "" },
  /**
   * Optional: run the cheap classify stage on a different model from the
   * expensive structure stage. Empty = one model for both, which is the
   * default. Worth setting on a rate limited tier, where the two models have
   * separate token buckets (lib/ai/limits.ts).
   */
  "llm.classify_model": { secret: false, env: null, default: "" },
  /**
   * Keys held per provider rather than per stage.
   *
   * The two stages can sit on different providers and each is switched on its
   * own, so a key stored only against a stage is lost the moment that stage
   * moves - which is what turns "switch transcription to Groq" into "switch
   * transcription off". These are the fallback every stage resolves through
   * (lib/ai/index.ts), so a provider's key survives any stage moving away
   * from it and switching back costs nothing.
   */
  "ai.key_openai": { secret: true, env: "OPENAI_API_KEY", default: "" },
  "ai.key_groq": { secret: true, env: "GROQ_API_KEY", default: "" },
  "llm.base_url": { secret: false, env: null, default: "" },
  "ibot.token": { secret: true, env: "IBOT_TOKEN", default: "" },
  "ibot.instance_id": { secret: false, env: "IBOT_INSTANCE_ID", default: "" },
  "ibot.webhook_token": { secret: true, env: "IBOT_WEBHOOK_TOKEN", default: "" },
  "ibot.base_url": { secret: false, env: null, default: "https://ibot-chat.com/api/v1/" },
  "ibot.last_webhook_at": { secret: false, env: null, default: "" },
  "ibot.instance_status": { secret: false, env: null, default: "unknown" },
  "ibot.instance_checked_at": { secret: false, env: null, default: "" },
  "app.url": { secret: false, env: "APP_URL", default: "http://localhost:3000" },
  // Telegram bot (second channel; mainly for testing without a WhatsApp instance)
  "telegram.bot_token": { secret: true, env: "TELEGRAM_BOT_TOKEN", default: "" },
  "telegram.webhook_secret": { secret: true, env: "TELEGRAM_WEBHOOK_SECRET", default: "" },
  "telegram.bot_username": { secret: false, env: "TELEGRAM_BOT_USERNAME", default: "" },
  // The bot's WhatsApp number (digits). QuickOffer's own line: 053-370-7533.
  "bot.phone": { secret: false, env: "BOT_PHONE", default: "972533707533" },
  /**
   * Who gets the internal heads-up when someone new writes to the bot.
   * Comma separated, same address format sendText() takes anywhere else:
   * WhatsApp digits ("972501234567") or "tg:<chatId>". Empty = nobody.
   */
  "admin.notify": { secret: false, env: "ADMIN_NOTIFY", default: "" },
  // Billing Hub (quick-billing) - the hub owns cards, invoices and dunning.
  // Unset = no upgrade path; the UI falls back to a WhatsApp message to us.
  "billing.hub_url": { secret: false, env: "BILLING_HUB_URL", default: "https://billing.my-quickshop.com" },
  "billing.product_id": { secret: false, env: null, default: "quickoffer" },
  "billing.api_key": { secret: true, env: "BILLING_API_KEY", default: "" },
  /** signs the requests we send (products.webhook_secret in the hub) */
  "billing.api_secret": { secret: true, env: "BILLING_API_SECRET", default: "" },
  /** verifies the events they send (webhook_endpoints.secret in the hub) */
  "billing.endpoint_secret": { secret: true, env: "BILLING_ENDPOINT_SECRET", default: "" },
  // Meta pixel + Conversions API ("QuickOffer" dataset in quickshop_il). Empty pixel id in /admin = falls back to this default.
  "meta.pixel_id": { secret: false, env: "META_PIXEL_ID", default: "1071647615854904" },
  "meta.capi_token": { secret: true, env: "META_CAPI_TOKEN", default: "" },
  /** Events Manager → Test events. Set while testing, clear before going live. */
  "meta.test_event_code": { secret: false, env: null, default: "" },
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

function readStored(key: string, stored: string, secret: boolean): string {
  if (!secret) return stored;
  try {
    return decryptSecret(stored);
  } catch (err) {
    // Wrong SETTINGS_ENCRYPTION_KEY for this environment - fall through to env/default
    console.error(`[settings] cannot decrypt ${key}: ${err instanceof Error ? err.message : err}`);
    return "";
  }
}

export async function getSetting(key: SettingKey): Promise<string> {
  const meta = SETTING_KEYS[key];
  const values = await loadAll();
  const stored = values.get(key);
  if (stored) {
    const v = readStored(key, stored, meta.secret);
    if (v) return v;
  }
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
  const values = await loadAll();
  const currentStored = values.get(key);
  const current = currentStored ? readStored(key, currentStored, meta.secret) : "";
  // Writing the same value again is a round trip for nothing, and some keys
  // (ibot.instance_status) are written on the path of every message sent.
  // Compared on the plaintext because a secret re-encrypts to different bytes.
  if (current === value) return;

  const stored = meta.secret && value ? encryptSecret(value) : value;
  await db
    .insert(appSettings)
    .values({ key, value: stored, isSecret: meta.secret, updatedBy })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: stored, isSecret: meta.secret, updatedAt: new Date(), updatedBy },
    });
  // Patch rather than drop. Invalidating would make the next getSetting re-read
  // the whole table, and a single message reads settings several times.
  if (cache) cache.values.set(key, stored);
}

/**
 * Heartbeat keys ("when did we last hear from iBot") written on the message hot
 * path. The admin reads them to the minute, so writing them to the millisecond
 * is pure write amplification.
 */
export async function touchSetting(key: SettingKey, minIntervalMs = 60_000) {
  const values = await loadAll();
  const prev = values.get(key);
  if (prev) {
    const at = Date.parse(prev);
    if (Number.isFinite(at) && Date.now() - at < minIntervalMs) return;
  }
  await setSetting(key, new Date().toISOString(), "system");
}

/** For the admin UI: where does each value come from, masked if secret. */
export async function describeSettings() {
  const values = await loadAll();
  return (Object.keys(SETTING_KEYS) as SettingKey[]).map((key) => {
    const meta = SETTING_KEYS[key];
    const stored = values.get(key);
    let source: "db" | "env" | "default" = "default";
    let value = meta.default as string;
    const decrypted = stored ? readStored(key, stored, meta.secret) : "";
    if (decrypted) {
      source = "db";
      value = decrypted;
    } else if (meta.env && process.env[meta.env]) {
      source = "env";
      value = process.env[meta.env]!;
    }
    return { key, secret: meta.secret, source, value };
  });
}

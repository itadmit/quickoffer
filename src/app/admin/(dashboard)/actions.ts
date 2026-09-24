"use server";

import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLLMProvider, getTranscriptionProvider } from "@/lib/ai";
import { probeAiCapacity } from "@/lib/ai/limits";
import { requireAdmin } from "@/lib/admin/auth";
import { handleInbound } from "@/lib/conversation/handler";
import { db } from "@/lib/db";
import { inboundMessages, processingRuns, users } from "@/lib/db/schema";
import { randomBytes } from "node:crypto";
import { getSetting, SETTING_KEYS, setSetting, type SettingKey } from "@/lib/settings";
import { gatewayFor, sendText } from "@/lib/whatsapp";
import { getTelegramMe, setTelegramWebhook } from "@/lib/whatsapp/telegram";

export async function saveSettingsAction(values: Record<string, string>) {
  await requireAdmin();
  for (const [key, value] of Object.entries(values)) {
    if (!(key in SETTING_KEYS)) continue;
    // empty secret field = "leave unchanged"
    if (SETTING_KEYS[key as SettingKey].secret && value === "") continue;
    await setSetting(key as SettingKey, value.trim());
  }
  revalidatePath("/admin/ai");
  revalidatePath("/admin/ibot");
  revalidatePath("/admin/telegram");
  revalidatePath("/admin/billing");
  revalidatePath("/admin/meta");
  revalidatePath("/");
  return { ok: true as const };
}

export async function telegramSetWebhookAction() {
  await requireAdmin();
  const appUrl = await getSetting("app.url");
  let secret = await getSetting("telegram.webhook_secret");
  if (!secret) {
    secret = randomBytes(24).toString("base64url");
    await setSetting("telegram.webhook_secret", secret);
  }
  const r = await setTelegramWebhook(appUrl, secret);
  const me = await getTelegramMe();
  if (me.ok && me.result?.username) await setSetting("telegram.bot_username", me.result.username);
  revalidatePath("/admin/telegram");
  return r.ok
    ? { ok: true as const, username: me.result?.username ?? null, url: `${appUrl}/api/webhooks/telegram` }
    : { ok: false as const, error: r.description ?? "setWebhook failed" };
}

export async function telegramTestAction() {
  await requireAdmin();
  const me = await getTelegramMe();
  return me.ok ? { ok: true as const, me: me.result } : { ok: false as const, error: me.description ?? "getMe failed" };
}

/** "בדוק חיבור" for transcription: transcribe a short bundled Hebrew sample. */
export async function testTranscriptionAction() {
  await requireAdmin();
  const started = Date.now();
  try {
    const { readFile } = await import("node:fs/promises");
    const path = `${process.cwd()}/public/test-audio.ogg`;
    const audio = await readFile(path).catch(() => null);
    if (!audio) {
      return { ok: false as const, error: "אין קובץ בדיקה ב-public/test-audio.ogg - שלח הודעה קולית אמיתית לבוט במקום" };
    }
    const asr = await getTranscriptionProvider();
    const r = await asr.transcribe(audio, { language: "he", hints: [], fileName: "test-audio.ogg", mimetype: "audio/ogg" });
    return { ok: true as const, text: r.text, ms: Date.now() - started, usage: r.usage };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

/** "בדוק חיבור" for the LLM: run the canonical sample quote. */
export async function testLLMAction() {
  await requireAdmin();
  const started = Date.now();
  try {
    const llm = await getLLMProvider();
    const r = await llm.structureQuote(
      "הצעת מחיר לדני כהן, התקנת שלושה גופי תאורה 150 שקל ליחידה, ביקור 200 שקל, המחיר לפני מע״מ, 50 אחוז מקדמה",
      { businessName: "יוסי חשמל", vatStatus: "registered", defaultPaymentTerms: null, defaultValidDays: 14, defaultNotes: [], catalog: [] },
    );
    return { ok: true as const, json: r.result, ms: Date.now() - started, usage: { ...r.usage, raw: undefined } };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * "כמה נשאר" for the AI providers. Costs one request from each daily
 * allowance, so it is a button rather than something the page does on load
 * (lib/ai/limits.ts explains why the headers are the only source of truth).
 */
export async function probeAiCapacityAction() {
  await requireAdmin();
  const [row] = await db
    .select({
      avgTokens: sql<number>`avg(coalesce(${processingRuns.llmInputTokens}, 0) + coalesce(${processingRuns.llmOutputTokens}, 0))`,
    })
    .from(processingRuns)
    .where(
      and(
        eq(processingRuns.kind, "new_quote"),
        gte(processingRuns.at, new Date(Date.now() - 7 * 86_400_000)),
        isNotNull(processingRuns.llmInputTokens),
      ),
    );
  const measured = Number(row?.avgTokens ?? 0);
  return probeAiCapacity(measured > 0 ? Math.round(measured) : undefined);
}

export async function sendTestMessageAction(phone: string) {
  await requireAdmin();
  const to = phone.replace(/\D/g, "");
  if (to.length < 9) return { ok: false as const, error: "מספר לא תקין" };
  const r = await sendText(to, `בדיקה מ-QuickOffer ✅ ${new Date().toLocaleTimeString("he-IL")}`);
  revalidatePath("/admin/ibot");
  return r.ok ? { ok: true as const, body: r.body } : { ok: false as const, error: JSON.stringify(r.body) };
}

export async function setUserPlanAction(userId: string, plan: "trial" | "basic" | "pro" | "unlimited") {
  await requireAdmin();
  await db.update(users).set({ plan }).where(eq(users.id, userId));
  revalidatePath("/admin/users");
}

export async function toggleBlockAction(userId: string, blocked: boolean) {
  await requireAdmin();
  await db.update(users).set({ blocked }).where(eq(users.id, userId));
  revalidatePath("/admin/users");
}

export async function resetOnboardingAction(userId: string) {
  await requireAdmin();
  await db.update(users).set({ onboardingState: "name" }).where(eq(users.id, userId));
  revalidatePath("/admin/users");
}

export async function reprocessMessageAction(id: string) {
  await requireAdmin();
  const row = await db.query.inboundMessages.findFirst({ where: eq(inboundMessages.id, id) });
  if (!row) return { ok: false as const, error: "not found" };
  const parsed = gatewayFor(row.userPhone).parseInbound(row.raw);
  if (!parsed.ok) return { ok: false as const, error: `unparseable: ${parsed.reason}` };
  await db.update(inboundMessages).set({ processedAt: null, error: null }).where(eq(inboundMessages.id, id));
  await handleInbound(parsed.message);
  revalidatePath("/admin/messages");
  return { ok: true as const };
}

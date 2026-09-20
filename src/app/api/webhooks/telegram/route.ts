import { waitUntil } from "@vercel/functions";
import { NextResponse, type NextRequest } from "next/server";
import { handleInbound } from "@/lib/conversation/handler";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { inboundMessages } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { telegram } from "@/lib/whatsapp/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/webhooks/telegram - Telegram Bot API updates.
 * Same contract as the iBot webhook: auth → normalize → dedup → persist → 200 → process in background.
 * Telegram retries on non-200, so a 200 is returned even for dropped updates.
 */
export async function POST(req: NextRequest) {
  const expected = await getSetting("telegram.webhook_secret");
  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = telegram.parseInbound(payload);
  if (!parsed.ok) return NextResponse.json({ ok: true, dropped: parsed.reason });
  const msg = parsed.message;

  const inserted = await db
    .insert(inboundMessages)
    .values({
      id: msg.id,
      userPhone: msg.from,
      type: msg.type,
      text: msg.text,
      mediaUrl: msg.media?.url ?? null,
      raw: msg.raw as Record<string, unknown>,
      at: new Date(msg.at * 1000),
      attempts: 1,
    })
    .onConflictDoNothing()
    .returning({ id: inboundMessages.id });
  if (!inserted.length) return NextResponse.json({ ok: true, dropped: "duplicate" });

  waitUntil(handleInbound(msg));
  return NextResponse.json({ ok: true, id: msg.id });
}

export function GET() {
  return NextResponse.json({ ok: true, service: "quickoffer-telegram-webhook" });
}

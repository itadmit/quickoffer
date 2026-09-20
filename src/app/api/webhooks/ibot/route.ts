import { waitUntil } from "@vercel/functions";
import { NextResponse, type NextRequest } from "next/server";
import { handleInbound } from "@/lib/conversation/handler";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { inboundMessages } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/settings";
import { gateway } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST /api/webhooks/ibot — PRODUCT.md §5.1, §5.3.
 * 1. auth header → 401
 * 2. normalize + filter + dedup + write inbound_messages
 * 3. return 200 immediately; processing continues in waitUntil
 */
export async function POST(req: NextRequest) {
  // --- auth
  const expected = await getSetting("ibot.webhook_token");
  const provided = req.headers.get("x-webhook-token") ?? "";
  if (expected) {
    if (!provided || !safeEqual(provided, expected)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Refuse to run unauthenticated in production — configure the token in /admin
    console.error("[webhook] ibot.webhook_token not configured");
    return NextResponse.json({ error: "webhook token not configured" }, { status: 503 });
  }

  // --- body
  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  waitUntil(setSetting("ibot.last_webhook_at", new Date().toISOString(), "system"));

  // --- normalize + filter
  const parsed = gateway.parseInbound(payload);
  if (!parsed.ok) {
    return NextResponse.json({ ok: true, dropped: parsed.reason });
  }
  const msg = parsed.message;

  // --- dedup + persist BEFORE the 200 (iBot does not retry)
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
  if (!inserted.length) {
    return NextResponse.json({ ok: true, dropped: "duplicate" });
  }

  // --- process in the background
  waitUntil(handleInbound(msg));

  return NextResponse.json({ ok: true, id: msg.id });
}

export function GET() {
  return NextResponse.json({ ok: true, service: "quickvoice-ibot-webhook" });
}

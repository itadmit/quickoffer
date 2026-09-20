import { and, isNull, lt, lte, notInArray, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { handleInbound } from "@/lib/conversation/handler";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { inboundMessages, quotes } from "@/lib/db/schema";
import { purgeExpiredLinks } from "@/lib/quotes/links";
import { getSetting } from "@/lib/settings";
import { gatewayFor, type InboundMessage } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/tick?secret=… - called every 5 minutes by an external pinger
 * (cron-job.org) for the demo; Vercel Cron in production (PRODUCT.md §16).
 *  - re-runs inbound messages stuck without processed_at for > 2 min (max 3 attempts)
 *  - expires quotes past valid_until
 *  - reports instance health as last known (§5.5)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.nextUrl.searchParams.get("secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (secret && !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 1. stuck inbound messages
  const stuck = await db
    .select()
    .from(inboundMessages)
    .where(
      and(
        isNull(inboundMessages.processedAt),
        lt(inboundMessages.at, new Date(Date.now() - 2 * 60_000)),
        lt(inboundMessages.attempts, 3),
      ),
    )
    .limit(5);
  let reprocessed = 0;
  for (const row of stuck) {
    const parsed = gatewayFor(row.userPhone).parseInbound(row.raw);
    if (!parsed.ok) continue;
    await db
      .update(inboundMessages)
      .set({ attempts: sql`${inboundMessages.attempts} + 1` })
      .where(sql`${inboundMessages.id} = ${row.id}`);
    await handleInbound(parsed.message as InboundMessage);
    reprocessed++;
  }

  // 2. expire quotes
  const expired = await db
    .update(quotes)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        lte(quotes.validUntil, new Date()),
        notInArray(quotes.status, ["approved", "rejected", "expired"]),
      ),
    )
    .returning({ id: quotes.id });

  const purgedLinks = await purgeExpiredLinks();

  const instanceStatus = await getSetting("ibot.instance_status");
  const lastWebhookAt = await getSetting("ibot.last_webhook_at");

  return NextResponse.json({
    ok: true,
    reprocessed,
    expired: expired.length,
    purgedLinks,
    instanceStatus,
    lastWebhookAt,
  });
}

import { and, gt, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { sendActivationNudges } from "@/lib/conversation/activation";
import { handleInbound, MAX_ATTEMPTS, RETRY_WINDOW_MS } from "@/lib/conversation/handler";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { inboundMessages, OPEN_QUOTE_STATUSES, quotes } from "@/lib/db/schema";
import { sendFollowUps } from "@/lib/quotes/follow-up";
import { purgeExpiredLinks } from "@/lib/quotes/links";
import { purgeOldLogs } from "@/lib/retention";
import { getSetting } from "@/lib/settings";
import { gatewayFor, type InboundMessage } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/tick - every 5 minutes, from Vercel Cron (`vercel.json`).
 * Vercel sends `Authorization: Bearer $CRON_SECRET` automatically; `?secret=`
 * is kept for manual and local runs.
 *  - re-runs inbound messages stuck without processed_at for > 2 min (MAX_ATTEMPTS
 *    genuine failures, or up to RETRY_WINDOW_MS of being rate limited)
 *  - expires quotes past valid_until
 *  - nudges the professional about quotes that went quiet (§6.6)
 *  - nudges whoever finished setup and never wrote a first quote
 *  - reports instance health as last known (§5.5)
 *
 * Every step is reconciliation-based ("expire everything already past due")
 * rather than incremental, which is what Vercel's best-effort delivery needs:
 * a missed run is caught up by the next one, and a duplicate run is a no-op.
 * `maxDuration` 60s is well inside the 5 minute interval, so two runs cannot
 * overlap and no lock is needed.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.nextUrl.searchParams.get("secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  // Fail closed. Treating a missing secret as "no auth required" would turn a
  // deleted env var into a public endpoint that anyone can use to re-drive
  // message processing.
  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 1. stuck inbound messages
  const now = Date.now();
  const stuck = await db
    .select()
    .from(inboundMessages)
    .where(
      and(
        isNull(inboundMessages.processedAt),
        lt(inboundMessages.at, new Date(now - 2 * 60_000)),
        // A rate limited message gives its attempt back (handler.ts), so this
        // counter only bounds messages that are actually failing. Time bounds
        // the rest.
        gt(inboundMessages.at, new Date(now - RETRY_WINDOW_MS)),
        lt(inboundMessages.attempts, MAX_ATTEMPTS),
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
    try {
      await handleInbound(parsed.message as InboundMessage);
      reprocessed++;
    } catch (e) {
      // handleInbound handles its own failures, so reaching here means its
      // bookkeeping itself failed. One bad message must not cost this tick its
      // expiries, nudges and retention sweep.
      console.error("[cron] reprocess", row.id, e);
    }
  }

  // 1b. Past the retry window and still unprocessed. Without this they would
  // sit in the partial index forever and keep inflating "waiting messages".
  const abandoned = await db
    .update(inboundMessages)
    .set({ processedAt: new Date(), error: sql`coalesce(${inboundMessages.error}, 'abandoned: retry window elapsed')` })
    .where(
      and(
        isNull(inboundMessages.processedAt),
        lt(inboundMessages.at, new Date(now - RETRY_WINDOW_MS)),
      ),
    )
    .returning({ id: inboundMessages.id });

  // 2. expire quotes
  //
  // Spelled as the statuses that ARE open rather than the ones that are not,
  // even though the enum makes the two identical: Postgres cannot prove that
  // `not in (approved, rejected, expired)` implies `in (draft, sent, viewed)`,
  // so the negated form does not match `quotes_open_valid_until_idx` and falls
  // back to scanning every quote ever written, every five minutes.
  const expired = await db
    .update(quotes)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(lte(quotes.validUntil, new Date()), inArray(quotes.status, OPEN_QUOTE_STATUSES)))
    .returning({ id: quotes.id });

  // 3. nudge the professional about quotes that went quiet
  const reminded = await sendFollowUps().catch((e) => {
    console.error("[cron] follow-ups", e);
    return 0;
  });

  // 3b. nudge whoever finished setup and never wrote a first quote
  const activated = await sendActivationNudges().catch((e) => {
    console.error("[cron] activation", e);
    return 0;
  });

  const purgedLinks = await purgeExpiredLinks();

  // 4. retention. Bounded per run, and never allowed to fail the tick - the
  // steps above are what users feel, this one is housekeeping.
  const purgedLogs = await purgeOldLogs().catch((e) => {
    console.error("[cron] retention", e);
    return null;
  });

  const instanceStatus = await getSetting("ibot.instance_status");
  const lastWebhookAt = await getSetting("ibot.last_webhook_at");

  return NextResponse.json({
    ok: true,
    reprocessed,
    abandoned: abandoned.length,
    expired: expired.length,
    reminded,
    activated,
    purgedLinks,
    purgedLogs,
    instanceStatus,
    lastWebhookAt,
  });
}

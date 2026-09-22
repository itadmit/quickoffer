import { and, asc, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { notifications } from "../conversation/messages";
import { db } from "../db";
import { quotes, users } from "../db/schema";
import { isMobile } from "../phone";
import { sendText } from "../whatsapp";
import { sendLink } from "./links";
import { addEvent } from "./service";

/**
 * Quotes that went quiet (PRODUCT.md §6.6).
 *
 * "סגור עסקה" is the promise; a quote nobody follows up on is the most common
 * way it is broken. The bot nudges the professional - never the customer -
 * because the customer must only ever hear from a number they know.
 */

/** First nudge: long enough that the customer had a real chance to answer. */
const FIRST_AFTER_MS = 3 * 86_400_000;
/** Second nudge, counted from the first. There is no third. */
const SECOND_AFTER_MS = 4 * 86_400_000;
export const MAX_REMINDERS = 2;

/** Nudges land between these hours, Israel time. Nobody wants this at 03:00. */
const QUIET_BEFORE_HOUR = 8;
const QUIET_AFTER_HOUR = 21;

const BATCH = 20;

export function isQuietHour(now: Date, timeZone = "Asia/Jerusalem"): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(now),
  );
  return hour < QUIET_BEFORE_HOUR || hour >= QUIET_AFTER_HOUR;
}

/** Whole days between two instants, floored - what the message quotes. */
export function daysSince(from: Date, now: Date): number {
  return Math.max(1, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}

/**
 * Send the due nudges. Called from the cron tick; returns how many went out.
 * Safe to call often: `remindersSent` / `lastReminderAt` make it idempotent.
 */
export async function sendFollowUps(now = new Date()): Promise<number> {
  if (isQuietHour(now)) return 0;

  const due = await db
    .select({ quote: quotes, user: users })
    .from(quotes)
    .innerJoin(users, eq(users.id, quotes.userId))
    .where(
      and(
        inArray(quotes.status, ["sent", "viewed"]),
        eq(users.blocked, false),
        lt(quotes.remindersSent, MAX_REMINDERS),
        // never chase a quote that is no longer on the table
        or(sql`${quotes.validUntil} is null`, sql`${quotes.validUntil} > ${now}`),
        or(
          and(
            eq(quotes.remindersSent, 0),
            isNotNull(sql`coalesce(${quotes.firstViewedAt}, ${quotes.sentAt})`),
            lt(
              sql`coalesce(${quotes.firstViewedAt}, ${quotes.sentAt})`,
              new Date(now.getTime() - FIRST_AFTER_MS),
            ),
          ),
          and(
            sql`${quotes.remindersSent} > 0`,
            lt(quotes.lastReminderAt, new Date(now.getTime() - SECOND_AFTER_MS)),
          ),
        ),
      ),
    )
    .orderBy(asc(quotes.lastReminderAt), asc(quotes.createdAt))
    .limit(BATCH);

  let sent = 0;
  for (const { quote, user } of due) {
    try {
      const since = quote.firstViewedAt ?? quote.sentAt ?? quote.createdAt;
      const url = isMobile(quote.customerPhone) ? await sendLink(quote.id) : null;
      await sendText(user.phone, notifications.followUp(quote, daysSince(since, now), url));
      await db
        .update(quotes)
        .set({
          lastReminderAt: now,
          remindersSent: sql`${quotes.remindersSent} + 1`,
        })
        .where(eq(quotes.id, quote.id));
      await addEvent(quote.id, "reminded", { days: daysSince(since, now), status: quote.status });
      sent++;
    } catch (err) {
      console.error("[follow-up]", quote.id, err);
    }
  }
  return sent;
}

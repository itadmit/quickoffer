import { and, asc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { isQuietHour } from "../quotes/follow-up";
import { sendText } from "../whatsapp";
import { activation } from "./messages";

/**
 * Finished setup, never wrote a quote.
 *
 * This is the one gap in the funnel the product cannot talk its way out of:
 * someone answered three questions, got told "הכול מוכן", and then nothing.
 * They are not stuck on a price or a template - they just never said the first
 * sentence. So the nudge says it for them (lib/conversation/messages.ts).
 *
 * Same discipline as the quote follow-ups: the professional only, bounded,
 * daytime only, idempotent through a counter rather than a "sent" log.
 */

/**
 * First nudge: an hour of silence. Long enough that we are not interrupting
 * someone who is still reading the setup message, short enough to land while
 * QuickOffer is still the thing they were doing today.
 */
const FIRST_AFTER_MS = 60 * 60_000;
/** Second nudge, counted from the first. There is no third. */
const SECOND_AFTER_MS = 24 * 60 * 60_000;
export const MAX_ACTIVATION_NUDGES = 2;

const BATCH = 20;

/**
 * Send the due activation nudges. Called from the cron tick; returns how many
 * went out. Safe to call often - `activationNudges` / `activationNudgeAt` make
 * it idempotent, and a user who replies anything at all pushes `lastActiveAt`
 * forward and so resets the first hour.
 */
export async function sendActivationNudges(now = new Date()): Promise<number> {
  if (isQuietHour(now)) return 0;

  const due = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.onboardingState, "done"),
        eq(users.blocked, false),
        lt(users.activationNudges, MAX_ACTIVATION_NUDGES),
        // The whole point: one quote, ever, and this user is activated. Written
        // as raw SQL because Drizzle's `sql` does not qualify column names
        // inside a correlated subquery - `${quotes.userId} = ${users.id}`
        // renders as `"user_id" = "id"`, which is ambiguous here.
        sql`not exists (select 1 from quotes q where q.user_id = users.id)`,
        or(
          and(
            eq(users.activationNudges, 0),
            lt(users.lastActiveAt, new Date(now.getTime() - FIRST_AFTER_MS)),
          ),
          and(
            sql`${users.activationNudges} > 0`,
            lt(users.activationNudgeAt, new Date(now.getTime() - SECOND_AFTER_MS)),
          ),
        ),
      ),
    )
    .orderBy(asc(users.lastActiveAt))
    .limit(BATCH);

  let sent = 0;
  for (const user of due) {
    try {
      const text =
        user.activationNudges === 0 ? activation.first(user.businessName) : activation.last();
      await sendText(user.phone, text);
      await db
        .update(users)
        .set({
          activationNudgeAt: now,
          activationNudges: sql`${users.activationNudges} + 1`,
        })
        .where(eq(users.id, user.id));
      sent++;
    } catch (err) {
      console.error("[activation]", user.id, err);
    }
  }
  return sent;
}

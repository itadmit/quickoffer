import type { User } from "../db/schema";
import { getSetting } from "../settings";
import { sendText } from "../whatsapp";
import { admin as msg } from "./messages";

/**
 * Internal alerts to whoever runs the business - today "someone new wrote to
 * the bot", which is the one event a paid campaign is bought to produce.
 *
 * Two rules this must never break:
 *
 * 1. **A failed alert must never cost the user a reply.** Everything is
 *    swallowed, exactly like the Meta CAPI calls next to it.
 * 2. **Recipients are addresses, not phone numbers.** `sendText` routes by
 *    address (`gatewayFor`), so "tg:<chatId>" works here for free and an
 *    admin on Telegram needs no extra code.
 */
async function recipients(): Promise<string[]> {
  const raw = await getSetting("admin.notify");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function notifyNewUser(user: User): Promise<void> {
  try {
    const to = await recipients();
    if (!to.length) return;
    const text = msg.newUser(user);
    // Serial on purpose - the outgoing queue is serial anyway, and two admins
    // is not a fan-out worth parallelising.
    for (const address of to) {
      // Never alert an admin about themselves signing up.
      if (address === user.phone) continue;
      await sendText(address, text);
    }
  } catch (err) {
    console.error("[admin-notify] new user alert failed", err);
  }
}

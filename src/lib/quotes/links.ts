import { and, eq, gt, lt } from "drizzle-orm";
import { verifyToken } from "../crypto";
import { db } from "../db";
import { magicLinks } from "../db/schema";
import { newLinkCode } from "../ids";
import { getSetting } from "../settings";

const EDIT_TTL_MS = 7 * 24 * 3600 * 1000; // §8.1 - 7 days
const SETTINGS_TTL_MS = 30 * 24 * 3600 * 1000;
// Reuse an existing code while it still has at least this long to live,
// so "ערוך" twice in a row gives the same short link.
const REUSE_MIN_REMAINING_MS = 24 * 3600 * 1000;

/** e = edit a quote · s = business settings · w = one-tap send to the customer */
type Purpose = "e" | "s" | "w";

export async function appUrl(): Promise<string> {
  return (await getSetting("app.url")).replace(/\/$/, "");
}

async function codeFor(purpose: Purpose, subject: string, ttlMs: number): Promise<string> {
  const existing = await db.query.magicLinks.findFirst({
    where: and(
      eq(magicLinks.purpose, purpose),
      eq(magicLinks.subject, subject),
      gt(magicLinks.expiresAt, new Date(Date.now() + REUSE_MIN_REMAINING_MS)),
    ),
  });
  if (existing) return existing.code;

  // Retry on the (astronomically unlikely) collision
  for (let i = 0; i < 3; i++) {
    const code = newLinkCode();
    const inserted = await db
      .insert(magicLinks)
      .values({ code, purpose, subject, expiresAt: new Date(Date.now() + ttlMs) })
      .onConflictDoNothing()
      .returning({ code: magicLinks.code });
    if (inserted.length) return code;
  }
  throw new Error("could not allocate magic link code");
}

/**
 * Resolve /e/{code} or /s/{code} → subject id, or null.
 * Old-style signed tokens (contain a ".") keep working until they expire.
 */
export async function resolveLink(code: string, purpose: Purpose): Promise<string | null> {
  // Legacy signed tokens only ever existed for edit and settings links.
  if (code.includes(".")) {
    return purpose === "w" ? null : (verifyToken(code, purpose)?.s ?? null);
  }
  const row = await db.query.magicLinks.findFirst({
    where: and(eq(magicLinks.code, code), eq(magicLinks.purpose, purpose), gt(magicLinks.expiresAt, new Date())),
  });
  if (!row) return null;
  void db.update(magicLinks).set({ lastUsedAt: new Date() }).where(eq(magicLinks.code, code)).catch(() => {});
  return row.subject;
}

export async function purgeExpiredLinks(): Promise<number> {
  const gone = await db.delete(magicLinks).where(lt(magicLinks.expiresAt, new Date())).returning({ code: magicLinks.code });
  return gone.length;
}

export async function editLink(quoteId: string): Promise<string> {
  return `${await appUrl()}/e/${await codeFor("e", quoteId, EDIT_TTL_MS)}`;
}

/**
 * One-tap send to the customer: a short link that redirects to WhatsApp with
 * the chat open and the message ready (app/w/[code]).
 *
 * It is a redirect rather than a raw wa.me URL for two reasons: a 300-character
 * link is unreadable in a chat bubble, and the message is rebuilt on every tap -
 * so fixing the quote after sending the link still sends the corrected text.
 */
export async function sendLink(quoteId: string): Promise<string> {
  return `${await appUrl()}/w/${await codeFor("w", quoteId, EDIT_TTL_MS)}`;
}

export async function publicLink(publicId: string): Promise<string> {
  return `${await appUrl()}/q/${publicId}`;
}

export async function settingsLink(userId: string): Promise<string> {
  return `${await appUrl()}/s/${await codeFor("s", userId, SETTINGS_TTL_MS)}`;
}

/** The upgrade screen. Shares the settings code - same subject, same lifetime. */
export async function upgradeLink(userId: string): Promise<string> {
  return `${await appUrl()}/u/${await codeFor("s", userId, SETTINGS_TTL_MS)}`;
}

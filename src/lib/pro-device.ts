import { cookies } from "next/headers";
import { makeToken, verifyToken } from "./crypto";

/**
 * Is this browser the professional's own?
 *
 * The bot sends the forwardable customer message - public link included - to
 * the professional, so the first tap on /q/{id} is usually theirs, checking
 * their own work. Reporting that as "הלקוח פתח את ההצעה" is a lie they can
 * catch, and it costs the credibility of every later notification.
 *
 * The customer's browser never sees /w or /e, so a signed cookie dropped on
 * those routes marks the device as the professional's for good. Scoped to a
 * user id rather than a bare flag: a professional who is also someone else's
 * customer still registers as a viewer on that other quote.
 */

export const PRO_DEVICE_COOKIE = "qo_pro";
const TTL_SECONDS = 180 * 24 * 3600;

export function proDeviceToken(userId: string): string {
  return makeToken("d", userId, TTL_SECONDS);
}

export const proDeviceCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TTL_SECONDS,
} as const;

/** Never let a missing TOKEN_SECRET break a page - this is a nicety, not auth. */
export async function markProDevice(userId: string): Promise<void> {
  try {
    (await cookies()).set(PRO_DEVICE_COOKIE, proDeviceToken(userId), proDeviceCookieOptions);
  } catch (e) {
    console.error("[proDevice] set", e);
  }
}

export async function isProDevice(userId: string): Promise<boolean> {
  try {
    const raw = (await cookies()).get(PRO_DEVICE_COOKIE)?.value;
    return !!raw && verifyToken(raw, "d")?.s === userId;
  } catch {
    return false;
  }
}

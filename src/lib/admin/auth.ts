import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { makeToken, safeEqual, verifyToken } from "../crypto";

const COOKIE = "qo_admin";
const TTL = 12 * 3600;

export async function isAdmin(): Promise<boolean> {
  const c = (await cookies()).get(COOKIE)?.value;
  return !!c && !!verifyToken(c, "a");
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(password, expected);
}

export async function startAdminSession() {
  (await cookies()).set(COOKIE, makeToken("a", "admin", TTL), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: TTL,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

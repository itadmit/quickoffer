import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { quotes, type User } from "../db/schema";

/** PRODUCT.md §11 — plan limits. Trial is a lifetime total, others are per calendar month. */
const LIMITS: Record<User["plan"], { limit: number; monthly: boolean; label: string }> = {
  trial: { limit: 5, monthly: false, label: "ניסיון" },
  basic: { limit: 20, monthly: true, label: "Basic" },
  pro: { limit: 100, monthly: true, label: "Pro" },
  unlimited: { limit: Infinity, monthly: true, label: "Unlimited" },
};

export async function checkQuota(user: User) {
  const plan = LIMITS[user.plan];
  if (plan.limit === Infinity) return { ok: true, used: 0, limit: Infinity, planLabel: plan.label };
  const where = plan.monthly
    ? and(eq(quotes.userId, user.id), gte(quotes.createdAt, startOfMonth()))
    : eq(quotes.userId, user.id);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quotes)
    .where(where);
  return { ok: count < plan.limit, used: count, limit: plan.limit, planLabel: plan.label };
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

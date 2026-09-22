import { PLANS, type Plan } from "../quotes/template-spec";

/**
 * The plan catalogue (PRODUCT.md §11) - the single source of truth for prices
 * and features. The landing page, the upgrade screen, the quota messages and
 * the plans seeded into the billing hub all read from here, so they cannot
 * drift into quoting three different numbers.
 *
 * `plan` doubles as the hub's `plan_code`.
 */

export type PlanOffer = {
  plan: Plan;
  name: string;
  /** monthly price in ILS, before VAT */
  price: number;
  /** strike-through price, when this is a launch offer */
  listPrice?: number;
  badge?: string;
  quota: string;
  features: string[];
  highlight?: boolean;
};

export const PLAN_OFFERS: PlanOffer[] = [
  {
    plan: "trial",
    name: "ניסיון",
    price: 0,
    quota: "5 הצעות, סה״כ",
    features: ["כל היכולות", "בלי כרטיס אשראי"],
  },
  {
    plan: "basic",
    name: "Basic",
    price: 29,
    listPrice: 49,
    badge: "מחיר השקה",
    quota: "20 הצעות בחודש",
    features: ["הלוגו שלך על ההצעה", "אישור וחתימה של הלקוח", "התראות ב-WhatsApp", "השלמת מחירים מהקטלוג"],
    highlight: true,
  },
  {
    plan: "pro",
    name: "Pro",
    price: 99,
    quota: "100 הצעות בחודש",
    features: ["הכול ב-Basic", "בלי מיתוג QuickOffer", "תזכורות אוטומטיות", "כל התבניות"],
  },
  {
    plan: "unlimited",
    name: "Unlimited",
    price: 149,
    quota: "ללא הגבלה",
    features: ["הכול ב-Pro", "שליחה מהמספר שלך", "סליקת מקדמות"],
  },
];

const PAID_PLANS = ["basic", "pro", "unlimited"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(p: Plan): p is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(p);
}

/** Higher-tier plans only: nobody upgrades sideways or down from a page. */
export function upgradesFor(current: Plan): PlanOffer[] {
  const rank = PLANS.indexOf(current);
  return PLAN_OFFERS.filter((o) => PLANS.indexOf(o.plan) > rank);
}

export function priceOf(plan: Plan): number {
  return PLAN_OFFERS.find((o) => o.plan === plan)?.price ?? 0;
}

/**
 * Where "שדרג" goes when the billing hub is not configured: a WhatsApp message
 * to us. Manual, but a path - which beats the dead end this replaced.
 */
export function manualUpgradeLink(botPhone: string, plan: Plan): string {
  const digits = botPhone.replace(/\D/g, "");
  const text = `היי, אני רוצה לשדרג לחבילת ${planName(plan)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function planName(plan: Plan): string {
  return PLAN_OFFERS.find((o) => o.plan === plan)?.name ?? plan;
}

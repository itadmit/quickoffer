import { getSetting, getSettings } from "./settings";
import { PLANS, type Plan } from "./quotes/template-spec";

/**
 * Plans and how one is bought (PRODUCT.md §11).
 *
 * The checkout URL per plan is configured in /admin, not hard-coded: the demo
 * takes payment by hand, a provider gets wired later, and neither should need a
 * deploy. When a plan has no URL we fall back to a WhatsApp message to the bot
 * number, which is still a path to paying - unlike the dead end we had.
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

const CHECKOUT_KEYS = {
  basic: "billing.checkout_basic",
  pro: "billing.checkout_pro",
  unlimited: "billing.checkout_unlimited",
} as const;

export type PaidPlan = keyof typeof CHECKOUT_KEYS;

export function isPaidPlan(p: Plan): p is PaidPlan {
  return p !== "trial";
}

/** Higher-tier plans only: nobody upgrades sideways or down from a page. */
export function upgradesFor(current: Plan): PlanOffer[] {
  const rank = PLANS.indexOf(current);
  return PLAN_OFFERS.filter((o) => PLANS.indexOf(o.plan) > rank);
}

/**
 * Where "שדרג" goes for each plan. Falls back to a prefilled WhatsApp message
 * to the bot number so the professional can always reach a human.
 */
export async function checkoutUrls(): Promise<Record<PaidPlan, string>> {
  const [s, phone] = await Promise.all([
    getSettings([CHECKOUT_KEYS.basic, CHECKOUT_KEYS.pro, CHECKOUT_KEYS.unlimited]),
    getSetting("bot.phone"),
  ]);
  const digits = phone.replace(/\D/g, "");
  const ask = (plan: PaidPlan) =>
    `https://wa.me/${digits}?text=${encodeURIComponent(`היי, אני רוצה לשדרג לחבילת ${planName(plan)}`)}`;

  return {
    basic: s[CHECKOUT_KEYS.basic] || ask("basic"),
    pro: s[CHECKOUT_KEYS.pro] || ask("pro"),
    unlimited: s[CHECKOUT_KEYS.unlimited] || ask("unlimited"),
  };
}

export function planName(plan: Plan): string {
  return PLAN_OFFERS.find((o) => o.plan === plan)?.name ?? plan;
}

import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { ArrowLeft, Sparkles, TriangleAlert } from "lucide-react";
import { LinkExpired } from "@/components/link-expired";
import { isBillingConfigured } from "@/lib/billing/hub";
import { manualUpgradeLink, planName, upgradesFor } from "@/lib/billing/plans";
import { checkQuota } from "@/lib/conversation/quota";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveLink } from "@/lib/quotes/links";
import { getSetting } from "@/lib/settings";
import { UpgradePicker } from "./upgrade-picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "שדרוג חבילה - QuickOffer" };

/**
 * /u/{code} - the upgrade screen.
 *
 * Reached from the quota message, the locked-template message and the settings
 * screen. Uses the settings magic link, so there is nothing new to hand out and
 * nothing new to expire.
 *
 * Nothing here changes a plan. It collects what an invoice needs, records the
 * card-storage consent, and hands off to the billing hub's hosted page; the
 * plan moves when the hub says the money moved.
 */
export default async function UpgradePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const subject = await resolveLink(token, "s");
  const user = subject ? await db.query.users.findFirst({ where: eq(users.id, subject) }) : null;

  if (!user) return <LinkExpired hint="שלח “הגדרות” לבוט ב-WhatsApp לקבלת קישור חדש." />;

  const [quota, configured, botPhone] = await Promise.all([
    checkQuota(user),
    isBillingConfigured(),
    getSetting("bot.phone"),
  ]);
  const offers = upgradesFor(user.plan);
  const atLimit = !quota.ok;
  const pastDue = !!user.billingPastDueAt;

  // Until the hub is wired up, every card links to a WhatsApp message to us -
  // manual, but a path to paying rather than a dead end.
  const manualLinks = configured
    ? null
    : Object.fromEntries(offers.map((o) => [o.plan, manualUpgradeLink(botPhone, o.plan)]));

  return (
    <main className="flex-1 w-full max-w-lg mx-auto p-4 pb-12 space-y-6">
      <header className="space-y-2 pt-2">
        <a href={`/s/${token}`} className="inline-flex items-center gap-1 text-sm text-muted">
          <ArrowLeft className="h-4 w-4 rotate-180" /> חזרה להגדרות
        </a>
        <h1 className="text-2xl font-bold">{atLimit ? "נגמרו ההצעות בחבילה" : "שדרוג חבילה"}</h1>
        <p className="text-muted text-sm leading-relaxed">
          {atLimit
            ? `השתמשת ב-${quota.used} מתוך ${quota.limit} ההצעות של חבילת ${quota.planLabel}. שדרוג פותח אותן מיד.`
            : `אתה בחבילת ${planName(user.plan)}. הצעה אחת שנסגרת בזכות זה מחזירה את העלות.`}
        </p>
      </header>

      {pastDue && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 flex gap-3 text-sm">
          <TriangleAlert className="h-5 w-5 text-danger shrink-0" />
          <p className="leading-relaxed">
            החיוב האחרון לא עבר. בחר חבילה והזן אמצעי תשלום מעודכן - החבילה תמשיך בלי הפסקה.
          </p>
        </div>
      )}

      {offers.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-5 text-center space-y-1">
          <Sparkles className="h-6 w-6 mx-auto text-brand" />
          <div className="font-bold">אתה בחבילה הגבוהה ביותר</div>
          <p className="text-sm text-muted">הצעות ללא הגבלה. אין מה לשדרג.</p>
        </div>
      ) : (
        <UpgradePicker
          token={token}
          offers={offers}
          email={user.billingEmail}
          vatNumber={user.taxId}
          manualLinks={manualLinks}
        />
      )}

      <p className="text-xs text-muted text-center leading-relaxed">
        המחירים בש״ח לחודש, לפני מע״מ. החיוב חוזר כל חודש וניתן לבטל בכל עת - ההצעות שכבר נשלחו
        נשארות פעילות.
      </p>
    </main>
  );
}

import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { LinkExpired } from "@/components/link-expired";
import { checkoutUrls, isPaidPlan, planName, upgradesFor, type PlanOffer } from "@/lib/billing";
import { checkQuota } from "@/lib/conversation/quota";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveLink } from "@/lib/quotes/links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "שדרוג חבילה - QuickOffer" };

/**
 * /u/{code} - the upgrade screen.
 *
 * Reached from the quota message, the locked-template message and the settings
 * screen. Uses the settings magic link, so there is nothing new to hand out and
 * nothing new to expire.
 */
export default async function UpgradePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const subject = await resolveLink(token, "s");
  const user = subject ? await db.query.users.findFirst({ where: eq(users.id, subject) }) : null;

  if (!user) return <LinkExpired hint="שלח “הגדרות” לבוט ב-WhatsApp לקבלת קישור חדש." />;

  const [quota, urls] = await Promise.all([checkQuota(user), checkoutUrls()]);
  const offers = upgradesFor(user.plan);
  const atLimit = !quota.ok;

  return (
    <main className="flex-1 w-full max-w-lg mx-auto p-4 pb-12 space-y-6">
      <header className="space-y-2 pt-2">
        <a href={`/s/${token}`} className="inline-flex items-center gap-1 text-sm text-muted">
          <ArrowLeft className="h-4 w-4 rotate-180" /> חזרה להגדרות
        </a>
        <h1 className="text-2xl font-bold">
          {atLimit ? "נגמרו ההצעות בחבילה" : "שדרוג חבילה"}
        </h1>
        <p className="text-muted text-sm leading-relaxed">
          {atLimit
            ? `השתמשת ב-${quota.used} מתוך ${quota.limit} ההצעות של חבילת ${quota.planLabel}. שדרוג פותח אותן מיד.`
            : `אתה בחבילת ${planName(user.plan)}. הצעה אחת שנסגרת בזכות זה מחזירה את העלות.`}
        </p>
      </header>

      {offers.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-5 text-center space-y-1">
          <Sparkles className="h-6 w-6 mx-auto text-brand" />
          <div className="font-bold">אתה בחבילה הגבוהה ביותר</div>
          <p className="text-sm text-muted">הצעות ללא הגבלה. אין מה לשדרג.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <PlanCard
              key={offer.plan}
              offer={offer}
              href={isPaidPlan(offer.plan) ? urls[offer.plan] : "#"}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted text-center leading-relaxed">
        המחירים בש״ח לחודש, לפני מע״מ. אפשר לבטל בכל עת - ההצעות שכבר נשלחו נשארות פעילות.
      </p>
    </main>
  );
}

function PlanCard({ offer, href }: { offer: PlanOffer; href: string }) {
  return (
    <section
      className={`relative rounded-2xl border p-5 space-y-4 ${
        offer.highlight ? "border-brand bg-card ring-1 ring-brand/30" : "border-line bg-card"
      }`}
    >
      {offer.badge && (
        <span className="absolute -top-2.5 start-5 rounded-full bg-warn text-warn-ink text-xs font-semibold px-2.5 py-0.5">
          {offer.badge}
        </span>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-bold text-lg">{offer.name}</div>
          <div className="text-sm text-muted">{offer.quota}</div>
        </div>
        <div className="flex items-baseline gap-1.5 shrink-0">
          {offer.listPrice && (
            <span className="text-base font-semibold text-muted line-through">{offer.listPrice}</span>
          )}
          <span className="text-3xl font-bold">{offer.price}</span>
          <span className="text-muted text-sm">₪ / חודש</span>
        </div>
      </div>

      <ul className="text-sm space-y-1.5">
        {offer.features.map((f) => (
          <li key={f} className="flex gap-2 items-start">
            <Check className="h-4 w-4 mt-0.5 shrink-0 text-brand" />
            {f}
          </li>
        ))}
      </ul>

      <a
        href={href}
        target="_blank"
        rel="noopener"
        className={offer.highlight ? "btn-primary w-full" : "btn-secondary w-full"}
      >
        שדרג ל-{offer.name}
      </a>
    </section>
  );
}

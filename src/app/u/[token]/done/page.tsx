import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { BadgeCheck, Clock, TriangleAlert } from "lucide-react";
import { LinkExpired } from "@/components/link-expired";
import { planName } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { billingCheckouts, users } from "@/lib/db/schema";
import { resolveLink } from "@/lib/quotes/links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "תשלום - QuickOffer" };

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string }>;
};

/**
 * Where the hosted card page sends the professional back.
 *
 * The redirect is not proof of payment - the hub's webhook is - so a success
 * return that has not been confirmed yet says "מאשרים" rather than claiming
 * the upgrade happened. In practice the webhook lands first; this handles the
 * case where it has not.
 */
export default async function CheckoutDonePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { s } = await searchParams;

  const subject = await resolveLink(token, "s");
  const user = subject ? await db.query.users.findFirst({ where: eq(users.id, subject) }) : null;
  if (!user) return <LinkExpired hint="שלח “הגדרות” לבוט ב-WhatsApp לקבלת קישור חדש." />;

  const latest = await db.query.billingCheckouts.findFirst({
    where: eq(billingCheckouts.userId, user.id),
    orderBy: desc(billingCheckouts.createdAt),
  });

  const failed = s === "fail";
  const confirmed = !failed && latest?.status === "completed";
  const pending = !failed && !confirmed;

  return (
    <main className="flex-1 w-full max-w-lg mx-auto p-4 pt-10 space-y-5">
      {failed && (
        <Card tone="danger" icon={<TriangleAlert className="h-6 w-6 text-danger" />} title="התשלום לא הושלם">
          <p>לא בוצע חיוב. אפשר לנסות שוב, או בכרטיס אחר.</p>
          <a href={`/u/${token}`} className="btn-primary w-full mt-1">חזרה לבחירת חבילה</a>
        </Card>
      )}

      {confirmed && (
        <Card tone="ok" icon={<BadgeCheck className="h-6 w-6 text-ok" />} title={`חבילת ${planName(user.plan)} פעילה`}>
          <p>המכסה נפתחה. החשבונית נשלחה ל-{user.billingEmail}.</p>
          <p className="text-muted">שלח הודעה קולית לבוט וההצעה הבאה כבר על החבילה החדשה.</p>
          <a href={`/s/${token}`} className="btn-secondary w-full mt-1">להגדרות העסק</a>
        </Card>
      )}

      {pending && (
        <Card tone="warn" icon={<Clock className="h-6 w-6" />} title="מאשרים את התשלום">
          <p>זה לוקח כמה שניות. נעדכן אותך ב-WhatsApp ברגע שזה נסגר.</p>
          <p className="text-muted">אפשר לסגור את הדף - זה ימשיך ברקע.</p>
          <a href={`/s/${token}`} className="btn-secondary w-full mt-1">להגדרות העסק</a>
        </Card>
      )}
    </main>
  );
}

function Card({
  tone,
  icon,
  title,
  children,
}: {
  tone: "ok" | "warn" | "danger";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-ok/40 bg-ok/5"
      : tone === "danger"
        ? "border-danger/40 bg-danger/5"
        : "border-warn-ink/30 bg-warn";
  return (
    <div className={`rounded-2xl border p-5 space-y-3 text-sm ${cls}`}>
      <div className="flex items-center gap-3">
        <span className="anim-seal grid place-items-center h-11 w-11 rounded-full bg-card/70 shrink-0">
          {icon}
        </span>
        <h1 className="text-lg font-bold">{title}</h1>
      </div>
      {children}
    </div>
  );
}

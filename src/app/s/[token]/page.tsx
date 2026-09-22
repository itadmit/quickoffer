import type { Metadata } from "next";
import { resolveLink } from "@/lib/quotes/links";
import { Link2Off } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { planAllows, PLAN_LABELS } from "@/lib/quotes/template-spec";
import { listTemplates, specOf } from "@/lib/quotes/templates";
import { checkQuota } from "@/lib/conversation/quota";
import { formatPhone } from "@/components/quote-document";
import { SettingsEditor } from "./settings-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "הגדרות העסק - QuickOffer" };

export default async function SettingsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const subject = await resolveLink(token, "s");
  const user = subject ? await db.query.users.findFirst({ where: eq(users.id, subject) }) : null;

  if (!user) {
    return (
      <main className="flex-1 grid place-items-center p-6 text-center">
        <div className="space-y-2">
          <Link2Off className="h-10 w-10 mx-auto text-muted" />
          <h1 className="text-xl font-bold">הקישור לא תקף</h1>
          <p className="text-muted text-sm">שלח &quot;הגדרות&quot; ב-WhatsApp לקבלת קישור חדש.</p>
        </div>
      </main>
    );
  }

  const templates = (await listTemplates({ enabledOnly: true })).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isDefault: t.isDefault,
    lockedFor: planAllows(user.plan, t.minPlan) ? null : PLAN_LABELS[t.minPlan],
    spec: specOf(t),
  }));

  const quota = await checkQuota(user);

  return (
    <SettingsEditor
      token={token}
      templates={templates}
      quota={quota.limit === Infinity ? null : { used: quota.used, limit: quota.limit, monthly: user.plan !== "trial" }}
      phone={user.channel === "whatsapp" ? user.phone : null}
      plan={user.plan}
      logoUrl={user.logoUrl}
      initial={{
        businessName: user.businessName ?? user.displayName ?? "",
        businessPhone: user.businessPhone ? formatPhone(user.businessPhone) : null,
        address: user.address,
        taxId: user.taxId,
        vatStatus: user.vatStatus,
        defaultPaymentTerms: user.defaultPaymentTerms,
        defaultNotes: user.defaultNotes ?? [],
        defaultValidDays: user.defaultValidDays,
        nextQuoteNumber: user.nextQuoteNumber,
        templateId: user.templateId,
      }}
    />
  );
}

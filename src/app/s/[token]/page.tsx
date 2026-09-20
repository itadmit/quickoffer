import type { Metadata } from "next";
import { Link2Off } from "lucide-react";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { SettingsEditor } from "./settings-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "הגדרות העסק - QuickVoice" };

export default async function SettingsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = verifyToken(token, "s");
  const user = payload ? await db.query.users.findFirst({ where: eq(users.id, payload.s) }) : null;

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

  return (
    <SettingsEditor
      token={token}
      phone={user.phone}
      plan={user.plan}
      logoUrl={user.logoUrl}
      initial={{
        businessName: user.businessName ?? user.displayName ?? "",
        businessPhone: user.businessPhone,
        address: user.address,
        taxId: user.taxId,
        vatStatus: user.vatStatus,
        defaultPaymentTerms: user.defaultPaymentTerms,
        defaultNotes: user.defaultNotes ?? [],
        defaultValidDays: user.defaultValidDays,
        nextQuoteNumber: user.nextQuoteNumber,
      }}
    />
  );
}

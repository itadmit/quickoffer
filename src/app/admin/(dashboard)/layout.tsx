import Link from "next/link";
import { Mic } from "lucide-react";
import { redirect } from "next/navigation";
import { endAdminSession, requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "סקירה"],
  ["/admin/ai", "ספקי AI"],
  ["/admin/ibot", "iBot"],
  ["/admin/telegram", "טלגרם"],
  ["/admin/users", "משתמשים"],
  ["/admin/quotes", "הצעות"],
  ["/admin/templates", "תבניות"],
  ["/admin/messages", "לוג הודעות"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex-1 flex flex-col">
      <nav className="border-b border-line bg-card px-4 py-2 flex items-center gap-1 overflow-x-auto text-sm">
        <span className="font-bold me-3 inline-flex items-center gap-1.5"><Mic className="h-4 w-4 text-brand" /> QuickOffer</span>
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="px-3 py-1.5 rounded-lg hover:bg-surface whitespace-nowrap">
            {label}
          </Link>
        ))}
        <form action={logout} className="ms-auto">
          <button className="text-muted hover:text-ink px-2">יציאה</button>
        </form>
      </nav>
      <div className="flex-1 w-full max-w-6xl mx-auto p-4">{children}</div>
    </div>
  );
}

async function logout() {
  "use server";
  await endAdminSession();
  redirect("/admin/login");
}

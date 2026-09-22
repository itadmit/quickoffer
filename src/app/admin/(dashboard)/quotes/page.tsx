import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes, users } from "@/lib/db/schema";
import { formatMoney } from "@/lib/quotes/calc";
import { STATUS_LABELS, StatusBadge } from "@/components/status-badge";

const STATUSES = Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[];

export default async function AdminQuotes({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "" } = await searchParams;
  const statusFilter = (STATUSES as string[]).includes(status) ? (status as (typeof STATUSES)[number]) : null;
  const rows = await db
    .select({ quote: quotes, business: users.businessName, phone: users.phone })
    .from(quotes)
    .innerJoin(users, eq(users.id, quotes.userId))
    .where(
      and(
        q ? or(ilike(quotes.customerName, `%${q}%`), ilike(users.businessName, `%${q}%`), ilike(users.phone, `%${q}%`)) : undefined,
        statusFilter ? eq(quotes.status, statusFilter) : undefined,
      ),
    )
    .orderBy(desc(quotes.createdAt))
    .limit(50);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">הצעות</h1>
        <form className="ms-auto flex gap-2">
          <select name="status" defaultValue={status} className="input py-1.5 w-auto">
            <option value="">כל הסטטוסים</option>
            {STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABELS[st][0]}</option>)}
          </select>
          <input name="q" defaultValue={q} className="input py-1.5" placeholder="חיפוש לקוח / עסק / טלפון" />
          <button className="btn-secondary py-1.5">סנן</button>
        </form>
      </div>
      <div className="rounded-2xl border border-line bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted"><tr>
            <th className="p-2 text-start">#</th><th className="p-2 text-start">עסק</th><th className="p-2 text-start">לקוח</th>
            <th className="p-2 text-start">סה״כ</th><th className="p-2 text-start">סטטוס</th><th className="p-2 text-start">נוצר</th><th className="p-2 text-start"></th>
          </tr></thead>
          <tbody>
            {rows.map(({ quote: r, business, phone }) => (
              <tr key={r.id} className="border-t border-line">
                <td className="p-2">{r.number}</td>
                <td className="p-2"><Link href={`/admin/quotes?q=${encodeURIComponent(phone)}`} className="hover:underline">{business ?? phone}</Link></td>
                <td className="p-2">{r.customerName ?? <span className="text-muted">-</span>}</td>
                <td className="p-2 whitespace-nowrap">{formatMoney(r.total)}</td>
                <td className="p-2"><StatusBadge status={r.status} /></td>
                <td className="p-2 whitespace-nowrap">{r.createdAt.toLocaleString("he-IL")}</td>
                <td className="p-2 whitespace-nowrap">
                  <Link href={`/admin/quotes/${r.id}`} className="underline">דיבוג</Link>
                  {" · "}
                  <a href={`/q/${r.publicId}`} target="_blank" className="underline">דף לקוח</a>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="p-4 text-muted">אין הצעות</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

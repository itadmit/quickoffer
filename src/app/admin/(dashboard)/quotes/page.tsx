import Link from "next/link";
import { desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes, users } from "@/lib/db/schema";
import { formatMoney } from "@/lib/quotes/calc";

export default async function AdminQuotes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const rows = await db
    .select({ quote: quotes, business: users.businessName, phone: users.phone })
    .from(quotes)
    .innerJoin(users, eq(users.id, quotes.userId))
    .where(q ? or(ilike(quotes.customerName, `%${q}%`), ilike(users.businessName, `%${q}%`), ilike(users.phone, `%${q}%`)) : undefined)
    .orderBy(desc(quotes.createdAt))
    .limit(50);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">הצעות</h1>
        <form className="ms-auto"><input name="q" defaultValue={q} className="input py-1.5" placeholder="חיפוש לקוח / עסק / טלפון" /></form>
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
                <td className="p-2">{business ?? phone}</td>
                <td className="p-2">{r.customerName ?? <span className="text-muted">—</span>}</td>
                <td className="p-2 whitespace-nowrap">{formatMoney(r.total)}</td>
                <td className="p-2">{r.status}</td>
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

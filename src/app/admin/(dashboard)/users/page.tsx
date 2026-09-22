import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { quoteTemplates, users } from "@/lib/db/schema";
import { settingsLink } from "@/lib/quotes/links";
import { UserRow } from "./user-row";

export default async function AdminUsers() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const rows = await db
    .select({
      user: users,
      templateName: quoteTemplates.name,
      // written with explicit aliases: drizzle renders unqualified column names inside sql`` subqueries,
      // so `quotes.user_id = users.id` would come out as `"user_id" = "id"` (always the quote's own id)
      monthQuotes: sql<number>`(select count(*)::int from quotes q where q.user_id = users.id and q.created_at >= ${startOfMonth})`,
      totalQuotes: sql<number>`(select count(*)::int from quotes q where q.user_id = users.id)`,
    })
    .from(users)
    .leftJoin(quoteTemplates, eq(quoteTemplates.id, users.templateId))
    .orderBy(desc(users.lastActiveAt));
  const settingsLinks = await Promise.all(rows.map((r) => settingsLink(r.user.id)));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">משתמשים ({rows.length})</h1>
      <div className="rounded-2xl border border-line bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="p-2 text-start">טלפון</th>
              <th className="p-2 text-start">עסק</th>
              <th className="p-2 text-start">מע״מ</th>
              <th className="p-2 text-start">אונבורדינג</th>
              <th className="p-2 text-start">חבילה</th>
              <th className="p-2 text-start">עיצוב</th>
              <th className="p-2 text-start">הצעות חודש / סה״כ</th>
              <th className="p-2 text-start">הצטרף</th>
              <th className="p-2 text-start">פעיל לאחרונה</th>
              <th className="p-2 text-start">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <UserRow key={r.user.id} user={r.user} templateName={r.templateName} monthQuotes={r.monthQuotes} totalQuotes={r.totalQuotes} settingsUrl={settingsLinks[i]} />
            ))}
            {!rows.length && <tr><td colSpan={10} className="p-4 text-muted">עדיין אין משתמשים - שלח הודעה לבוט</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

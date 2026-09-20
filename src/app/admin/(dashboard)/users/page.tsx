import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes, users } from "@/lib/db/schema";
import { UserRow } from "./user-row";

export default async function AdminUsers() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const rows = await db
    .select({
      user: users,
      monthQuotes: sql<number>`(select count(*)::int from ${quotes} where ${quotes.userId} = ${users.id} and ${quotes.createdAt} >= ${startOfMonth})`,
      totalQuotes: sql<number>`(select count(*)::int from ${quotes} where ${quotes.userId} = ${users.id})`,
    })
    .from(users)
    .orderBy(desc(users.lastActiveAt));

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
              <th className="p-2 text-start">הצעות חודש / סה״כ</th>
              <th className="p-2 text-start">הצטרף</th>
              <th className="p-2 text-start">פעיל לאחרונה</th>
              <th className="p-2 text-start">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <UserRow key={r.user.id} user={r.user} monthQuotes={r.monthQuotes} totalQuotes={r.totalQuotes} />)}
            {!rows.length && <tr><td colSpan={9} className="p-4 text-muted">עדיין אין משתמשים — שלח הודעה לבוט</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

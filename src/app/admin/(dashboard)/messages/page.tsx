import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { inboundMessages } from "@/lib/db/schema";
import { ReprocessButton } from "./reprocess-button";

export default async function AdminMessages() {
  const rows = await db.select().from(inboundMessages).orderBy(desc(inboundMessages.at)).limit(100);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">לוג הודעות נכנסות</h1>
      <div className="rounded-2xl border border-line bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted"><tr>
            <th className="p-2 text-start">זמן</th><th className="p-2 text-start">מ-</th><th className="p-2 text-start">סוג</th>
            <th className="p-2 text-start">טקסט / מדיה</th><th className="p-2 text-start">עובד</th><th className="p-2 text-start">שגיאה</th><th className="p-2"></th>
          </tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className={`border-t border-line ${m.error ? "bg-danger/5" : !m.processedAt ? "bg-warn/40" : ""}`}>
                <td className="p-2 whitespace-nowrap">{m.at.toLocaleString("he-IL")}</td>
                <td className="p-2" dir="ltr">{m.userPhone}</td>
                <td className="p-2">{m.type}</td>
                <td className="p-2 max-w-sm truncate">{m.text ?? (m.mediaUrl ? <a href={m.mediaUrl} target="_blank" className="underline" dir="ltr">{m.mediaUrl.split("/").pop()}</a> : "—")}</td>
                <td className="p-2 whitespace-nowrap">{m.processedAt ? m.processedAt.toLocaleTimeString("he-IL") : `ממתין (${m.attempts})`}</td>
                <td className="p-2 max-w-xs truncate text-danger text-xs">{m.error}</td>
                <td className="p-2"><ReprocessButton id={m.id} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="p-4 text-muted">אין הודעות</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

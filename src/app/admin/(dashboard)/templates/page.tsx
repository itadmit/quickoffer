import Link from "next/link";
import { count } from "drizzle-orm";
import { Plus } from "lucide-react";
import { TemplateThumb } from "@/components/template-thumb";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { LAYOUT_LABELS } from "@/lib/quotes/template-spec";
import { listTemplates, specOf } from "@/lib/quotes/templates";

export default async function AdminTemplates() {
  const [templates, usage] = await Promise.all([
    listTemplates(),
    db.select({ templateId: users.templateId, n: count() }).from(users).groupBy(users.templateId),
  ]);
  const usersOn = (id: string) => usage.find((u) => u.templateId === id)?.n ?? 0;
  const usersOnDefault = usage.find((u) => u.templateId === null)?.n ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">תבניות הצעה</h1>
        <p className="text-sm text-muted">
          העיצוב שהלקוח רואה. בעל המקצוע בוחר תבנית במסך ההגדרות; מי שלא בחר מקבל את ברירת המחדל ({usersOnDefault} משתמשים).
        </p>
        <Link href="/admin/templates/new" className="btn-primary ms-auto text-sm py-2">
          <Plus className="h-4 w-4" /> תבנית חדשה
        </Link>
      </div>

      {templates.length === 0 && (
        <p className="text-sm text-muted">אין תבניות. הרץ את המיגרציה (db:migrate) או צור תבנית חדשה.</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <Link
            key={t.id}
            href={`/admin/templates/${t.id}`}
            className={`card-hover rounded-2xl border bg-card p-4 flex gap-4 ${t.enabled ? "border-line" : "border-dashed border-line opacity-60"}`}
          >
            <TemplateThumb template={specOf(t)} width={150} height={190} />
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <div className="font-bold text-base flex items-center gap-2">
                {t.name}
                {t.isDefault && <span className="text-[10px] rounded-full bg-brand-soft text-brand px-2 py-0.5">ברירת מחדל</span>}
              </div>
              <div className="text-muted">{t.description}</div>
              <div className="text-xs text-muted pt-1 space-y-0.5">
                <div>
                  layout: {LAYOUT_LABELS[t.layout]} · <code>{t.key}</code>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full border border-line" style={{ background: t.accent }} /> {t.accent}
                </div>
                <div>{usersOn(t.id)} משתמשים{!t.enabled && " · כבוי"}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

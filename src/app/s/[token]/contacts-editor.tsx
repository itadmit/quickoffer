"use client";

import { useState, useTransition } from "react";
import { Contact as ContactIcon, Trash2 } from "lucide-react";
import { formatPhone } from "@/lib/phone";
import { deleteContactAction, saveContactAction } from "./actions";

/**
 * The customer book. Like the saved-jobs editor next to it, there is no "add
 * customer" button on purpose: contacts are born from quotes the professional
 * already wrote, so this screen exists to fix a number, not to key one in.
 *
 * A wrong number here sends one customer's quote to another, so the phone is
 * always shown in full rather than abbreviated, and a save is explicit.
 */

export type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  quoteCount: number;
};

export function ContactsEditor({ token, initial }: { token: string; initial: ContactRow[] }) {
  const [rows, setRows] = useState(initial);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const patch = (id: string, next: Partial<ContactRow>) => {
    setRows((list) => list.map((c) => (c.id === id ? { ...c, ...next } : c)));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  const save = (c: ContactRow) =>
    start(async () => {
      const r = await saveContactAction(token, c.id, { name: c.name, phone: c.phone });
      if (r.ok) {
        setDirty((d) => ({ ...d, [c.id]: false }));
        flash(true, "נשמר ✓");
      } else {
        flash(false, r.error === "invalid" ? "שם או טלפון לא תקינים" : "לא הצלחתי לשמור");
      }
    });

  const remove = (c: ContactRow) =>
    start(async () => {
      const r = await deleteContactAction(token, c.id);
      if (r.ok) {
        setRows((list) => list.filter((x) => x.id !== c.id));
        flash(true, "נמחק");
      } else {
        flash(false, "לא הצלחתי למחוק");
      }
    });

  if (!rows.length) {
    return (
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ContactIcon className="h-5 w-5 text-brand" /> הלקוחות שלי
        </h2>
        <p className="text-sm text-muted">
          עדיין אין לקוחות שמורים. כל הצעה שנכתבת עם שם לקוח נשמרת כאן, ואם נאמר גם טלפון
          (&quot;הטלפון של מריה 050…&quot;) ההצעה הבאה לאותה לקוחה תהיה מוכנה לשליחה בלחיצה אחת.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ContactIcon className="h-5 w-5 text-brand" /> הלקוחות שלי
        </h2>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-brand" : "text-danger"}`}>{msg.text}</span>
        )}
      </div>
      <p className="text-sm text-muted">
        נלמד מההצעות שנכתבו. טלפון ששמור כאן ממלא את עצמו בהצעה הבאה לאותו לקוח.
      </p>
      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.id} className="rounded-2xl border border-line bg-card p-3 space-y-2">
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <label className="block">
                <span className="label">שם</span>
                <input
                  className="input"
                  value={c.name}
                  onChange={(e) => patch(c.id, { name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="label">טלפון</span>
                <input
                  className="input"
                  dir="ltr"
                  inputMode="tel"
                  value={c.phone ? formatPhone(c.phone) : ""}
                  placeholder="050-123-4567"
                  onChange={(e) => patch(c.id, { phone: e.target.value || null })}
                />
              </label>
              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  disabled={pending || !dirty[c.id]}
                  onClick={() => save(c)}
                >
                  שמור
                </button>
                <button
                  className="btn-ghost"
                  disabled={pending}
                  aria-label={`מחיקת ${c.name}`}
                  onClick={() => remove(c)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted">
              {c.quoteCount === 1 ? "הצעה אחת" : `${c.quoteCount} הצעות`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

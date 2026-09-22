"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus, Trash2, Wrench } from "lucide-react";
import { UNITS } from "@/lib/ai/types";
import { formatMoney } from "@/lib/quotes/calc";
import { deleteJobAction, saveJobAction } from "./actions";

/**
 * §6.8 - manage saved jobs. Deliberately has no "new job" button: jobs are
 * born in the chat from a quote that already exists ("תשמור את זה כ…"), so
 * this screen is for fixing a price or a name, never for setting things up.
 */

export type JobItem = { description: string; quantity: number; unit: string; unitPrice: number };
export type Job = { id: string; name: string; items: JobItem[] };

const totalOf = (items: JobItem[]) =>
  Math.round(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0) * 100) / 100;

export function JobsEditor({ token, initial }: { token: string; initial: Job[] }) {
  const [jobs, setJobs] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const patch = (id: string, next: Partial<Job>) =>
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...next } : j)));

  const save = (job: Job) =>
    start(async () => {
      const r = await saveJobAction(token, job.id, { name: job.name, items: job.items });
      if (r.ok) {
        flash(true, "נשמר ✓");
        setOpenId(null);
      } else {
        flash(
          false,
          r.error === "name_taken"
            ? "כבר יש עבודה בשם הזה"
            : "בדוק שיש שם ולפחות פריט אחד עם תיאור",
        );
      }
    });

  const remove = (job: Job) =>
    start(async () => {
      const r = await deleteJobAction(token, job.id);
      if (r.ok) {
        setJobs((list) => list.filter((j) => j.id !== job.id));
        flash(true, `"${job.name}" נמחקה`);
      } else {
        flash(false, "המחיקה נכשלה");
      }
    });

  if (!jobs.length) {
    return (
      <section className="space-y-3">
        <h2 className="font-bold">עבודות שמורות</h2>
        <div className="rounded-2xl border border-line bg-card p-5 text-sm text-muted space-y-2">
          <p className="flex items-center gap-2 text-ink font-medium">
            <Wrench className="h-4 w-4 text-brand" /> עדיין אין עבודות שמורות
          </p>
          <p>
            עבודה שחוזרת על עצמה? כשיש לך הצעה מוכנה, כתוב לעופר{" "}
            <span className="text-ink">״תשמור את זה כהתקנת מזגן״</span> - ובפעם הבאה{" "}
            <span className="text-ink">״התקנת מזגן לדני כהן״</span> יפתח אותה מוכנה.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-bold">עבודות שמורות</h2>
      <p className="text-sm text-muted -mt-2">
        עבודות שחוזרות על עצמן. בצ׳ט: ״{jobs[0].name} לדני כהן״. כאן מעדכנים מחיר או שם.
      </p>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`} role="status">
          {msg.text}
        </p>
      )}

      <div className="space-y-2">
        {jobs.map((job) => {
          const open = openId === job.id;
          return (
            <div key={job.id} className="rounded-2xl border border-line bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : job.id)}
                className="w-full flex items-center gap-3 p-4 text-start"
                aria-expanded={open}
              >
                <Wrench className="h-4 w-4 text-brand shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{job.name}</span>
                  <span className="block text-xs text-muted">
                    {job.items.length} פריטים · {formatMoney(totalOf(job.items))}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              {open && (
                <div className="border-t border-line p-4 space-y-4">
                  <label className="block">
                    <span className="label">שם העבודה</span>
                    <input
                      className="input"
                      value={job.name}
                      maxLength={60}
                      onChange={(e) => patch(job.id, { name: e.target.value })}
                    />
                  </label>

                  <div className="space-y-3">
                    {job.items.map((it, i) => (
                      <div key={i} className="rounded-xl border border-line p-3 space-y-2">
                        <div className="flex gap-2">
                          <input
                            className="input flex-1"
                            placeholder="תיאור"
                            value={it.description}
                            onChange={(e) =>
                              patch(job.id, {
                                items: job.items.map((x, j) =>
                                  j === i ? { ...x, description: e.target.value } : x,
                                ),
                              })
                            }
                          />
                          <button
                            type="button"
                            className="btn-ghost shrink-0"
                            aria-label="מחק פריט"
                            onClick={() =>
                              patch(job.id, { items: job.items.filter((_, j) => j !== i) })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="block">
                            <span className="label">כמות</span>
                            <JobNumber
                              value={it.quantity}
                              onChange={(v) =>
                                patch(job.id, {
                                  items: job.items.map((x, j) =>
                                    j === i ? { ...x, quantity: v } : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="label">יחידה</span>
                            <select
                              className="input"
                              value={it.unit}
                              onChange={(e) =>
                                patch(job.id, {
                                  items: job.items.map((x, j) =>
                                    j === i ? { ...x, unit: e.target.value } : x,
                                  ),
                                })
                              }
                            >
                              {UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="label">מחיר ליח׳</span>
                            <JobNumber
                              value={it.unitPrice}
                              onChange={(v) =>
                                patch(job.id, {
                                  items: job.items.map((x, j) =>
                                    j === i ? { ...x, unitPrice: v } : x,
                                  ),
                                })
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="btn-secondary w-full"
                      onClick={() =>
                        patch(job.id, {
                          items: [
                            ...job.items,
                            { description: "", quantity: 1, unit: "יח׳", unitPrice: 0 },
                          ],
                        })
                      }
                    >
                      <Plus className="h-4 w-4" /> פריט
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-sm text-muted">
                      סה״כ <span className="text-ink font-medium">{formatMoney(totalOf(job.items))}</span>
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost text-danger"
                        disabled={pending}
                        onClick={() => remove(job)}
                      >
                        מחק
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={pending}
                        onClick={() => save(job)}
                      >
                        שמור
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Keeps local text so "1500" can be typed digit by digit (same as the edit screen). */
function JobNumber({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <input
      className="input text-end"
      dir="ltr"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/,/g, "");
        setText(t);
        const n = Number(t);
        if (t !== "" && !Number.isNaN(n)) onChange(n);
        if (t === "") onChange(0);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

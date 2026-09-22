"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "../actions";

type Current = { basic: string; pro: string; unlimited: string; botPhone: string };

const FIELDS = [
  { key: "billing.checkout_basic", plan: "basic", label: "Basic - 29 ₪" },
  { key: "billing.checkout_pro", plan: "pro", label: "Pro - 99 ₪" },
  { key: "billing.checkout_unlimited", plan: "unlimited", label: "Unlimited - 149 ₪" },
] as const;

export function BillingForm({ current }: { current: Current }) {
  const [form, setForm] = useState({
    basic: current.basic,
    pro: current.pro,
    unlimited: current.unlimited,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      await saveSettingsAction({
        "billing.checkout_basic": form.basic,
        "billing.checkout_pro": form.pro,
        "billing.checkout_unlimited": form.unlimited,
      });
      setMsg("נשמר ✓");
      setTimeout(() => setMsg(null), 2500);
    });

  return (
    <section className="rounded-2xl border border-line bg-card p-4 space-y-3">
      <div>
        <h2 className="font-bold">קישורי סליקה</h2>
        <p className="text-sm text-muted">
          לאן מוביל כפתור &quot;שדרג&quot; ב-/u ובהודעות המכסה. שדה ריק = הודעת WhatsApp אל{" "}
          <code dir="ltr">{current.botPhone}</code> (המצב הידני הנוכחי).
        </p>
      </div>
      {FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="label">{f.label}</span>
          <input
            className="input"
            dir="ltr"
            inputMode="url"
            placeholder="https://pay.grow.link/…"
            value={form[f.plan]}
            onChange={(e) => setForm((s) => ({ ...s, [f.plan]: e.target.value }))}
          />
        </label>
      ))}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="btn-primary">
          {pending ? "שומר…" : "שמור"}
        </button>
        {msg && <span className="text-sm text-ok">{msg}</span>}
      </div>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "../actions";
import { pingHubAction } from "./actions";

type Current = {
  hubUrl: string;
  productId: string;
  apiKeySet: boolean;
  apiSecretSet: boolean;
  endpointSecretSet: boolean;
  webhookUrl: string;
  botPhone: string;
};

/**
 * Billing hub connection. Secrets are write-only: an empty field means "leave
 * unchanged" (saveSettingsAction skips empty secrets), so the stored value is
 * never round-tripped through the browser.
 */
export function BillingForm({ current }: { current: Current }) {
  const [hubUrl, setHubUrl] = useState(current.hubUrl);
  const [productId, setProductId] = useState(current.productId);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [endpointSecret, setEndpointSecret] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      await saveSettingsAction({
        "billing.hub_url": hubUrl,
        "billing.product_id": productId,
        "billing.api_key": apiKey,
        "billing.api_secret": apiSecret,
        "billing.endpoint_secret": endpointSecret,
      });
      setApiKey("");
      setApiSecret("");
      setEndpointSecret("");
      setResult("נשמר ✓");
    });

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="rounded-2xl border border-line bg-card p-4 space-y-3">
        <div>
          <h2 className="font-bold">חיבור ל-Billing Hub</h2>
          <p className="text-sm text-muted">
            ההאב מחזיק כרטיסים, חשבוניות, מע״מ ו-dunning. QuickOffer מחזיק רק את המכסה.
          </p>
        </div>

        <label className="block">
          <span className="label">כתובת ההאב</span>
          <input className="input" dir="ltr" value={hubUrl} onChange={(e) => setHubUrl(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Product slug</span>
          <input className="input" dir="ltr" value={productId} onChange={(e) => setProductId(e.target.value)} />
        </label>

        <Secret label="API key" set={current.apiKeySet} value={apiKey} onChange={setApiKey} placeholder="qcb_…" />
        <Secret
          label="API secret (חתימת הבקשות שלנו)"
          set={current.apiSecretSet}
          value={apiSecret}
          onChange={setApiSecret}
          placeholder="whsec_…"
        />
        <Secret
          label="Endpoint secret (אימות האירועים שמגיעים)"
          set={current.endpointSecretSet}
          value={endpointSecret}
          onChange={setEndpointSecret}
          placeholder="whsec_…"
        />

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={pending} className="btn-primary">
            {pending ? "שומר…" : "שמור"}
          </button>
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await pingHubAction();
                setResult(r.ok ? `חיבור תקין ✓ ${JSON.stringify(r.body)}` : `נכשל: ${r.error}`);
              })
            }
            className="btn-secondary"
          >
            בדוק חיבור
          </button>
        </div>
        {result && (
          <pre dir="ltr" className="text-xs bg-surface rounded-xl p-3 whitespace-pre-wrap">
            {result}
          </pre>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-4 space-y-3 text-sm">
        <h2 className="font-bold">מה להגדיר בצד ההאב</h2>
        <div className="space-y-1">
          <div className="text-muted">כתובת ה-webhook לרישום ב-webhook_endpoints:</div>
          <code dir="ltr" className="block bg-surface rounded-lg p-2 select-all break-all">
            {current.webhookUrl}
          </code>
        </div>
        <div className="space-y-1">
          <div className="text-muted">אירועים שצריך לסמן:</div>
          <code dir="ltr" className="block bg-surface rounded-lg p-2 select-all text-xs leading-relaxed">
            payment_method.created, payment_method.expired, invoice.paid, invoice.failed,
            charge.succeeded, charge.failed, charge.dunning_started, charge.recovered,
            subscription.cancelled
          </code>
        </div>
        <p className="text-muted leading-relaxed">
          קודי התוכניות בהאב חייבים להיות בדיוק <code dir="ltr">basic</code>,{" "}
          <code dir="ltr">pro</code>, <code dir="ltr">unlimited</code> - הם נשלחים כ-
          <code dir="ltr">plan_code</code> מטבלת התוכניות כאן.
        </p>
        <p className="text-muted leading-relaxed">
          בלי חיבור, כפתור השדרוג ב-/u מוביל להודעת WhatsApp אל{" "}
          <code dir="ltr">{current.botPhone}</code> - הפעלה ידנית.
        </p>
      </section>
    </div>
  );
}

function Secret({
  label,
  set,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  set: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}{" "}
        <span className={`text-xs ${set ? "text-ok" : "text-muted"}`}>
          · {set ? "מוגדר" : "לא מוגדר"}
        </span>
      </span>
      <input
        className="input"
        dir="ltr"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={set ? "השאר ריק כדי לא לשנות" : placeholder}
      />
    </label>
  );
}

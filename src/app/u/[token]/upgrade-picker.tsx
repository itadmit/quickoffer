"use client";

import { useState, useTransition } from "react";
import { Check, CreditCard, Lock, ShieldCheck } from "lucide-react";
import type { PlanOffer } from "@/lib/billing/plans";
import { startCheckoutAction } from "./actions";
import type { CheckoutForm } from "./schema";

type Props = {
  token: string;
  offers: PlanOffer[];
  /** prefilled on a second upgrade, so nobody types their email twice */
  email: string | null;
  vatNumber: string | null;
  /** when the hub is not wired up yet, each card links here instead */
  manualLinks: Record<string, string> | null;
};

export function UpgradePicker({ token, offers, email: initialEmail, vatNumber, manualLinks }: Props) {
  const [chosen, setChosen] = useState<PlanOffer | null>(null);

  if (chosen && !manualLinks) {
    return (
      <CheckoutForm
        token={token}
        offer={chosen}
        email={initialEmail}
        vatNumber={vatNumber}
        onBack={() => setChosen(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {offers.map((offer) => (
        <PlanCard
          key={offer.plan}
          offer={offer}
          href={manualLinks?.[offer.plan]}
          onChoose={() => setChosen(offer)}
        />
      ))}
    </div>
  );
}

function PlanCard({
  offer,
  href,
  onChoose,
}: {
  offer: PlanOffer;
  href?: string;
  onChoose: () => void;
}) {
  const label = `שדרג ל-${offer.name}`;
  return (
    <section
      className={`relative rounded-2xl border p-5 space-y-4 ${
        offer.highlight ? "border-brand bg-card ring-1 ring-brand/30" : "border-line bg-card"
      }`}
    >
      {offer.badge && (
        <span className="absolute -top-2.5 start-5 rounded-full bg-warn text-warn-ink text-xs font-semibold px-2.5 py-0.5">
          {offer.badge}
        </span>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-bold text-lg">{offer.name}</div>
          <div className="text-sm text-muted">{offer.quota}</div>
        </div>
        <div className="flex items-baseline gap-1.5 shrink-0">
          {offer.listPrice && (
            <span className="text-base font-semibold text-muted line-through">{offer.listPrice}</span>
          )}
          <span className="text-3xl font-bold">{offer.price}</span>
          <span className="text-muted text-sm">₪ / חודש</span>
        </div>
      </div>

      <ul className="text-sm space-y-1.5">
        {offer.features.map((f) => (
          <li key={f} className="flex gap-2 items-start">
            <Check className="h-4 w-4 mt-0.5 shrink-0 text-brand" />
            {f}
          </li>
        ))}
      </ul>

      {href ? (
        <a href={href} target="_blank" rel="noopener" className={offer.highlight ? "btn-primary w-full" : "btn-secondary w-full"}>
          {label}
        </a>
      ) : (
        <button onClick={onChoose} className={offer.highlight ? "btn-primary w-full" : "btn-secondary w-full"}>
          {label}
        </button>
      )}
    </section>
  );
}

// ----------------------------------------------------------------- checkout

function CheckoutForm({
  token,
  offer,
  email: initialEmail,
  vatNumber: initialVat,
  onBack,
}: {
  token: string;
  offer: PlanOffer;
  email: string | null;
  vatNumber: string | null;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [vat, setVat] = useState(initialVat ?? "");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const withVat = Math.round(offer.price * 1.18);

  const submit = () => {
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("נא למלא אימייל תקין");
    if (!accept) return setError("נא לאשר שמירת אמצעי תשלום לחיוב חודשי");
    start(async () => {
      const r = await startCheckoutAction(token, {
        plan: offer.plan,
        email: email.trim(),
        vatNumber: vat.trim() || null,
        accept: true,
      } as CheckoutForm);
      if (r.ok) {
        // Leave for the hosted card page. Same tab: coming back from a payment
        // page in a new tab on a phone is where people get lost.
        window.location.href = r.url;
        return;
      }
      setError(
        r.error === "not_configured"
          ? "הסליקה עדיין לא מחוברת. שלח לנו הודעה ונפעיל ידנית."
          : "לא הצלחנו לפתוח את דף התשלום. נסה שוב בעוד רגע.",
      );
    });
  };

  return (
    <section className="rounded-2xl border border-brand/30 bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-lg">חבילת {offer.name}</div>
          <div className="text-sm text-muted">{offer.quota}</div>
        </div>
        <button onClick={onBack} className="text-sm text-muted underline shrink-0" disabled={pending}>
          החלף חבילה
        </button>
      </div>

      <div className="rounded-xl bg-surface p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted">חיוב חודשי</span>
          <span>{offer.price} ₪</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">מע״מ 18%</span>
          <span>{withVat - offer.price} ₪</span>
        </div>
        <div className="flex justify-between font-bold border-t border-line pt-1 mt-1">
          <span>לחיוב היום</span>
          <span>{withVat} ₪</span>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-sm text-muted">אימייל לחשבונית</span>
        <input
          className="input"
          dir="ltr"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <span className="block text-xs text-muted">לשם נשלחת החשבונית בכל חודש.</span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-muted">ח.פ. / ע.מ. (לא חובה)</span>
        <input
          className="input"
          dir="ltr"
          inputMode="numeric"
          value={vat}
          onChange={(e) => setVat(e.target.value)}
        />
      </label>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
        />
        <span>
          אני מאשר/ת שמירת אמצעי התשלום לחיוב חודשי חוזר של {withVat} ₪, וניתן לבטל בכל עת.
        </span>
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button onClick={submit} disabled={pending} className="btn-primary w-full">
        <CreditCard className="h-5 w-5" />
        {pending ? "פותח דף תשלום…" : "המשך לתשלום מאובטח"}
      </button>

      <div className="flex items-center justify-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3.5 w-3.5" /> פרטי האשראי לא עוברים דרכנו
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> סליקה מאובטחת
        </span>
      </div>
    </section>
  );
}

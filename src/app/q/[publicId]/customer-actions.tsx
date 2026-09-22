"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Hourglass, MessageCircle, PenLine, Printer, ShieldCheck } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { formatPhone } from "@/lib/phone";
import { approveAction, questionAction, rejectAction } from "./actions";

type Props = {
  publicId: string;
  status: "draft" | "sent" | "viewed" | "approved" | "rejected" | "expired";
  expired: boolean;
  businessName: string | null;
  businessPhone: string | null;
  /** shown in the sticky bar, so "כמה זה עולה" is answered before any scrolling */
  totalLabel: string;
  totalNote: string;
};

type Mode = "idle" | "approve" | "question" | "reject";

export function CustomerActions({
  publicId,
  status,
  expired,
  businessName,
  businessPhone,
  totalLabel,
  totalNote,
}: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [done, setDone] = useState<"approved" | "rejected" | "question" | null>(
    status === "approved" ? "approved" : status === "rejected" ? "rejected" : null,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Opening a form should bring it into view - on a phone it opens below the fold.
  useEffect(() => {
    if (mode !== "idle") {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [mode]);

  const who = businessName ?? "בעל המקצוע";

  if (done === "approved") {
    return (
      <Card tone="ok">
        <div className="flex items-center gap-3">
          <span className="anim-seal grid place-items-center h-11 w-11 rounded-full bg-ok/15 text-ok shrink-0">
            <BadgeCheck className="h-6 w-6" />
          </span>
          <div>
            <div className="text-lg font-bold">ההצעה אושרה</div>
            <p className="text-sm text-muted">{who} קיבל הודעה ויחזור אליך בהקדם.</p>
          </div>
        </div>
        <p className="text-sm text-muted">
          המסמך החתום שמור בקישור הזה - אפשר לחזור אליו בכל רגע.
        </p>
        <div className="flex flex-wrap gap-2 no-print">
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="h-4 w-4" /> שמור כ-PDF
          </button>
          {businessPhone && (
            <a href={`tel:+${businessPhone.replace(/\D/g, "")}`} className="btn-secondary" dir="ltr">
              {formatPhone(businessPhone)}
            </a>
          )}
        </div>
      </Card>
    );
  }

  if (done === "rejected") {
    return (
      <Card>
        <div className="text-lg font-bold">ההצעה נדחתה</div>
        <p className="text-sm text-muted">תודה על העדכון. {who} קיבל הודעה.</p>
      </Card>
    );
  }

  if (expired) {
    return (
      <Card tone="warn">
        <div className="text-lg font-bold flex items-center gap-2">
          <Hourglass className="h-5 w-5" /> ההצעה פגה
        </div>
        <p className="text-sm">
          לקבלת הצעה מעודכנת - צור קשר עם {who}
          {businessPhone && (
            <>
              {" "}
              בטלפון{" "}
              <a
                href={`tel:+${businessPhone.replace(/\D/g, "")}`}
                className="font-semibold underline"
                dir="ltr"
              >
                {formatPhone(businessPhone)}
              </a>
            </>
          )}
          .
        </p>
      </Card>
    );
  }

  return (
    <>
      <div ref={panelRef} className="space-y-3 no-print scroll-mt-4">
        {mode === "approve" && (
          <ApproveForm
            publicId={publicId}
            onCancel={() => setMode("idle")}
            onDone={() => {
              setDone("approved");
              setMode("idle");
              // pull the frozen snapshot so the document above shows as signed
              router.refresh();
            }}
          />
        )}

        {mode === "question" && (
          <QuestionForm
            publicId={publicId}
            onCancel={() => setMode("idle")}
            onDone={() => {
              setDone("question");
              setMode("idle");
            }}
          />
        )}

        {mode === "reject" && (
          <RejectForm
            publicId={publicId}
            onCancel={() => setMode("idle")}
            onDone={() => {
              setDone("rejected");
              setMode("idle");
            }}
          />
        )}

        {mode === "idle" && done === "question" && (
          <p className="text-center text-sm text-ok">השאלה נשלחה - {who} יחזור אליך</p>
        )}
      </div>

      {/*
        The decision bar. Pinned to the thumb zone and carrying the total, so
        the customer never has to scroll to learn the price or to say yes.
      */}
      {mode === "idle" && (
        <div className="no-print fixed bottom-0 inset-x-0 z-20 border-t border-line bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-lg mx-auto px-4 py-3 space-y-2.5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted">{totalNote}</div>
                <div className="text-2xl font-bold leading-tight">{totalLabel}</div>
              </div>
              <button
                onClick={() => setMode("approve")}
                className="btn-primary text-base px-6 py-3.5 shrink-0"
              >
                <PenLine className="h-5 w-5" /> מאשר וחותם
              </button>
            </div>
            <div className="flex items-center justify-center gap-5 text-sm text-muted">
              <button onClick={() => setMode("question")} className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" /> יש לי שאלה
              </button>
              <span aria-hidden className="h-3 w-px bg-line" />
              <button onClick={() => setMode("reject")}>לא מתאים לי</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ approve

function ApproveForm({
  publicId,
  onCancel,
  onDone,
}: {
  publicId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [pending, start] = useTransition();
  const pad = useRef<SignaturePadHandle>(null);

  const submit = () => {
    setError(null);
    if (name.trim().length < 2) return setError("נא למלא שם מלא");
    const png = pad.current?.toDataURL();
    if (!png || pad.current?.isEmpty()) return setError("נא לחתום באצבע בתיבה");
    if (!agreed) return setError("נא לאשר שקראת את ההצעה");
    start(async () => {
      const r = await approveAction(publicId, name, png);
      if (r.ok) onDone();
      else setError(r.error === "expired" ? "ההצעה פגה" : "משהו השתבש, נסה שוב");
    });
  };

  return (
    <Card>
      <div>
        <div className="font-bold text-lg">אישור ההצעה</div>
        <p className="text-sm text-muted">החתימה מאשרת את ההצעה כפי שהיא מופיעה למעלה.</p>
      </div>
      <label className="block space-y-1">
        <span className="text-sm text-muted">שם מלא</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="ישראל ישראלי"
          autoComplete="name"
          enterKeyHint="done"
        />
      </label>

      <SignaturePad ref={pad} onChange={(empty) => setSigned(!empty)} />

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
        />
        <span>קראתי את ההצעה ואני מאשר/ת אותה</span>
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button onClick={submit} disabled={pending} className="btn-primary flex-1">
          {pending ? "שולח..." : "אשר וחתום"}
        </button>
        <button onClick={onCancel} disabled={pending} className="btn-ghost">
          ביטול
        </button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        {signed
          ? "החתימה והתאריך יישמרו יחד עם ההצעה."
          : "החתימה נשמרת יחד עם ההצעה ותאריך האישור."}
      </p>
    </Card>
  );
}

// ----------------------------------------------------------------- question

function QuestionForm({
  publicId,
  onCancel,
  onDone,
}: {
  publicId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <div className="font-bold text-lg">שאלה על ההצעה</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="input"
        placeholder="למשל: זה כולל חומרים?"
        autoFocus
      />
      <p className="text-xs text-muted">השאלה תישלח לבעל המקצוע ב-WhatsApp והוא יענה לך ישירות.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <button
          disabled={pending || text.trim().length < 2}
          onClick={() =>
            start(async () => {
              const r = await questionAction(publicId, text);
              if (r.ok) onDone();
              else setError("משהו השתבש, נסה שוב");
            })
          }
          className="btn-primary flex-1"
        >
          {pending ? "שולח..." : "שלח שאלה"}
        </button>
        <button onClick={onCancel} className="btn-ghost">
          ביטול
        </button>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------- reject

const REASONS = ["יקר מדי", "בחרתי בעל מקצוע אחר", "כבר לא רלוונטי", "אחר"];

function RejectForm({
  publicId,
  onCancel,
  onDone,
}: {
  publicId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [other, setOther] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card>
      <div className="font-bold text-lg">לא מתאים לי</div>
      <p className="text-sm text-muted">אפשר לציין סיבה (לא חובה):</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`chip ${reason === r ? "chip-on" : ""}`}
          >
            {r}
          </button>
        ))}
      </div>
      {reason === "אחר" && (
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          className="input"
          placeholder="סיבה"
        />
      )}
      <div className="flex gap-3">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const final = reason === "אחר" ? other : reason;
              const r = await rejectAction(publicId, final || null);
              if (r.ok) onDone();
            })
          }
          className="btn-danger flex-1"
        >
          {pending ? "שולח..." : "דחה את ההצעה"}
        </button>
        <button onClick={onCancel} className="btn-ghost">
          חזרה
        </button>
      </div>
    </Card>
  );
}

function Card({ children, tone }: { children: React.ReactNode; tone?: "ok" | "warn" }) {
  const toneCls =
    tone === "ok"
      ? "border-ok/40 bg-ok/5"
      : tone === "warn"
        ? "border-warn-ink/30 bg-warn"
        : "border-line bg-card";
  return <div className={`rounded-2xl border p-4 space-y-3 ${toneCls}`}>{children}</div>;
}

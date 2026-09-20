"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BadgeCheck, Hourglass, MessageCircle, PenLine, Printer } from "lucide-react";
import { formatPhone } from "@/components/quote-document";
import { approveAction, questionAction, rejectAction } from "./actions";

type Props = {
  publicId: string;
  status: "draft" | "sent" | "viewed" | "approved" | "rejected" | "expired";
  expired: boolean;
  businessName: string | null;
  businessPhone: string | null;
};

type Mode = "idle" | "approve" | "question" | "reject";

export function CustomerActions({ publicId, status, expired, businessName, businessPhone }: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [done, setDone] = useState<"approved" | "rejected" | "question" | null>(
    status === "approved" ? "approved" : status === "rejected" ? "rejected" : null,
  );

  if (done === "approved") {
    return (
      <Card tone="ok">
        <div className="text-lg font-bold flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-ok" /> ההצעה אושרה
        </div>
        <p className="text-sm text-muted">
          {businessName ?? "בעל המקצוע"} קיבל הודעה ויחזור אליך בהקדם.
        </p>
        <button onClick={() => window.print()} className="btn-secondary mt-2 no-print">
          <Printer className="h-4 w-4" /> הדפס / שמור כ-PDF
        </button>
      </Card>
    );
  }
  if (done === "rejected") {
    return (
      <Card>
        <div className="text-lg font-bold">ההצעה נדחתה</div>
        <p className="text-sm text-muted">תודה על העדכון. {businessName ?? "בעל המקצוע"} קיבל הודעה.</p>
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
          לקבלת הצעה מעודכנת - צור קשר עם {businessName ?? "בעל המקצוע"}
          {businessPhone && (
            <>
              {" "}
              בטלפון{" "}
              <a href={`tel:+${businessPhone.replace(/\D/g, "")}`} className="font-semibold underline" dir="ltr">
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
    <div className="space-y-3 no-print">
      {mode === "idle" && (
        <>
          <button onClick={() => setMode("approve")} className="btn-primary w-full text-lg py-4">
            <PenLine className="h-5 w-5" /> מאשר את ההצעה
          </button>
          <div className="flex gap-3">
            <button onClick={() => setMode("question")} className="btn-secondary flex-1">
              <MessageCircle className="h-4 w-4" /> יש לי שאלה
            </button>
            <button onClick={() => setMode("reject")} className="btn-ghost text-sm">
              לא מתאים לי
            </button>
          </div>
          {done === "question" && (
            <p className="text-center text-sm text-ok">השאלה נשלחה - תקבל תשובה ב-WhatsApp</p>
          )}
        </>
      )}

      {mode === "approve" && (
        <ApproveForm
          publicId={publicId}
          onCancel={() => setMode("idle")}
          onDone={() => {
            setDone("approved");
            setMode("idle");
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
    </div>
  );
}

// ------------------------------------------------------------------ approve

function ApproveForm({ publicId, onCancel, onDone }: { publicId: string; onCancel: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pad = useRef<SignaturePadHandle>(null);

  const submit = () => {
    setError(null);
    const png = pad.current?.toDataURL();
    if (name.trim().length < 2) return setError("נא למלא שם מלא");
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
      <div className="font-bold text-lg">אישור ההצעה</div>
      <label className="block space-y-1">
        <span className="text-sm text-muted">שם מלא</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="ישראל ישראלי"
          autoComplete="name"
        />
      </label>
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted">
          <span>חתימה (באצבע)</span>
          <button type="button" onClick={() => pad.current?.clear()} className="underline">
            נקה
          </button>
        </div>
        <SignaturePad ref={pad} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
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
    </Card>
  );
}

// ----------------------------------------------------------- signature pad

type SignaturePadHandle = { toDataURL: () => string; clear: () => void; isEmpty: () => boolean };

function SignaturePad({ ref }: { ref: React.RefObject<SignaturePadHandle | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";

    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      drawing.current = true;
      dirty.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      c.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing.current) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const up = () => {
      drawing.current = false;
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);

    ref.current = {
      toDataURL: () => c.toDataURL("image/png"),
      clear: () => {
        ctx.clearRect(0, 0, c.width, c.height);
        dirty.current = false;
      },
      isEmpty: () => !dirty.current,
    };
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
    };
  }, [ref]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-40 bg-white rounded-xl border-2 border-dashed border-line touch-none"
      style={{ touchAction: "none" }}
    />
  );
}

// ----------------------------------------------------------------- question

function QuestionForm({ publicId, onCancel, onDone }: { publicId: string; onCancel: () => void; onDone: () => void }) {
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

function RejectForm({ publicId, onCancel, onDone }: { publicId: string; onCancel: () => void; onDone: () => void }) {
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
        <input value={other} onChange={(e) => setOther(e.target.value)} className="input" placeholder="סיבה" />
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
    tone === "ok" ? "border-ok/40 bg-ok/5" : tone === "warn" ? "border-warn-ink/30 bg-warn" : "border-line bg-card";
  return <div className={`rounded-2xl border p-4 space-y-3 ${toneCls}`}>{children}</div>;
}

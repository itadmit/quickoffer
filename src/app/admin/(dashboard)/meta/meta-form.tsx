"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "../actions";

type Props = { current: { pixelId: string; token: { value: string; source: string }; testCode: string } };

export function MetaForm({ current }: Props) {
  const [pixelId, setPixelId] = useState(current.pixelId);
  const [token, setToken] = useState("");
  const [testCode, setTestCode] = useState(current.testCode);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const validId = pixelId === "" || /^\d+$/.test(pixelId.trim());
  return (
    <section className="rounded-2xl border border-line bg-card p-4 space-y-3 max-w-xl">
      <label className="block">
        <span className="label">מזהה פיקסל (Dataset ID)</span>
        <input className="input" dir="ltr" inputMode="numeric" value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="1234567890123456" />
      </label>
      <label className="block">
        <span className="label">Conversions API token <span className="text-xs">· נוכחי: <code dir="ltr">{current.token.value || "—"}</code> ({current.token.source})</span></span>
        <input className="input" dir="ltr" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAB…" />
      </label>
      <label className="block">
        <span className="label">Test event code <span className="text-xs">· רק לבדיקה ב-Events Manager, לרוקן אחר כך</span></span>
        <input className="input" dir="ltr" value={testCode} onChange={(e) => setTestCode(e.target.value)} placeholder="TEST12345" />
      </label>
      {!validId && <p className="text-sm text-red-600">מזהה פיקסל הוא ספרות בלבד.</p>}
      <button
        disabled={pending || !validId}
        onClick={() =>
          start(async () => {
            await saveSettingsAction({ "meta.pixel_id": pixelId, "meta.capi_token": token, "meta.test_event_code": testCode });
            setToken("");
            setResult("נשמר ✓");
          })
        }
        className="btn-primary"
      >
        שמור
      </button>
      {result && <p className="text-sm">{result}</p>}
    </section>
  );
}

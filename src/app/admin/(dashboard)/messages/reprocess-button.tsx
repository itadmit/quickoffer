"use client";

import { useState, useTransition } from "react";
import { reprocessMessageAction } from "../actions";

export function ReprocessButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="whitespace-nowrap text-xs">
      <button className="underline" disabled={pending} onClick={() => start(async () => { const r = await reprocessMessageAction(id); setMsg(r.ok ? "✓" : r.error); })}>
        {pending ? "…" : "עבד מחדש"}
      </button>
      {msg && <span className="ms-1">{msg}</span>}
    </span>
  );
}

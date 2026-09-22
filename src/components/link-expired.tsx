import { Link2Off } from "lucide-react";

/** Shared dead-end for magic links that no longer resolve (/e, /s, /w). */
export function LinkExpired({ hint }: { hint?: string }) {
  return (
    <main className="flex-1 grid place-items-center p-6 text-center">
      <div className="space-y-2 max-w-xs">
        <Link2Off className="h-10 w-10 mx-auto text-muted" />
        <h1 className="text-xl font-bold">הקישור לא תקף</h1>
        <p className="text-muted text-sm leading-relaxed">
          {hint ?? "שלח “עזרה” לבוט ב-WhatsApp לקבלת קישור חדש."}
        </p>
      </div>
    </main>
  );
}

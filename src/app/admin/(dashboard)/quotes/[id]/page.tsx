import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { processingRuns, quoteEvents } from "@/lib/db/schema";
import { editLink, publicLink } from "@/lib/quotes/links";
import { getQuote } from "@/lib/quotes/service";

export default async function AdminQuoteDebug({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await getQuote(id);
  if (!q) notFound();
  const [runs, events] = await Promise.all([
    db.select().from(processingRuns).where(eq(processingRuns.quoteId, id)).orderBy(desc(processingRuns.at)),
    db.select().from(quoteEvents).where(eq(quoteEvents.quoteId, id)).orderBy(desc(quoteEvents.at)),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">הצעה #{q.number} - {q.customerName ?? "ללא שם"}</h1>
        <span className="text-sm text-muted">{q.status}</span>
        <div className="ms-auto text-sm flex gap-3">
          <a href={await publicLink(q.publicId)} target="_blank" className="underline">דף לקוח</a>
          <a href={await editLink(q.id)} target="_blank" className="underline">מסך עריכה</a>
          <Link href="/admin/quotes" className="text-muted">← חזרה</Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Box title="תמלול גולמי">
          <p className="whitespace-pre-wrap">{q.transcript ?? <span className="text-muted">- (נוצר מטקסט או בעריכה)</span>}</p>
          {q.audioUrl && <audio controls src={q.audioUrl} className="mt-3 w-full" />}
        </Box>
        <Box title="מצב נוכחי (אחרי עריכות)">
          <Pre data={{ items: q.items.map(({ description, quantity, unit, unitPrice, lineTotal, needsReview }) => ({ description, quantity, unit, unitPrice, lineTotal, needsReview })), subtotal: q.subtotal, vatAmount: q.vatAmount, total: q.total, vatIncluded: q.vatIncluded, discount: q.discountAmount, paymentTerms: q.paymentTerms, notes: q.notes }} />
        </Box>
      </div>

      <Box title={`ריצות עיבוד (${runs.length})`}>
        <div className="space-y-3">
          {runs.map((r) => (
            <div key={r.id} className={`rounded-xl border p-3 text-sm ${r.error ? "border-danger/40 bg-danger/5" : "border-line"}`}>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>{r.at.toLocaleString("he-IL")}</span><span>{r.kind}</span>
                {r.transcriptionModel && <span>ASR: {r.transcriptionProvider}/{r.transcriptionModel} · {r.transcriptionMs}ms</span>}
                {r.llmModel && <span>LLM: {r.llmProvider}/{r.llmModel} · {r.llmMs}ms · {r.llmInputTokens}→{r.llmOutputTokens} tok</span>}
                <span>סה״כ {r.totalMs}ms</span><span>≈ {Number(r.costEstimate ?? 0).toFixed(3)} ₪</span>
              </div>
              {r.error && <div className="text-danger mt-1">{r.error}</div>}
              {r.rawLlmOutput != null && <details className="mt-2"><summary className="cursor-pointer text-xs">JSON שחזר מהמודל</summary><Pre data={r.rawLlmOutput} /></details>}
            </div>
          ))}
          {!runs.length && <p className="text-muted text-sm">אין ריצות</p>}
        </div>
      </Box>

      <Box title={`אירועים (${events.length})`}>
        <ul className="text-sm space-y-1">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3"><span className="text-muted whitespace-nowrap">{e.at.toLocaleString("he-IL")}</span><span className="font-medium">{e.type}</span><span className="text-muted truncate" dir="ltr">{JSON.stringify(e.payload)}</span></li>
          ))}
        </ul>
      </Box>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-card p-4 space-y-2"><h2 className="font-bold">{title}</h2>{children}</section>;
}
function Pre({ data }: { data: unknown }) {
  return <pre dir="ltr" className="text-xs bg-surface rounded-xl p-3 overflow-auto max-h-80 whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
}

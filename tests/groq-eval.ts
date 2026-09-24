// Mini eval of the structuring/classification prompts against Groq with messy spoken-Hebrew transcripts.
// Run: npx tsx --tsconfig tsconfig.json tests/groq-eval.ts
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { openaiLLM } from "@/lib/ai/openai";
import type { QuoteItemJSON, QuoteJSON } from "@/lib/ai/types";

const profile = { businessName: "יוסי חשמל", vatStatus: "registered" as const, defaultPaymentTerms: null, defaultValidDays: 14, defaultNotes: [], catalog: [] };

const CASES: { t: string; expect: (q: QuoteJSON) => string[] }[] = [
  {
    t: "אה כן הצעת מחיר לדני כהן התקנת שלושה גופי תאורה מאה וחמישים שקל ליחידה ביקור מאתיים שקל המחיר לפני מעם חמישים אחוז מקדימה",
    expect: (q) => [
      q.customerName === "דני כהן" ? "" : `name=${q.customerName}`,
      q.items.length === 2 ? "" : `items=${q.items.length}`,
      q.items[0]?.quantity === 3 && q.items[0]?.unitPrice === 150 ? "" : `item0=${q.items[0]?.quantity}x${q.items[0]?.unitPrice}`,
      q.items[1]?.unitPrice === 200 ? "" : `visit=${q.items[1]?.unitPrice}`,
      q.vatIncluded === false ? "" : `vat=${q.vatIncluded}`,
      /50%/.test(q.paymentTerms ?? "") ? "" : `pay=${q.paymentTerms}`,
    ],
  },
  {
    t: "לרונית מהקומה השלישית נזילה מתחת לכיור החלפת סיפון ותיקון הצנרת הכל ביחד ארבע מאות שח כולל מעם לא כולל חלקים",
    expect: (q) => [
      q.customerName === "רונית" ? "" : `name=${q.customerName}`,
      q.items.length === 1 && q.items[0].unitPrice === 400 && q.items[0].unit === "קומפלט" ? "" : `items=${JSON.stringify(q.items)}`,
      q.vatIncluded === true ? "" : `vat=${q.vatIncluded}`,
      q.notes.length >= 1 ? "" : "notes empty",
    ],
  },
  {
    t: "צביעת דירה משפחת לוי שמונים מטר קירות ותקרה שלושים וחמש שקל למטר ושפכטל איפה שצריך אני עוד לא יודע כמה",
    expect: (q) => [
      q.items.find((i: QuoteItemJSON) => i.unit === "מ״ר" && i.quantity === 80 && i.unitPrice === 35) ? "" : `paint=${JSON.stringify(q.items)}`,
      q.items.find((i: QuoteItemJSON) => i.unitPrice === 0 && i.priceConfidence === "missing") ? "" : "missing-price item not flagged",
      q.needsReview.length >= 1 ? "" : "needsReview empty",
    ],
  },
  {
    t: "ארבע נקודות חשמל חמש מאות ארבעים שקל ותוספת שקע כפול מאה ועשרים",
    expect: (q) => [
      q.items.length === 2 ? "" : `items=${q.items.length}`,
      q.items[0]?.quantity === 4 ? "" : `qty=${q.items[0]?.quantity}`,
      [135, 540].includes(q.items[0]?.unitPrice) ? "" : `price=${q.items[0]?.unitPrice}`,
      q.customerName === null ? "" : `name should be null, got ${q.customerName}`,
    ],
  },
  {
    t: "היי מה קורה תשמע יש לי עבודה אצל אבי בהרצליה החלפת לוח חשמל אלפיים וחמש מאות ועוד נסיעה מאה חמישים בלי מעם ותוקף לשבוע",
    expect: (q) => [
      q.customerName === "אבי" ? "" : `name=${q.customerName}`,
      q.items.find((i: QuoteItemJSON) => i.unitPrice === 2500) ? "" : "panel 2500 missing",
      q.items.find((i: QuoteItemJSON) => i.unitPrice === 150) ? "" : "travel 150 missing",
      q.vatIncluded === false ? "" : `vat=${q.vatIncluded}`,
      q.validDays === 7 ? "" : `valid=${q.validDays}`,
    ],
  },
];

/**
 * `want` is the intent; `cmd` additionally pins the command, and `fields`
 * checks what was extracted. The §6.8 cases are the ones worth running before
 * any change to the classify prompt - they cover the two boundaries that are
 * genuinely easy to get wrong: תבנית (content) vs עיצוב (look), and a saved
 * template named in a message that also carries prices.
 */
const CLASSIFY: {
  t: string;
  draft: boolean;
  want: string;
  cmd?: string;
  fields?: (r: { reference: string | null; customerName: string | null; designName: string | null }) => boolean;
}[] = [
  { t: "היי", draft: false, want: "greeting" },
  { t: "תודה רבה אחי", draft: true, want: "greeting" },
  { t: "תשנה את הביקור ל-250", draft: true, want: "correction" },
  { t: "עוד שתי נקודות", draft: true, want: "correction" },
  { t: "לרונית תיקון נזילה 400", draft: true, want: "new_quote" },
  { t: "התקנת מזגן 2200", draft: false, want: "new_quote" },
  { t: "שלחתי לו", draft: true, want: "command" },
  { t: "מה ההצעות שלי", draft: false, want: "command" },
  { t: "זה כולל מע״מ?", draft: true, want: "question" },
  { t: "300 שקל", draft: true, want: "unclear" },
  /**
   * Every one of these was misclassified in production on 2026-09-24 and cost
   * a real conversation. The phone case is the worst of them: the bot itself
   * asks for that exact wording, then answered it with "תקן או חדש?".
   */
  { t: "הטלפון של מריה 0542284283", draft: true, want: "correction" },
  { t: "המספר של הלקוח 050-1234567", draft: true, want: "correction" },
  { t: "תקן", draft: true, want: "command", cmd: "correct" },
  { t: "לתקן", draft: true, want: "command", cmd: "correct" },
  // Imperative, not a report: answering this with "סומנה כנשלחה" sends nothing
  { t: "שלח למריה את ההצעה הקודמת", draft: true, want: "command", cmd: "send_to",
    fields: (r) => !!r.customerName?.includes("מריה") },
  { t: "תשלח לדני את ההצעה", draft: true, want: "command", cmd: "send_to" },
  // ...and the past tense must still mean "mark it", or nothing ever gets marked
  { t: "העברתי ללקוח", draft: true, want: "command", cmd: "mark_sent" },
  // --- §6.8
  { t: "עיצוב מודרני", draft: false, want: "command", cmd: "design",
    fields: (r) => r.designName === "מודרני" },
  { t: "התקנת מזגן לדני כהן", draft: false, want: "command", cmd: "job_use",
    fields: (r) => !!r.reference?.includes("מזגן") && !!r.customerName?.includes("דני") },
  // prices present -> a new quote, never job_use, or the numbers are lost
  { t: "התקנת מזגן לדני 2 יחידות 1200", draft: false, want: "new_quote" },
  { t: "תקח את ההצעה של דני ותשתמש באותה תבנית ליוסי", draft: false, want: "command", cmd: "repeat",
    fields: (r) => !!r.reference?.includes("דני") && !!r.customerName?.includes("יוסי") },
  { t: "כמו ההצעה של דני, אבל לשרון", draft: false, want: "command", cmd: "repeat",
    fields: (r) => !!r.customerName?.includes("שרון") },
  { t: "תשמור את זה כהתקנת מזגן", draft: true, want: "command", cmd: "job_save",
    fields: (r) => !!r.reference?.includes("מזגן") },
];

async function main() {
  // Runs against any OpenAI-compatible provider, so the same cases decide a
  // provider change instead of it being decided on vibes:
  //   EVAL_PROVIDER=openai EVAL_MODEL=gpt-4o-mini PACE_MS=0 npx tsx ... tests/groq-eval.ts
  const provider = process.env.EVAL_PROVIDER ?? "groq";
  const llm = openaiLLM(
    provider === "openai"
      ? { apiKey: process.env.OPENAI_API_KEY!, providerName: "openai", model: process.env.EVAL_MODEL ?? "gpt-4o-mini" }
      : {
          apiKey: process.env.GROQ_API_KEY!,
          baseURL: "https://api.groq.com/openai/v1",
          providerName: "groq",
          model: process.env.EVAL_MODEL ?? "openai/gpt-oss-120b",
        },
  );
  console.log(`provider=${provider} model=${process.env.EVAL_MODEL ?? "(default)"}`);
  let fails = 0;
  const pace = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (const c of CASES) {
    const t0 = Date.now();
    const { result, usage } = await llm.structureQuote(c.t, profile);
    process.stdout.write(`   [${usage.inputTokens}→${usage.outputTokens} tok] `);
    await pace(Number(process.env.PACE_MS ?? 15000));
    const problems = c.expect(result).filter(Boolean);
    fails += problems.length;
    console.log(`${problems.length ? "❌" : "✅"} ${Date.now() - t0}ms  ${c.t.slice(0, 60)}…`);
    for (const p of problems) console.log(`     - ${p}`);
    if (problems.length) console.log("     " + JSON.stringify(result));
  }
  console.log("--- classify");
  for (const c of CLASSIFY) {
    await pace(Number(process.env.PACE_MS ?? 15000) / 3);
    const { result } = await llm.classifyMessage(c.t, { hasActiveDraft: c.draft, draftCustomer: c.draft ? "דני כהן" : null, designNames: ["קלאסי", "מודרני", "מינימלי"], jobNames: ["התקנת מזגן", "נקודת חשמל"] });
    const badCmd = c.cmd && result.command !== c.cmd;
    const badFields = c.fields && !c.fields(result);
    const ok = result.intent === c.want && !badCmd && !badFields;
    if (!ok) fails++;
    const got = `${result.intent}${result.command ? "/" + result.command : ""}`;
    const why = badFields
      ? `  ⚠️ ref=${result.reference} cust=${result.customerName} design=${result.designName}`
      : ok
        ? ""
        : `  (want ${c.want}${c.cmd ? "/" + c.cmd : ""})`;
    console.log(`${ok ? "✅" : "❌"} "${c.t}" [draft=${c.draft}] → ${got}${why}`);
  }
  console.log(fails ? `\n${fails} PROBLEMS` : "\nALL GOOD");
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });

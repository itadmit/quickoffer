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

const CLASSIFY: { t: string; draft: boolean; want: string }[] = [
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
];

async function main() {
  const llm = openaiLLM({ apiKey: process.env.GROQ_API_KEY!, baseURL: "https://api.groq.com/openai/v1", providerName: "groq", model: "openai/gpt-oss-120b" });
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
    const { result } = await llm.classifyMessage(c.t, { hasActiveDraft: c.draft, draftCustomer: c.draft ? "דני כהן" : null, templateNames: ["קלאסי", "מודרני", "מינימלי"], jobNames: ["התקנת מזגן", "נקודת חשמל"] });
    const ok = result.intent === c.want;
    if (!ok) fails++;
    console.log(`${ok ? "✅" : "❌"} "${c.t}" [draft=${c.draft}] → ${result.intent}${result.command ? "/" + result.command : ""}${ok ? "" : `  (want ${c.want})`}`);
  }
  console.log(fails ? `\n${fails} PROBLEMS` : "\nALL GOOD");
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });

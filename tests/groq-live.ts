// Live check of the Groq key: Hebrew transcription (whisper-large-v3) + quote structuring (Llama).
// Run: npx tsx --tsconfig tsconfig.json tests/groq-live.ts <audio file>
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { readFileSync } from "node:fs";
import { openaiLLM, openaiTranscription } from "@/lib/ai/openai";

async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing in .env.local");
  const file = process.argv[2];
  const base = { apiKey: key, baseURL: "https://api.groq.com/openai/v1", providerName: "groq" };

  if (file) {
    for (const model of ["whisper-large-v3", "whisper-large-v3-turbo"]) {
      const asr = openaiTranscription({ ...base, model });
      const t0 = Date.now();
      const { text, usage } = await asr.transcribe(readFileSync(file), {
        language: "he", hints: ["יוסי חשמל"], fileName: file.split("/").pop(), mimetype: "audio/wav",
      });
      console.log(`\n[${model}] ${Date.now() - t0}ms  ≈${usage.cost.toFixed(4)} ₪\n  ${text}`);
    }
  }

  const llmModel = "openai/gpt-oss-120b";
  const llm = openaiLLM({ ...base, model: llmModel });
  const t0 = Date.now();
  const r = await llm.structureQuote(
    "הצעת מחיר לדני כהן, התקנת שלושה גופי תאורה 150 שקל ליחידה, ביקור 200 שקל, המחיר לפני מע״מ, 50 אחוז מקדמה",
    { businessName: "יוסי חשמל", vatStatus: "registered", defaultPaymentTerms: null, defaultValidDays: 14, defaultNotes: [] },
  );
  console.log(`\n[${llmModel}] ${Date.now() - t0}ms  ${r.usage.inputTokens}→${r.usage.outputTokens} tok`);
  console.log(JSON.stringify(r.result, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });

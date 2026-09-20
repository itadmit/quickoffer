import { describeSettings } from "@/lib/settings";
import { AiSettingsForm } from "./ai-form";

export default async function AdminAI() {
  const all = await describeSettings();
  const pick = (prefix: string) =>
    all.filter((s) => s.key.startsWith(prefix)).map((s) => ({ ...s, value: s.secret ? mask(s.value) : s.value }));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ספקי AI</h1>
      <p className="text-sm text-muted">
        ספק, מודל ומפתח נשמרים ב-DB מוצפנים ונטענים בלי deploy (cache 60 שניות). שדה מפתח ריק = לא לשנות.
      </p>
      <AiSettingsForm transcription={pick("transcription.")} llm={pick("llm.")} />
    </div>
  );
}

function mask(v: string) {
  if (!v) return "";
  return v.length <= 8 ? "••••" : `${v.slice(0, 3)}…${v.slice(-4)}`;
}

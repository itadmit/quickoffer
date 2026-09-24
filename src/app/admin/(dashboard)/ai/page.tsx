import { and, count, gte, isNotNull, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { processingRuns } from "@/lib/db/schema";
import { describeSettings } from "@/lib/settings";
import { AiSettingsForm } from "./ai-form";
import { CapacityCard } from "./capacity-card";

export default async function AdminAI() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [all, [today]] = await Promise.all([
    describeSettings(),
    db
      .select({
        runs: count(),
        llmTokens: sql<number>`coalesce(sum(coalesce(${processingRuns.llmInputTokens}, 0) + coalesce(${processingRuns.llmOutputTokens}, 0)), 0)::int`,
        transcriptions: sql<number>`count(*) filter (where ${processingRuns.transcriptionModel} is not null)::int`,
        cost: sum(processingRuns.costEstimate),
      })
      .from(processingRuns)
      .where(and(gte(processingRuns.at, startOfDay), isNotNull(processingRuns.at))),
  ]);

  const pick = (prefix: string) =>
    all.filter((s) => s.key.startsWith(prefix)).map((s) => ({ ...s, value: s.secret ? mask(s.value) : s.value }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ספקי AI</h1>
      <p className="text-sm text-muted">
        ספק, מודל ומפתח נשמרים ב-DB מוצפנים ונטענים בלי deploy (cache 60 שניות). שדה מפתח ריק = לא לשנות.
      </p>

      <CapacityCard
        today={{
          runs: today?.runs ?? 0,
          llmTokens: Number(today?.llmTokens ?? 0),
          transcriptions: Number(today?.transcriptions ?? 0),
          cost: Number(today?.cost ?? 0),
        }}
      />

      <AiSettingsForm transcription={pick("transcription.")} llm={pick("llm.")} />
    </div>
  );
}

function mask(v: string) {
  if (!v) return "";
  return v.length <= 8 ? "••••" : `${v.slice(0, 3)}…${v.slice(-4)}`;
}

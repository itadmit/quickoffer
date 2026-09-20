"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction, testLLMAction, testTranscriptionAction } from "../actions";

type Setting = { key: string; secret: boolean; source: "db" | "env" | "default"; value: string };

const ASR_PROVIDERS = [
  ["openai", "OpenAI (whisper-1 / gpt-4o-transcribe)"],
  ["groq", "Groq (whisper-large-v3, תואם OpenAI)"],
  ["custom", "Custom — URL תואם OpenAI"],
];
const LLM_PROVIDERS = [
  ["openai", "OpenAI"],
  ["groq", "Groq (תואם OpenAI)"],
  ["custom", "Custom — URL תואם OpenAI"],
];
const ASR_MODELS = ["gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1", "whisper-large-v3", "whisper-large-v3-turbo"];
const LLM_MODELS = ["gpt-5.4-mini", "gpt-5.4-nano", "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini", "llama-3.3-70b-versatile"];

export function AiSettingsForm({ transcription, llm }: { transcription: Setting[]; llm: Setting[] }) {
  const get = (list: Setting[], k: string) => list.find((s) => s.key === k);
  const [values, setValues] = useState<Record<string, string>>({
    "transcription.provider": get(transcription, "transcription.provider")?.value ?? "openai",
    "transcription.model": get(transcription, "transcription.model")?.value ?? "",
    "transcription.base_url": get(transcription, "transcription.base_url")?.value ?? "",
    "transcription.api_key": "",
    "llm.provider": get(llm, "llm.provider")?.value ?? "openai",
    "llm.model": get(llm, "llm.model")?.value ?? "",
    "llm.base_url": get(llm, "llm.base_url")?.value ?? "",
    "llm.api_key": "",
  });
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [asrTest, setAsrTest] = useState<unknown>(null);
  const [llmTest, setLlmTest] = useState<unknown>(null);

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const save = () =>
    start(async () => {
      await saveSettingsAction(values);
      setSaved(true);
      setValues((s) => ({ ...s, "transcription.api_key": "", "llm.api_key": "" }));
      setTimeout(() => setSaved(false), 2000);
    });

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Section title="תמלול">
        <Select label="ספק" value={values["transcription.provider"]} onChange={(v) => set("transcription.provider", v)} options={ASR_PROVIDERS} />
        <Combo label="מודל" value={values["transcription.model"]} onChange={(v) => set("transcription.model", v)} options={ASR_MODELS} />
        {values["transcription.provider"] === "custom" && (
          <Text label="Base URL" value={values["transcription.base_url"]} onChange={(v) => set("transcription.base_url", v)} placeholder="https://…/v1" />
        )}
        <Secret label="מפתח API לתמלול" current={get(transcription, "transcription.api_key")} value={values["transcription.api_key"]} onChange={(v) => set("transcription.api_key", v)} />
        <TestButton label="בדוק חיבור (תמלול)" run={() => testTranscriptionAction().then(setAsrTest)} result={asrTest} />
      </Section>

      <Section title="LLM (מבנה, תיקונים, סיווג)">
        <Select label="ספק" value={values["llm.provider"]} onChange={(v) => set("llm.provider", v)} options={LLM_PROVIDERS} />
        <Combo label="מודל" value={values["llm.model"]} onChange={(v) => set("llm.model", v)} options={LLM_MODELS} />
        {values["llm.provider"] === "custom" && (
          <Text label="Base URL" value={values["llm.base_url"]} onChange={(v) => set("llm.base_url", v)} placeholder="https://…/v1" />
        )}
        <Secret label="מפתח API ל-LLM" current={get(llm, "llm.api_key")} value={values["llm.api_key"]} onChange={(v) => set("llm.api_key", v)} />
        <TestButton label="בדוק חיבור (LLM)" run={() => testLLMAction().then(setLlmTest)} result={llmTest} />
      </Section>

      <div className="lg:col-span-2 flex items-center gap-3">
        <button onClick={save} disabled={pending} className="btn-primary">{pending ? "שומר…" : "שמור הגדרות"}</button>
        {saved && <span className="text-ok text-sm">נשמר ✓</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4 space-y-3">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function Combo({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  const id = label.replace(/\s/g, "-");
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" dir="ltr" list={id} value={value} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </label>
  );
}
function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
function Secret({ label, current, value, onChange }: { label: string; current?: Setting; value: string; onChange: (v: string) => void }) {
  const src = current?.source === "db" ? "DB (מוצפן)" : current?.source === "env" ? "env" : "לא מוגדר";
  return (
    <label className="block">
      <span className="label">{label} <span className="text-xs">· נוכחי: <code dir="ltr">{current?.value || "—"}</code> ({src})</span></span>
      <input className="input" dir="ltr" type="password" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder="הדבק מפתח חדש כדי להחליף" />
    </label>
  );
}
function TestButton({ label, run, result }: { label: string; run: () => Promise<unknown>; result: unknown }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => start(async () => { await run(); })} disabled={pending} className="btn-secondary text-sm">
        {pending ? "בודק…" : label}
      </button>
      {result != null && (
        <pre dir="ltr" className="text-xs bg-surface rounded-xl p-3 overflow-auto max-h-64 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}

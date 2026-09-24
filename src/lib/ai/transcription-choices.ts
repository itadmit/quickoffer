/**
 * Pure by design: no imports.
 *
 * The admin capacity card is a client component, and importing a runtime value
 * from lib/ai/limits.ts pulls settings -> db -> pg into the browser bundle,
 * which fails the build on `dns` and `fs`. Same rule as the Zod schemas beside
 * the server actions (CLAUDE.md).
 */

/**
 * The two transcription engines worth switching between, measured 24.9.2026
 * against five Carmit samples and a real voice note from the Blob.
 *
 * Quality was a tie on the finished quote (5/6 each); they differ in which
 * field they get wrong and in what they cost. gpt-4o-mini-transcribe is
 * excluded on purpose despite being cheaper than whisper-1: it heard
 * "אצל אבי בהרצליה" as "אביב", and a wrong customer name goes on the document
 * the customer reads.
 */
export const TRANSCRIPTION_CHOICES = {
  groq: {
    model: "whisper-large-v3-turbo",
    label: "Groq turbo",
    /** Requests per day. Groq refills it continuously, 43.2s per request. */
    dailyLimit: 2000,
    agorotPer20s: 0.086,
    typicalMs: 267,
    note: "זול ומהיר. תקרה של 2,000 ליום",
  },
  openai: {
    model: "whisper-1",
    label: "OpenAI whisper-1",
    dailyLimit: null,
    agorotPer20s: 0.767,
    typicalMs: 1867,
    note: "יקר פי 9 ואיטי פי 7, בלי תקרה יומית",
  },
} as const;

export type TranscriptionChoice = keyof typeof TRANSCRIPTION_CHOICES;

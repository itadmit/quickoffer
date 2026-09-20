import { eq } from "drizzle-orm";
import {
  getLLMProvider,
  getTranscriptionProvider,
  type BusinessProfile,
  type Command,
  type QuoteJSON,
  type Usage,
} from "../ai";
import { db } from "../db";
import { inboundMessages, processingRuns, quotes, users, type User } from "../db/schema";
import { editLink, publicLink, settingsLink } from "../quotes/links";
import {
  applyJSONToQuote,
  createQuoteFromJSON,
  deleteQuote,
  getActiveDraft,
  getLatestQuote,
  listRecentQuotes,
  markSent,
  quoteToJSON,
  type QuoteWithItems,
} from "../quotes/service";
import { estimateAudioSeconds, fetchMedia, storeFile } from "../storage";
import { sendText, type InboundMessage } from "../whatsapp";
import { checkQuota } from "./quota";
import {
  commands as cmd,
  correctionSummary,
  customerMessage,
  errors,
  forwardHint,
  onboarding as ob,
  quoteSummary,
  quotesList,
} from "./messages";

const MAX_AUDIO_SECONDS = 180;
const PROCESSING_NOTICE_AFTER_MS = 3_000;

/** Entry point for one inbound message, called from the webhook after the 200. */
export async function handleInbound(msg: InboundMessage): Promise<void> {
  const started = Date.now();
  const run = new RunLog(msg.id);
  try {
    const { user, isNew } = await getOrCreateUser(msg);
    if (user.blocked) return;

    if (msg.type === "other") {
      await sendText(user.phone, cmd.unsupportedType());
      return;
    }

    if (user.onboardingState !== "done") {
      await handleOnboarding(user, msg, run, isNew);
    } else {
      await handleReady(user, msg, run);
    }
    await db
      .update(inboundMessages)
      .set({ processedAt: new Date(), error: null })
      .where(eq(inboundMessages.id, msg.id));
  } catch (err) {
    console.error("[handleInbound]", msg.id, err);
    run.error = err instanceof Error ? err.message : String(err);
    await db
      .update(inboundMessages)
      .set({ processedAt: new Date(), error: run.error })
      .where(eq(inboundMessages.id, msg.id));
    try {
      await sendText(msg.from, errors.generic());
    } catch {
      /* gateway down - nothing more to do */
    }
  } finally {
    await run.save(Date.now() - started);
  }
}

// ------------------------------------------------------------------ users

async function getOrCreateUser(
  msg: InboundMessage,
): Promise<{ user: User; isNew: boolean }> {
  const existing = await db.query.users.findFirst({ where: eq(users.phone, msg.from) });
  if (existing) {
    await db
      .update(users)
      .set({ lastActiveAt: new Date(), displayName: msg.fromName ?? existing.displayName })
      .where(eq(users.id, existing.id));
    return { user: existing, isNew: false };
  }
  const [created] = await db
    .insert(users)
    .values({ phone: msg.from, displayName: msg.fromName })
    .onConflictDoNothing()
    .returning();
  if (created) return { user: created, isNew: true };
  // Lost a race with a concurrent webhook for the same new number
  const user = (await db.query.users.findFirst({ where: eq(users.phone, msg.from) }))!;
  return { user, isNew: false };
}

function profileOf(user: User): BusinessProfile {
  return {
    businessName: user.businessName,
    vatStatus: user.vatStatus,
    defaultPaymentTerms: user.defaultPaymentTerms,
    defaultValidDays: user.defaultValidDays,
    defaultNotes: user.defaultNotes ?? [],
  };
}

// ------------------------------------------------------------- onboarding

async function handleOnboarding(
  user: User,
  msg: InboundMessage,
  run: RunLog,
  isFirstMessage: boolean,
) {
  run.kind = "onboarding";
  const suggested = user.displayName;

  // A voice note during onboarding is probably a quote - accept defaults and process it (§6.2).
  if (msg.type === "audio") {
    await finishOnboardingWithDefaults(user, suggested);
    const fresh = (await db.query.users.findFirst({ where: eq(users.id, user.id) }))!;
    await handleReady(fresh, msg, run);
    return;
  }

  if (user.onboardingState === "logo" && msg.type === "image" && msg.media) {
    const url = await saveLogo(user, msg);
    await db
      .update(users)
      .set({ logoUrl: url, onboardingState: "done" })
      .where(eq(users.id, user.id));
    await sendText(user.phone, ob.done(await settingsLink(user.id)));
    return;
  }

  // First contact: no text to interpret yet → ask question 1
  if (user.onboardingState === "name" && msg.type !== "text") {
    await sendText(user.phone, ob.askName(suggested));
    return;
  }
  if (!msg.text) {
    await sendText(user.phone, ob.askName(suggested));
    return;
  }

  // Very first message from a new user - greet, don't interpret it as an answer,
  // unless it already looks like a quote.
  const llm = await getLLMProvider();
  const step = user.onboardingState as "name" | "vat" | "logo";
  const { result: ans, usage } = await llm.parseOnboardingAnswer(msg.text, step, suggested);
  run.llm(usage);

  if (ans.looksLikeQuote) {
    await finishOnboardingWithDefaults(user, suggested);
    const fresh = (await db.query.users.findFirst({ where: eq(users.id, user.id) }))!;
    await handleReady(fresh, msg, run);
    return;
  }

  if (isFirstMessage) {
    await sendText(user.phone, ob.askName(suggested));
    return;
  }

  switch (step) {
    case "name": {
      const name = ans.acceptsSuggestedName
        ? suggested
        : ans.businessName?.trim() || null;
      if (!name) {
        await sendText(user.phone, ob.didntGetName());
        return;
      }
      await db
        .update(users)
        .set({ businessName: name, onboardingState: "vat" })
        .where(eq(users.id, user.id));
      await sendText(user.phone, ob.askVat());
      return;
    }
    case "vat": {
      if (!ans.vatStatus) {
        await sendText(user.phone, ob.didntGetVat());
        return;
      }
      await db
        .update(users)
        .set({ vatStatus: ans.vatStatus, onboardingState: "logo" })
        .where(eq(users.id, user.id));
      await sendText(user.phone, ob.askLogo());
      return;
    }
    case "logo": {
      // any text here that isn't a quote = skip
      await db.update(users).set({ onboardingState: "done" }).where(eq(users.id, user.id));
      await sendText(user.phone, ob.done(await settingsLink(user.id)));
      return;
    }
  }
}

async function finishOnboardingWithDefaults(user: User, suggested: string | null) {
  await db
    .update(users)
    .set({
      businessName: user.businessName ?? suggested ?? "העסק שלי",
      onboardingState: "done",
    })
    .where(eq(users.id, user.id));
}

async function saveLogo(user: User, msg: InboundMessage): Promise<string | null> {
  if (!msg.media) return null;
  try {
    const { buffer, contentType } = await fetchMedia(msg.media.url);
    const ext = (msg.media.fileName ?? "").split(".").pop() || "jpg";
    return await storeFile(
      `logos/${user.id}.${ext}`,
      buffer,
      contentType ?? msg.media.mimetype ?? "image/jpeg",
    );
  } catch (err) {
    console.error("[saveLogo]", err);
    return null;
  }
}

// ------------------------------------------------------------------ ready

async function handleReady(user: User, msg: InboundMessage, run: RunLog) {
  if (msg.type === "image" && msg.media) {
    const url = await saveLogo(user, msg);
    if (url) await db.update(users).set({ logoUrl: url }).where(eq(users.id, user.id));
    await sendText(user.phone, url ? cmd.logoUpdated() : errors.mediaUnavailable());
    return;
  }
  if (msg.type === "document") {
    await sendText(user.phone, cmd.unsupportedType());
    return;
  }

  // Resolve the text: transcript for audio, body for text
  let text: string;
  let audioUrl: string | null = null;
  if (msg.type === "audio") {
    const t = await transcribeInbound(user, msg, run);
    if (!t) return; // error already sent
    text = t.text;
    audioUrl = t.audioUrl;
  } else {
    text = msg.text ?? "";
    if (!text.trim()) {
      await sendText(user.phone, cmd.help());
      return;
    }
  }

  const draft = await getActiveDraft(user.id);
  const llm = await getLLMProvider();

  // Cheap exact-match fallback for commands before spending an LLM call
  const exact = exactCommand(text);
  let intent: Awaited<ReturnType<typeof llm.classifyMessage>>["result"];
  if (exact) {
    intent = { intent: "command", command: exact };
  } else {
    const r = await llm.classifyMessage(text, {
      hasActiveDraft: !!draft,
      draftCustomer: draft?.customerName ?? null,
    });
    run.llm(r.usage);
    intent = r.result;
  }

  switch (intent.intent) {
    case "command":
      await runCommand(user, intent.command ?? "help", draft);
      return;
    case "correction":
      if (draft) {
        await correctDraft(user, draft, text, run);
      } else {
        await newQuote(user, text, audioUrl, run);
      }
      return;
    case "new_quote":
      await newQuote(user, text, audioUrl, run);
      return;
    case "question":
      await sendText(user.phone, cmd.question());
      return;
    case "unclear":
      if (draft) {
        await sendText(user.phone, cmd.unclearCorrectionOrNew(draft.customerName));
      } else {
        await newQuote(user, text, audioUrl, run);
      }
      return;
  }
}

const EXACT: Record<string, Command> = {
  הצעות: "list",
  שלח: "mark_sent",
  שלחתי: "mark_sent",
  pdf: "pdf",
  בטל: "cancel",
  חדש: "new",
  הגדרות: "settings",
  עזרה: "help",
  ערוך: "edit",
  עריכה: "edit",
  "?": "help",
};

function exactCommand(text: string): Command | null {
  return EXACT[text.trim().toLowerCase().replace(/[.!]+$/, "")] ?? null;
}

async function transcribeInbound(
  user: User,
  msg: InboundMessage,
  run: RunLog,
): Promise<{ text: string; audioUrl: string | null } | null> {
  if (!msg.media) {
    await sendText(user.phone, errors.mediaUnavailable());
    return null;
  }
  let buffer: Buffer;
  let contentType: string | null;
  try {
    ({ buffer, contentType } = await fetchMedia(msg.media.url));
  } catch (err) {
    console.error("[media]", msg.media.url, err);
    await sendText(user.phone, errors.mediaUnavailable());
    return null;
  }
  if (estimateAudioSeconds(buffer.length) > MAX_AUDIO_SECONDS) {
    await sendText(user.phone, errors.tooLong());
    return null;
  }

  // Keep our own copy (30 days, debugging) - never the public iBot URL
  const audioUrl = await storeFile(
    `audio/${user.id}/${msg.id}.oga`,
    buffer,
    contentType ?? msg.media.mimetype ?? "audio/ogg",
  );

  // "⏳ מעבד..." only if transcription is slow (§6.3)
  const notice = setTimeout(() => {
    void sendText(user.phone, "⏳ מעבד...");
  }, PROCESSING_NOTICE_AFTER_MS);

  try {
    const asr = await getTranscriptionProvider();
    const { text, usage } = await asr.transcribe(buffer, {
      language: "he",
      hints: user.businessName ? [user.businessName] : [],
      fileName: msg.media.fileName ?? "voice.ogg",
      mimetype: msg.media.mimetype ?? "audio/ogg",
    });
    run.asr(usage, text);
    if (!text || text.length < 2) {
      await sendText(user.phone, errors.transcriptionFailed());
      return null;
    }
    return { text, audioUrl };
  } catch (err) {
    console.error("[transcribe]", err);
    run.error = `transcribe: ${err instanceof Error ? err.message : err}`;
    await sendText(user.phone, errors.transcriptionFailed());
    return null;
  } finally {
    clearTimeout(notice);
  }
}

async function newQuote(user: User, text: string, audioUrl: string | null, run: RunLog) {
  run.kind = "new_quote";
  const quota = await checkQuota(user);
  const llm = await getLLMProvider();
  const { result: json, usage } = await llm.structureQuote(text, profileOf(user));
  run.llm(usage);

  if (!json.items.length) {
    await sendText(user.phone, errors.noItems(text));
    return;
  }

  if (!quota.ok) {
    // Still show the summary, but don't create a link (§11)
    await sendText(
      user.phone,
      errors.quotaExceeded(quota.planLabel, quota.limit, await settingsLink(user.id)),
    );
    return;
  }

  const quote = await createQuoteFromJSON(user, json, { transcript: text, audioUrl });
  run.quoteId = quote.id;
  await sendQuoteMessages(user, quote);
}

async function correctDraft(user: User, draft: QuoteWithItems, text: string, run: RunLog) {
  run.kind = "correction";
  run.quoteId = draft.id;
  const llm = await getLLMProvider();
  const { result, usage } = await llm.applyCorrection(quoteToJSON(draft), text, profileOf(user));
  run.llm(usage);
  const updated = await applyJSONToQuote(draft, result.quote as QuoteJSON, text);
  await sendText(user.phone, correctionSummary(updated, result.changes));
}

/** §6.3 - three messages: summary, forward hint, clean customer message. */
async function sendQuoteMessages(user: User, quote: QuoteWithItems) {
  await sendText(user.phone, quoteSummary(quote, await editLink(quote.id)));
  await sendText(user.phone, forwardHint());
  await sendText(user.phone, customerMessage(quote, user, await publicLink(quote.publicId)));
}

// --------------------------------------------------------------- commands

async function runCommand(user: User, command: Command, draft: QuoteWithItems | null) {
  switch (command) {
    case "list": {
      const list = await listRecentQuotes(user.id, 5);
      const links = await Promise.all(list.map((q) => editLink(q.id)));
      await sendText(user.phone, quotesList(list, links));
      return;
    }
    case "mark_sent": {
      const target = draft ?? (await getLatestQuote(user.id));
      if (!target || target.status !== "draft") {
        await sendText(user.phone, cmd.nothingToSend());
        return;
      }
      await markSent(target.id);
      await sendText(user.phone, cmd.markedSent(target));
      return;
    }
    case "cancel": {
      if (!draft) {
        await sendText(user.phone, cmd.nothingToCancel());
        return;
      }
      await deleteQuote(draft.id);
      await sendText(user.phone, cmd.cancelled(draft));
      return;
    }
    case "new": {
      // Closing the draft context = touching updatedAt back so it's no longer "active"
      if (draft) {
        // keep it a draft, just age it out of the 30-minute window
        await db
          .update(quotes)
          .set({ updatedAt: new Date(Date.now() - 31 * 60 * 1000) })
          .where(eq(quotes.id, draft.id));
      }
      await sendText(user.phone, cmd.newContext());
      return;
    }
    case "settings":
      await sendText(user.phone, cmd.settings(await settingsLink(user.id)));
      return;
    case "edit": {
      const target = draft ?? (await getLatestQuote(user.id));
      if (!target) {
        await sendText(user.phone, cmd.noQuotes());
        return;
      }
      await sendText(user.phone, cmd.editLink(target, await editLink(target.id)));
      return;
    }
    case "pdf":
      await sendText(user.phone, cmd.pdfNotYet());
      return;
    case "help":
    default:
      await sendText(user.phone, cmd.help());
  }
}

// -------------------------------------------------------- processing_runs

class RunLog {
  kind = "classify";
  quoteId: string | null = null;
  error: string | null = null;
  private asrUsage: Usage | null = null;
  private transcript: string | null = null;
  private llmUsages: Usage[] = [];

  constructor(private inboundId: string) {}

  asr(u: Usage, transcript: string) {
    this.asrUsage = u;
    this.transcript = transcript;
  }
  llm(u: Usage) {
    this.llmUsages.push(u);
  }

  async save(totalMs: number) {
    const last = this.llmUsages.at(-1);
    const sum = (f: (u: Usage) => number | undefined) =>
      this.llmUsages.reduce((s, u) => s + (f(u) ?? 0), 0);
    try {
      await db.insert(processingRuns).values({
        inboundMessageId: this.inboundId,
        quoteId: this.quoteId,
        kind: this.kind,
        transcriptionProvider: this.asrUsage?.provider,
        transcriptionModel: this.asrUsage?.model,
        transcriptionMs: this.asrUsage?.ms,
        transcript: this.transcript,
        llmProvider: last?.provider,
        llmModel: last?.model,
        llmMs: sum((u) => u.ms),
        llmInputTokens: sum((u) => u.inputTokens),
        llmOutputTokens: sum((u) => u.outputTokens),
        rawLlmOutput: last?.raw as Record<string, unknown> | undefined,
        costEstimate: (this.asrUsage?.cost ?? 0) + sum((u) => u.cost),
        totalMs,
        error: this.error,
      });
    } catch (err) {
      console.error("[processing_runs] save failed", err);
    }
  }
}

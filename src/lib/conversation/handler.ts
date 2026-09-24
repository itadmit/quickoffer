import { eq } from "drizzle-orm";
import {
  getLLMProvider,
  getTranscriptionProvider,
  type BusinessProfile,
  type Command,
  type QuoteJSON,
  type Usage,
} from "../ai";
import { isRateLimitError } from "../ai/limits";
import { db } from "../db";
import { inboundMessages, processingRuns, quotes, users, type User } from "../db/schema";
import { editLink, publicLink, sendLink, settingsLink, upgradeLink } from "../quotes/links";
import { catalogNames } from "../quotes/price-book";
import { loadPriceBook } from "../quotes/price-book-store";
import {
  applyJSONToQuote,
  createQuoteFromJSON,
  deleteQuote,
  findQuoteToRepeat,
  getActiveDraft,
  getLatestQuote,
  listRecentQuotes,
  markSent,
  quoteToJSON,
  type QuoteWithItems,
} from "../quotes/service";
import {
  jobToQuoteJSON,
  JOB_NAMES_FOR_PROMPT,
  looksLikeNewQuote,
  normalizeJobName,
} from "../quotes/saved-jobs";
import {
  findSavedJob,
  listSavedJobs,
  markJobUsed,
  saveJob,
} from "../quotes/saved-jobs-store";
import { trackMetaEvent } from "../meta/capi";
import { estimateAudioSeconds, fetchMedia, storeFile } from "../storage";
import { sendText, type InboundMessage } from "../whatsapp";
import type { FilledFromBook } from "../quotes/price-book";
import { matchTemplateName, planAllows, PLAN_LABELS } from "../quotes/template-spec";
import { listTemplates } from "../quotes/templates";
import { checkQuota } from "./quota";
import {
  commands as cmd,
  templates as tpl,
  jobs as jobMsg,
  correctionSummary,
  customerMessage,
  errors,
  onboarding as ob,
  quoteSummary,
  quotesList,
  sendHint,
} from "./messages";

const MAX_AUDIO_SECONDS = 180;
const PROCESSING_NOTICE_AFTER_MS = 3_000;
/** Must match the cron tick's `attempts < 3` filter, or a retry is promised and never runs. */
const MAX_ATTEMPTS = 3;

/** Done with this message: the cron tick only looks at rows still null here. */
function markProcessed(id: string, error: string | null) {
  return db
    .update(inboundMessages)
    .set({ processedAt: new Date(), error })
    .where(eq(inboundMessages.id, id));
}

/** Entry point for one inbound message, called from the webhook after the 200. */
export async function handleInbound(msg: InboundMessage): Promise<void> {
  const started = Date.now();
  const run = new RunLog(msg.id);
  try {
    const { user, isNew } = await getOrCreateUser(msg);
    if (user.blocked) return;
    if (isNew) await trackMetaEvent("Lead", user);

    if (msg.type === "other") {
      await sendText(user.phone, cmd.unsupportedType());
      return;
    }

    if (user.onboardingState !== "done") {
      await handleOnboarding(user, msg, run, isNew);
    } else {
      await handleReady(user, msg, run);
    }
    await markProcessed(msg.id, null);
  } catch (err) {
    run.error = err instanceof Error ? err.message : String(err);
    /**
     * A provider rate limit is a queueing problem, not a fault: leave
     * `processed_at` null and the cron tick picks the message back up within
     * five minutes. `attempts` (capped at 3 by the same query) is what stops
     * this from looping forever.
     */
    let reply = errors.generic();
    if (isRateLimitError(err)) {
      // Leave processed_at null so the tick picks it up, and read back the
      // attempt count the tick maintains.
      const [row] = await db
        .update(inboundMessages)
        .set({ error: run.error })
        .where(eq(inboundMessages.id, msg.id))
        .returning({ attempts: inboundMessages.attempts });
      const attempts = row?.attempts ?? MAX_ATTEMPTS;
      if (attempts < MAX_ATTEMPTS) {
        console.error("[handleInbound]", msg.id, `rate limited, attempt ${attempts}`, err);
        // "I'm busy" once, on the first hit. Silence on the retries in between:
        // they were already told, and the promise is still good.
        if (attempts > 1) return;
        reply = errors.busy();
      } else {
        // Out of retries, so stop the tick from picking it up again.
        console.error("[handleInbound]", msg.id, "rate limited, giving up", err);
        await markProcessed(msg.id, run.error);
      }
    } else {
      console.error("[handleInbound]", msg.id, err);
      await markProcessed(msg.id, run.error);
    }
    try {
      await sendText(msg.from, reply);
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
    .values({ phone: msg.from, channel: msg.channel, displayName: msg.fromName })
    .onConflictDoNothing()
    .returning();
  if (created) return { user: created, isNew: true };
  // Lost a race with a concurrent webhook for the same new number
  const user = (await db.query.users.findFirst({ where: eq(users.phone, msg.from) }))!;
  return { user, isNew: false };
}

function profileOf(user: User, catalog: string[] = []): BusinessProfile {
  return {
    businessName: user.businessName,
    vatStatus: user.vatStatus,
    defaultPaymentTerms: user.defaultPaymentTerms,
    defaultValidDays: user.defaultValidDays,
    defaultNotes: user.defaultNotes ?? [],
    catalog,
  };
}

/** The professional's own wording for work they've priced before (§7.2). */
async function catalogOf(userId: string): Promise<string[]> {
  try {
    return catalogNames(await loadPriceBook(userId));
  } catch (err) {
    console.error("[price-book] load failed", err);
    return [];
  }
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
    await trackMetaEvent("CompleteRegistration", user);
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
      await trackMetaEvent("CompleteRegistration", user);
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
  await trackMetaEvent("CompleteRegistration", user);
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

  // Cheap exact-match fallback for commands/greetings before spending an LLM call
  const exact = exactCommand(text);
  const prefixed = exactPrefixChoice(text);
  let intent: Awaited<ReturnType<typeof llm.classifyMessage>>["result"];
  const blank = { designName: null, reference: null, customerName: null };
  if (exact) {
    intent = { intent: "command", command: exact, ...blank };
  } else if (prefixed) {
    // "תבנית <x>": a saved job of theirs wins over a stock design name.
    const asJob =
      prefixed.kind === "either" && !looksLikeNewQuote(prefixed.name)
        ? await findSavedJob(user.id, prefixed.name)
        : null;
    intent = asJob
      ? { intent: "command", command: "job_use", ...blank, reference: asJob.name }
      : { intent: "command", command: "design", ...blank, designName: prefixed.name };
  } else if (isGreeting(text)) {
    intent = { intent: "greeting", command: null, ...blank };
  } else {
    const savedJobNames = (await listSavedJobs(user.id, JOB_NAMES_FOR_PROMPT)).map((j) => j.name);
    const r = await llm.classifyMessage(text, {
      hasActiveDraft: !!draft,
      draftCustomer: draft?.customerName ?? null,
      designNames: (await listTemplates({ enabledOnly: true })).map((t) => t.name),
      jobNames: savedJobNames,
    });
    run.llm(r.usage);
    intent = r.result;

    // §6.8: a message carrying prices or quantities is a new quote even when it
    // names a saved job - otherwise the numbers just said would be dropped.
    if (intent.command === "job_use" && looksLikeNewQuote(text)) {
      intent = { intent: "new_quote", command: null, ...blank };
    }
  }

  switch (intent.intent) {
    case "greeting":
      await sendText(user.phone, cmd.greeting(!!draft));
      return;
    case "command":
      if (intent.command === "design") {
        await chooseDesign(user, intent.designName, draft);
        return;
      }
      await runCommand(user, intent.command ?? "help", draft, intent, run);
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
  // "תבנית" is content (§6.8); the look of the quote is "עיצוב".
  עיצוב: "design",
  עיצובים: "design",
  תבנית: "jobs",
  תבניות: "jobs",
  "התבניות שלי": "jobs",
  עבודות: "jobs",
  "העבודות שלי": "jobs",
  "?": "help",
};

const GREETINGS = new Set([
  "היי", "הי", "שלום", "אהלן", "בוקר טוב", "ערב טוב", "צהריים טובים", "לילה טוב",
  "תודה", "תודה רבה", "מעולה", "סבבה", "אוקיי", "אוקי", "ok", "יופי", "מגניב", "👍", "🙏", "תותח",
]);

function isGreeting(text: string): boolean {
  return GREETINGS.has(text.trim().toLowerCase().replace(/[.!?,]+$/g, ""));
}

function exactCommand(text: string): Command | null {
  return EXACT[text.trim().toLowerCase().replace(/[.!]+$/, "")] ?? null;
}

/**
 * "עיצוב מינימלי" → a design, for sure. "תבנית התקנת מזגן" → ambiguous: since
 * §6.8 "תבנית" means a saved job, but the bot's own older phrasing for designs
 * was "תבנית מודרני" and a design name may still follow it.
 *
 * `kind: "either"` is resolved by the caller, saved job first - a job the
 * professional created themselves beats a stock design name.
 */
function exactPrefixChoice(text: string): { kind: "design" | "either"; name: string } | null {
  const m = /^(תבנית|עיצוב)\s+(.{2,40})$/u.exec(text.trim().replace(/[.!]+$/, ""));
  if (!m) return null;
  return { kind: m[1] === "עיצוב" ? "design" : "either", name: m[2].trim() };
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
    // A rate limit is the one failure worth retrying, so it has to escape this
    // catch and reach handleInbound instead of becoming "לא הצלחתי לשמוע".
    if (isRateLimitError(err)) throw err;
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
  const [quota, llm, catalog] = await Promise.all([
    checkQuota(user),
    getLLMProvider(),
    catalogOf(user.id),
  ]);
  const { result: json, usage } = await llm.structureQuote(text, profileOf(user, catalog));
  run.llm(usage);

  if (!json.items.length) {
    await sendText(user.phone, errors.noItems(text));
    return;
  }

  if (!quota.ok) {
    // Still show the summary, but don't create a link (§11)
    await sendText(
      user.phone,
      errors.quotaExceeded(quota.planLabel, quota.limit, await upgradeLink(user.id)),
    );
    return;
  }

  const quote = await createQuoteFromJSON(user, json, { transcript: text, audioUrl });
  run.quoteId = quote.id;
  await sendQuoteMessages(user, quote, quote.filledFromBook);
}

async function correctDraft(user: User, draft: QuoteWithItems, text: string, run: RunLog) {
  run.kind = "correction";
  run.quoteId = draft.id;
  const [llm, catalog] = await Promise.all([getLLMProvider(), catalogOf(user.id)]);
  const { result, usage } = await llm.applyCorrection(
    quoteToJSON(draft),
    text,
    profileOf(user, catalog),
  );
  run.llm(usage);
  const updated = await applyJSONToQuote(draft, result.quote as QuoteJSON, text);
  // A correction that added the phone number unlocks one-tap send - offer it.
  const gainedPhone = !draft.customerPhone && !!updated.customerPhone;
  await sendText(
    user.phone,
    correctionSummary(updated, result.changes, {
      filled: updated.filledFromBook,
      sendUrl: gainedPhone ? await sendLink(updated.id) : null,
    }),
  );
}

/** §6.3 - three messages: summary, how to send, and the clean customer message. */
async function sendQuoteMessages(
  user: User,
  quote: QuoteWithItems,
  filled: FilledFromBook[] = [],
) {
  await sendText(user.phone, quoteSummary(quote, await editLink(quote.id), filled));
  await sendText(user.phone, sendHint(quote, await sendLink(quote.id)));
  await sendText(user.phone, customerMessage(quote, user, await publicLink(quote.publicId)));
}

// --------------------------------------------------------------- commands

/**
 * "עיצוב" → list the looks; "עיצוב מודרני" → switch (plan permitting).
 * This is `quote_templates`; the professional's own saved jobs are "תבנית".
 */
async function chooseDesign(user: User, designName: string | null, draft: QuoteWithItems | null) {
  const all = await listTemplates({ enabledOnly: true });
  if (all.length === 0) {
    await sendText(user.phone, tpl.none());
    return;
  }
  const currentId = user.templateId ?? all.find((t) => t.isDefault)?.id ?? all[0].id;
  if (!designName) {
    await sendText(
      user.phone,
      tpl.list(
        all.map((t) => ({
          name: t.name,
          description: t.description,
          current: t.id === currentId,
          lockedFor: planAllows(user.plan, t.minPlan) ? null : PLAN_LABELS[t.minPlan],
        })),
        await settingsLink(user.id),
      ),
    );
    return;
  }
  const chosen = matchTemplateName(all, designName);
  if (!chosen) {
    await sendText(user.phone, tpl.notFound(all.map((t) => t.name)));
    return;
  }
  if (!planAllows(user.plan, chosen.minPlan)) {
    await sendText(user.phone, tpl.locked(chosen.name, PLAN_LABELS[chosen.minPlan], await upgradeLink(user.id)));
    return;
  }
  await db.update(users).set({ templateId: chosen.isDefault ? null : chosen.id }).where(eq(users.id, user.id));
  await sendText(user.phone, tpl.chosen(chosen.name, draft ? await editLink(draft.id) : null));
}

/**
 * Start a quote from a JSON we built ourselves rather than from the LLM
 * (§6.8 - repeat and saved jobs). Shares the one creation path so numbering,
 * quota, the price book and events behave exactly as on the voice route.
 */
async function startQuoteFrom(
  user: User,
  json: QuoteJSON,
  run: RunLog,
  source: { transcript: string | null },
): Promise<boolean> {
  const quota = await checkQuota(user);
  if (!quota.ok) {
    await sendText(
      user.phone,
      errors.quotaExceeded(quota.planLabel, quota.limit, await upgradeLink(user.id)),
    );
    return false;
  }
  const quote = await createQuoteFromJSON(user, json, {
    transcript: source.transcript,
    audioUrl: null,
  });
  run.quoteId = quote.id;
  await sendQuoteMessages(user, quote, quote.filledFromBook);
  return true;
}

async function runCommand(
  user: User,
  command: Command,
  draft: QuoteWithItems | null,
  intent: { reference: string | null; customerName: string | null },
  run: RunLog,
) {
  switch (command) {
    case "repeat": {
      run.kind = "repeat";
      if (!intent.reference) {
        await sendText(user.phone, jobMsg.repeatNeedReference());
        return;
      }
      const previous = await findQuoteToRepeat(user.id, intent.reference);
      if (!previous) {
        await sendText(user.phone, jobMsg.repeatNotFound(intent.reference));
        return;
      }
      // Carry the work, not the customer - this quote is for someone else.
      const json: QuoteJSON = {
        ...quoteToJSON(previous),
        customerName: intent.customerName,
        customerPhone: null,
      };
      await startQuoteFrom(user, json, run, {
        transcript: `כמו הצעה #${previous.number}`,
      });
      return;
    }
    case "jobs": {
      const list = await listSavedJobs(user.id);
      await sendText(
        user.phone,
        list.length
          ? jobMsg.list(list, await settingsLink(user.id))
          : jobMsg.none(),
      );
      return;
    }
    case "job_save": {
      const target = draft ?? (await getLatestQuote(user.id));
      if (!target || !target.items.length) {
        await sendText(user.phone, jobMsg.needDraft());
        return;
      }
      const name = normalizeJobName(intent.reference ?? "");
      if (name.length < 2) {
        await sendText(user.phone, jobMsg.needName());
        return;
      }
      const saved = await saveJob(user.id, name, target.items);
      if (!saved) {
        await sendText(user.phone, jobMsg.needName());
        return;
      }
      const total = saved.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      await sendText(
        user.phone,
        jobMsg.saved(saved.job.name, saved.items.length, total, saved.replaced),
      );
      return;
    }
    case "job_use": {
      run.kind = "job_use";
      const job = intent.reference ? await findSavedJob(user.id, intent.reference) : null;
      if (!job) {
        const names = (await listSavedJobs(user.id)).map((j) => j.name);
        await sendText(user.phone, jobMsg.notFound(names));
        return;
      }
      const started = await startQuoteFrom(
        user,
        jobToQuoteJSON(job, intent.customerName),
        run,
        { transcript: `עבודה שמורה: ${job.name}` },
      );
      if (started) await markJobUsed(job.id);
      return;
    }
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
      await sendText(
        user.phone,
        cmd.editLink(target, await editLink(target.id), await sendLink(target.id)),
      );
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

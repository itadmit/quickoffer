import { and, eq, notInArray } from "drizzle-orm";
import { isBot } from "../bots";
import { notifications } from "../conversation/messages";
import { db } from "../db";
import { quotes } from "../db/schema";
import { isMobile } from "../phone";
import { storeFile } from "../storage";
import { sendText } from "../whatsapp";
import { replyLink } from "./links";
import { addEvent, getQuoteByPublicId, snapshotOf } from "./service";
import { getTemplateForUser } from "./templates";

/**
 * Customer-side events (PRODUCT.md §8.2, §6.6). Each one records a
 * quote_event and notifies the professional on WhatsApp.
 */

export async function recordView(
  publicId: string,
  meta: { ip: string | null; ua: string | null },
  opts: { self?: boolean } = {},
) {
  // A link-preview crawler is not a customer (lib/bots.ts). Skipping before the
  // lookup also keeps a crawled link from costing a query.
  if (isBot(meta.ua)) return;
  // The professional's own browser (lib/pro-device.ts) is not a customer either.
  if (opts.self) return;
  const q = await getQuoteByPublicId(publicId);
  if (!q) return;
  if (["approved", "rejected", "expired"].includes(q.status)) return;
  // A quote nobody has sent yet cannot have been opened by the customer: the
  // only person holding the link is the professional, who got it from the bot
  // in the message they are supposed to forward. "sent" is declarative (§10) -
  // the tap on /w, or "שלחתי" in the chat, is what opens the view window.
  if (q.status === "draft" && !q.sentAt) return;

  // First view → status viewed + notification (once). Later views: dedup 1h.
  if (!q.firstViewedAt) {
    await db
      .update(quotes)
      .set({ status: "viewed", firstViewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(quotes.id, q.id), notInArray(quotes.status, ["approved", "rejected", "expired"])));
    await addEvent(q.id, "viewed", { ...meta, first: true });
    await sendText(q.user.phone, notifications.viewed(q));
    return;
  }
  const events = await db.query.quoteEvents.findMany({
    where: (e, { and, eq, gt }) =>
      and(eq(e.quoteId, q.id), eq(e.type, "viewed"), gt(e.at, new Date(Date.now() - 3600_000))),
    limit: 1,
  });
  if (!events.length) {
    await addEvent(q.id, "viewed", meta);
    if (q.status === "sent" || q.status === "draft") {
      await db.update(quotes).set({ status: "viewed" }).where(eq(quotes.id, q.id));
    }
  }
}

export type ApproveInput = {
  signerName: string;
  /** data:image/png;base64,… */
  signaturePng: string;
  ip: string | null;
  ua: string | null;
};

export async function approveQuote(publicId: string, input: ApproveInput) {
  const q = await getQuoteByPublicId(publicId);
  if (!q) return { ok: false as const, error: "not_found" };
  if (q.status === "approved") return { ok: true as const, already: true };
  if (q.status === "rejected" || q.status === "expired") {
    return { ok: false as const, error: "closed" };
  }
  if (q.validUntil && q.validUntil < new Date()) {
    return { ok: false as const, error: "expired" };
  }

  const b64 = input.signaturePng.replace(/^data:image\/png;base64,/, "");
  const signatureUrl = await storeFile(
    `signatures/${q.id}.png`,
    Buffer.from(b64, "base64"),
    "image/png",
  );

  const snapshot = {
    ...snapshotOf(q, await getTemplateForUser(q.user)),
    approval: {
      signerName: input.signerName,
      signatureUrl,
      signatureData: signatureUrl ? undefined : input.signaturePng,
      at: new Date().toISOString(),
    },
  };

  await db
    .update(quotes)
    .set({ status: "approved", approvedAt: new Date(), approvedSnapshot: snapshot, updatedAt: new Date() })
    .where(eq(quotes.id, q.id));
  await addEvent(q.id, "approved", {
    signer_name: input.signerName,
    signature_url: signatureUrl,
    ip: input.ip,
    ua: input.ua,
  });
  await sendText(q.user.phone, notifications.approved(q, input.signerName));
  return { ok: true as const };
}

export async function rejectQuote(publicId: string, reason: string | null) {
  const q = await getQuoteByPublicId(publicId);
  if (!q) return { ok: false as const, error: "not_found" };
  if (q.status === "approved" || q.status === "rejected") {
    return { ok: false as const, error: "closed" };
  }
  await db
    .update(quotes)
    .set({ status: "rejected", rejectedAt: new Date(), updatedAt: new Date() })
    .where(eq(quotes.id, q.id));
  await addEvent(q.id, "rejected", { reason });
  await sendText(q.user.phone, notifications.rejected(q, reason));
  return { ok: true as const };
}

export async function askQuestion(publicId: string, text: string) {
  const q = await getQuoteByPublicId(publicId);
  if (!q) return { ok: false as const, error: "not_found" };
  const clean = text.trim().slice(0, 500);
  if (!clean) return { ok: false as const, error: "empty" };
  await addEvent(q.id, "question", { question: clean });
  // The answer has to leave the bot chat to reach the customer, so hand over
  // the tap that opens their chat - only when there is a number to open it on.
  const replyUrl = isMobile(q.customerPhone) ? await replyLink(q.id) : null;
  await sendText(q.user.phone, notifications.question(q, clean, replyUrl));
  return { ok: true as const };
}

/** The question the reply link should quote: the last one the customer asked. */
export async function latestQuestion(quoteId: string): Promise<string | null> {
  const event = await db.query.quoteEvents.findFirst({
    where: (e, { and, eq }) => and(eq(e.quoteId, quoteId), eq(e.type, "question")),
    orderBy: (e, { desc }) => desc(e.at),
  });
  const question = event?.payload?.question;
  return typeof question === "string" && question.trim() ? question : null;
}

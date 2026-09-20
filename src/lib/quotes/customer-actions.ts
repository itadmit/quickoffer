import { and, eq, notInArray } from "drizzle-orm";
import { notifications } from "../conversation/messages";
import { db } from "../db";
import { quotes } from "../db/schema";
import { storeFile } from "../storage";
import { sendText } from "../whatsapp";
import { addEvent, getQuoteByPublicId, snapshotOf } from "./service";

/**
 * Customer-side events (PRODUCT.md §8.2, §6.6). Each one records a
 * quote_event and notifies the professional on WhatsApp.
 */

export async function recordView(publicId: string, meta: { ip: string | null; ua: string | null }) {
  const q = await getQuoteByPublicId(publicId);
  if (!q) return;
  if (["approved", "rejected", "expired"].includes(q.status)) return;

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
    ...snapshotOf(q),
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
  await sendText(q.user.phone, notifications.question(q, clean));
  return { ok: true as const };
}

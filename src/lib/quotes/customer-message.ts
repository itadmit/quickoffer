/**
 * The message the customer actually receives (PRODUCT.md §6.3, message 3).
 *
 * Pure and dependency-free so the edit screen can rebuild it from the form as
 * the professional types - otherwise "שלח ללקוח" would send the name and total
 * from before their last correction.
 *
 * We know the customer's name but never their gender, so nothing here addresses
 * them in a conjugated form: "לאישור - הקישור למעלה", not "לחץ על הקישור".
 */

export type CustomerMessageInput = {
  customerName: string | null;
  businessName: string | null;
  publicUrl: string;
  /** days the quote stays valid, as told to the customer */
  validDays: number;
};

export function customerMessageText(i: CustomerMessageInput): string {
  const greeting = i.customerName ? `שלום ${i.customerName}, ` : "שלום, ";
  return [
    `${greeting}מצורפת הצעת מחיר מ${i.businessName ?? "העסק"}:`,
    i.publicUrl,
    `ההצעה תקפה ל-${i.validDays} יום. לאישור ולחתימה - הקישור למעלה.`,
  ].join("\n");
}

/**
 * The reply to a question asked from the quote page (§8.2), prefilled in the
 * professional's own WhatsApp.
 *
 * The question arrives in the bot chat, but an answer typed there would reach
 * the bot, not the customer - the customer never talks to us. So we hand the
 * professional their customer's chat with the question already quoted and the
 * cursor on an empty answer line. Asterisks are WhatsApp's bold.
 *
 * The quote keeps the customer oriented ("which question?") while staying
 * short enough that the link doesn't swallow the chat bubble.
 */
export function questionReplyText(question: string): string {
  const q = question.trim().replace(/\s+/g, " ");
  const quoted = q.length > 200 ? `${q.slice(0, 200)}…` : q;
  return `*בקשר לשאלתך:* "${quoted}"\n*התשובה שלי היא:*\n`;
}

/** Days left until `validUntil`, floored at 1 - never tell a customer "0 ימים". */
export function daysUntil(validUntil: Date | string | null, fallback: number): number {
  if (!validUntil) return fallback;
  const at = typeof validUntil === "string" ? new Date(validUntil) : validUntil;
  if (Number.isNaN(at.getTime())) return fallback;
  return Math.max(1, Math.round((at.getTime() - Date.now()) / 86_400_000));
}

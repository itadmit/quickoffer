/**
 * The message the customer actually receives (PRODUCT.md §6.3, message 3).
 *
 * Pure and dependency-free so the edit screen can rebuild it from the form as
 * the professional types - otherwise "שלח ללקוח" would send the name and total
 * from before their last correction.
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
    `ההצעה תקפה ל-${i.validDays} יום. לאישור - לחץ על הקישור.`,
  ].join("\n");
}

/** Days left until `validUntil`, floored at 1 - never tell a customer "0 ימים". */
export function daysUntil(validUntil: Date | string | null, fallback: number): number {
  if (!validUntil) return fallback;
  const at = typeof validUntil === "string" ? new Date(validUntil) : validUntil;
  if (Number.isNaN(at.getTime())) return fallback;
  return Math.max(1, Math.round((at.getTime() - Date.now()) / 86_400_000));
}

/**
 * Phone numbers, in one place. Pure - safe in client components.
 *
 * Canonical form throughout the system is digits in international form without
 * a "+": "972501234567". That is what iBot uses as a jid and what wa.me wants.
 */

/** "050-123-4567" / "+972 50-123-4567" / "0501234567" → "972501234567". */
export function normalizePhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("0")) return `972${d.slice(1)}`;
  if (d.length === 9 && !d.startsWith("0")) return `972${d}`;
  return d || null;
}

/** Display form: "972501234567" → "050-123-4567". Unknown shapes pass through. */
export function formatPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("972") && d.length === 12) return `0${d.slice(3, 5)}-${d.slice(5, 8)}-${d.slice(8)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

/**
 * Is this a number we can safely deep-link to? Israeli mobile only: a landline
 * or a truncated number would open an empty WhatsApp chat, which reads as a bug.
 */
export function isMobile(p: string | null | undefined): boolean {
  const d = normalizePhone(p);
  return !!d && d.length === 12 && d.startsWith("9725");
}

/**
 * Deep link that opens WhatsApp on the customer's chat with the message ready
 * to send - from the professional's own number, so the customer still hears
 * from someone they know (PRODUCT.md §15 decision 7).
 *
 * Without a number it opens the contact picker with the text prefilled, which
 * is still one tap better than copy-paste.
 */
export function waLink(phone: string | null | undefined, text: string): string {
  const to = isMobile(phone) ? normalizePhone(phone) : null;
  return `https://wa.me/${to ?? ""}?text=${encodeURIComponent(text)}`;
}

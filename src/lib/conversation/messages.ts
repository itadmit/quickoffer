import type { Quote, QuoteItem, User } from "../db/schema";
import { formatMoney, formatQty } from "../quotes/calc";
import type { QuoteWithItems } from "../quotes/service";

/**
 * Bot copy - word for word from PRODUCT.md §6. Don't improvise here;
 * change the spec first.
 */

export const onboarding = {
  askName: (suggested: string | null) =>
    `היי! אני QuickOffer - הופך הודעות קוליות להצעות מחיר מעוצבות.\nשתי שאלות קצרות ומתחילים.\n1️⃣ איך קוראים לעסק?${
      suggested ? ` (לפי WhatsApp: "${suggested}" - שלח "כן" או שם אחר)` : ""
    }`,
  askVat: () => `2️⃣ עוסק פטור או עוסק מורשה?\n(מורשה = ההצעות יכללו מע״מ 18%)`,
  askLogo: () => `מעולה. יש לוגו? שלח אותו כתמונה, או "דלג".`,
  done: (settingsUrl: string) =>
    `✅ מוכן! עכשיו פשוט שלח לי הודעה קולית, למשל:\n🎤 "הצעת מחיר לדני כהן - שלוש נקודות חשמל 180 שקל ליחידה, ביקור 200"\nואני מחזיר הצעה מוכנה תוך דקה.\nפרטים נוספים (כתובת, ח.פ., תנאי תשלום קבועים) - כאן: ${settingsUrl}`,
  didntGetName: () => `לא הבנתי 🙂 איך קוראים לעסק? שלח את השם, או "כן" לאישור השם מ-WhatsApp.`,
  didntGetVat: () => `עוסק פטור או עוסק מורשה? (מורשה = ההצעות יכללו מע״מ 18%)`,
  logoSaved: () => `הלוגו נשמר 👌`,
};

export const processing = () => `⏳ מעבד...`;

function itemLine(it: QuoteItem): string {
  const flag = it.needsReview ? " ⚠️" : "";
  return `• ${it.description} ×${formatQty(it.quantity)} - ${formatMoney(it.lineTotal)}${flag}`;
}

function totalsLines(q: Quote): string[] {
  const lines: string[] = [];
  if (q.discountAmount > 0) lines.push(`הנחה: −${formatMoney(q.discountAmount)}`);
  if (q.vatRate === 0) {
    lines.push(`סה״כ ${formatMoney(q.total)} (עוסק פטור, ללא מע״מ)`);
  } else if (q.vatIncluded) {
    lines.push(`סה״כ ${formatMoney(q.total)} כולל מע״מ`);
  } else {
    lines.push(`סה״כ ${formatMoney(q.subtotal - q.discountAmount)} + מע״מ = ${formatMoney(q.total)}`);
  }
  return lines;
}

/** §6.3 message 1 - summary + edit link */
export function quoteSummary(q: QuoteWithItems, editUrl: string): string {
  const lines: string[] = [
    `📋 הצעה #${q.number}${q.customerName ? ` - ${q.customerName}` : ""}`,
    ...q.items.map(itemLine),
    ...totalsLines(q),
  ];
  if (q.paymentTerms) lines.push(`תשלום: ${q.paymentTerms}`);
  const missing = q.items.filter((it) => it.needsReview && it.unitPrice === 0);
  if (missing.length) {
    lines.push(
      `⚠️ חסר מחיר: ${missing.map((m) => m.description).join(", ")} - תגיד לי את המחיר או תקן בעריכה`,
    );
  }
  if (!q.customerName) lines.push(`❓ למי ההצעה? (תגיד לי את שם הלקוח)`);
  lines.push("", `✏️ לתקן: כתוב או תגיד לי ("תשנה ביקור ל-250")`, `🖊️ עריכה מלאה: ${editUrl}`);
  return lines.join("\n");
}

/** §6.3 message 2 */
export const forwardHint = () => `👇 להעביר ללקוח - לחץ לחיצה ארוכה על ההודעה הבאה ← Forward`;

/** §6.3 message 3 - the clean, forwardable message */
export function customerMessage(q: Quote, user: User, publicUrl: string): string {
  const greeting = q.customerName ? `שלום ${q.customerName}, ` : "שלום, ";
  const days = q.validUntil
    ? Math.max(1, Math.round((q.validUntil.getTime() - Date.now()) / 86_400_000))
    : user.defaultValidDays;
  return `${greeting}מצורפת הצעת מחיר מ${user.businessName ?? "העסק"}:\n${publicUrl}\nההצעה תקפה ל-${days} יום. לאישור - לחץ על הקישור.`;
}

/** §6.4 */
export function correctionSummary(q: QuoteWithItems, changes: string[]): string {
  const lines = [`✅ עודכן:`, ...changes.map((c) => `• ${c}`), ...totalsLines(q)];
  return lines.join("\n");
}

/** §6.5 `הצעות` */
export function quotesList(list: Quote[], editUrls: string[]): string {
  if (!list.length) return `עדיין אין הצעות. שלח לי הודעה קולית ונתחיל 🎤`;
  const status: Record<Quote["status"], string> = {
    draft: "טיוטה",
    sent: "נשלחה",
    viewed: "נצפתה 👀",
    approved: "אושרה ✅",
    rejected: "נדחתה ❌",
    expired: "פג תוקף ⌛",
  };
  return [
    `📂 ההצעות האחרונות:`,
    ...list.map(
      (q, i) =>
        `#${q.number} ${q.customerName ?? "(ללא שם)"} - ${formatMoney(q.total)} · ${status[q.status]}\n   ${editUrls[i]}`,
    ),
  ].join("\n");
}

export const commands = {
  markedSent: (q: Quote) => `👍 הצעה #${q.number} סומנה כנשלחה. אעדכן אותך כשהלקוח יפתח.`,
  nothingToSend: () => `אין טיוטה פעילה לסימון. שלח "הצעות" לרשימה.`,
  cancelled: (q: Quote) => `🗑️ הצעה #${q.number} בוטלה.`,
  nothingToCancel: () => `אין טיוטה פעילה לביטול.`,
  newContext: () => `👌 שלח הודעה קולית להצעה חדשה.`,
  settings: (url: string) => `⚙️ הגדרות העסק: ${url}`,
  editLink: (q: Quote, url: string) => `🖊️ עריכת הצעה #${q.number}: ${url}`,
  noQuotes: () => `עדיין אין הצעות. שלח לי הודעה קולית ונתחיל 🎤`,
  pdfNotYet: () =>
    `PDF יגיע בקרוב. בינתיים הקישור ללקוח הוא ההצעה - הוא תמיד מעודכן ומאפשר אישור וחתימה.`,
  help: () =>
    [
      `🎤 שלח הודעה קולית - ואני מחזיר הצעת מחיר.`,
      `כשיש טיוטה פעילה, כתוב או תגיד תיקון: "תשנה ביקור ל-250".`,
      ``,
      `פקודות:`,
      `• הצעות - 5 ההצעות האחרונות`,
      `• שלחתי - לסמן שההצעה נשלחה ללקוח`,
      `• ערוך - קישור לעריכה מלאה`,
      `• בטל - למחוק את הטיוטה`,
      `• חדש - להתחיל הצעה חדשה`,
      `• הגדרות - פרטי העסק והלוגו`,
    ].join("\n"),
  unclearCorrectionOrNew: (customer: string | null) =>
    `לתקן את ההצעה${customer ? ` ל${customer}` : " הפעילה"}, או הצעה חדשה? (ענה "תקן" או "חדש")`,
  unsupportedType: () => `אני מבין הודעות קוליות, טקסט ותמונות (ללוגו).`,
  logoUpdated: () => `הלוגו עודכן 👌`,
  question: () => `אני בוט של הצעות מחיר 🙂 שלח לי הודעה קולית עם ההצעה, או "עזרה" לרשימת פקודות.`,
};

/** §6.7 */
export const errors = {
  transcriptionFailed: () =>
    `לא הצלחתי לשמוע 🙉 נסה שוב במקום שקט יותר, או כתוב לי את ההצעה בטקסט.`,
  noItems: (transcript: string) =>
    `שמעתי: "${transcript.slice(0, 200)}" - אבל לא זיהיתי פריטים ומחירים. נסה: "לדני - 3 נקודות חשמל 180 שקל ליחידה".`,
  mediaUnavailable: () => `יש תקלה זמנית, נסה שוב בעוד דקה.`,
  tooLong: () => `ההקלטה ארוכה מדי - עד 3 דקות.`,
  quotaExceeded: (plan: string, limit: number, upgradeUrl: string) =>
    `השתמשת ב-${limit} ההצעות של חבילת ${plan} החודש. לשדרוג: ${upgradeUrl}`,
  generic: () => `משהו השתבש אצלי 😕 נסה שוב בעוד רגע.`,
};

/** §6.6 */
export const notifications = {
  viewed: (q: Quote) => `👀 ${q.customerName ?? "הלקוח"} פתח את ההצעה #${q.number}`,
  approved: (q: Quote, signer: string) =>
    `✅ ${signer || q.customerName || "הלקוח"} אישר וחתם על הצעה #${q.number} (${formatMoney(q.total)}).`,
  rejected: (q: Quote, reason: string | null) =>
    `❌ ${q.customerName ?? "הלקוח"} דחה את הצעה #${q.number}.${reason ? ` סיבה: "${reason}"` : ""}`,
  question: (q: Quote, text: string) =>
    `💬 ${q.customerName ?? "הלקוח"} שאל על #${q.number}: "${text}" - ענה לו ישירות ב-WhatsApp`,
};

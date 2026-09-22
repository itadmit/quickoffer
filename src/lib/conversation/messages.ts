import type { Quote, QuoteItem, User } from "../db/schema";
import { formatPhone, isMobile } from "../phone";
import { formatMoney, formatQty } from "../quotes/calc";
import { customerMessageText, daysUntil } from "../quotes/customer-message";
import type { FilledFromBook } from "../quotes/price-book";
import type { QuoteWithItems } from "../quotes/service";

/**
 * Bot copy - word for word from PRODUCT.md §6. Don't improvise here;
 * change the spec first.
 */

export const onboarding = {
  askName: (suggested: string | null) =>
    `היי, אני עופר 👋 אתה מדבר - אני כותב את ההצעה.\nשתי שאלות ומתחילים.\n1️⃣ איך קוראים לעסק?${
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

/**
 * Prices we filled from the professional's own price book. Always reported:
 * it is their number, not a guess, but they must be able to catch a stale one.
 */
function priceBookLines(filled: FilledFromBook[]): string[] {
  if (!filled.length) return [];
  return [
    `🧠 השלמתי מחירים שאתה תמיד גובה: ${filled
      .map((f) => `${f.description} ${formatMoney(f.unitPrice)}`)
      .join(", ")} - תגיד לי אם השתנה.`,
  ];
}

/** §6.3 message 1 - summary + edit link */
export function quoteSummary(
  q: QuoteWithItems,
  editUrl: string,
  filled: FilledFromBook[] = [],
): string {
  const lines: string[] = [
    `📋 הצעה #${q.number}${q.customerName ? ` - ${q.customerName}` : ""}`,
    ...q.items.map(itemLine),
    ...totalsLines(q),
  ];
  if (q.paymentTerms) lines.push(`תשלום: ${q.paymentTerms}`);
  lines.push(...priceBookLines(filled));
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

/**
 * §6.3 message 2 - how the quote reaches the customer.
 *
 * With a mobile number we hand over a single tap: the link opens the customer's
 * chat with the message ready, sent from the professional's own number. Without
 * one we fall back to the forward hint and ask for the number, because the tap
 * is worth the one question.
 */
export function sendHint(q: Quote, sendUrl: string): string {
  if (isMobile(q.customerPhone)) {
    const who = q.customerName ?? "הלקוח";
    return [
      `📲 לשלוח ל${who} (${formatPhone(q.customerPhone!)}) - לחץ כאן:`,
      sendUrl,
      `נפתח הצ׳אט עם ההודעה מוכנה. רק ללחוץ שלח.`,
    ].join("\n");
  }
  return [
    `👇 להעביר ללקוח - לחץ לחיצה ארוכה על ההודעה הבאה ← העבר`,
    `(או תגיד לי את המספר שלו - "הטלפון של ${q.customerName ?? "הלקוח"} 050..." - ואשלח לך קישור בלחיצה אחת)`,
  ].join("\n");
}

/** §6.3 message 3 - the clean, forwardable message */
export function customerMessage(q: Quote, user: User, publicUrl: string): string {
  return customerMessageText({
    customerName: q.customerName,
    businessName: user.businessName,
    publicUrl,
    validDays: daysUntil(q.validUntil, user.defaultValidDays),
  });
}

/**
 * §6.4 - correction applied. When the correction was the customer's phone
 * number, the one-tap send link is the natural next step, so offer it here.
 */
export function correctionSummary(
  q: QuoteWithItems,
  changes: string[],
  opts: { filled?: FilledFromBook[]; sendUrl?: string | null } = {},
): string {
  const lines = [
    `✅ עודכן:`,
    ...changes.map((c) => `• ${c}`),
    ...totalsLines(q),
    ...priceBookLines(opts.filled ?? []),
  ];
  if (opts.sendUrl && isMobile(q.customerPhone)) {
    lines.push(
      "",
      `📲 לשלוח ל${q.customerName ?? "לקוח"} (${formatPhone(q.customerPhone!)}):`,
      opts.sendUrl,
    );
  }
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

export const templates = {
  list: (items: { name: string; description: string | null; current: boolean; lockedFor: string | null }[], settingsUrl: string) =>
    [
      `🎨 עיצוב ההצעה:`,
      ...items.map(
        (t, i) =>
          `${i + 1}. ${t.name}${t.current ? " ✓ (נוכחי)" : ""}${t.lockedFor ? ` 🔒 ${t.lockedFor}` : ""}${t.description ? ` - ${t.description}` : ""}`,
      ),
      ``,
      `להחלפה כתוב למשל "תבנית ${items.find((t) => !t.current && !t.lockedFor)?.name ?? items[0]?.name ?? "מודרני"}".`,
      `לראות איך כל תבנית נראית: ${settingsUrl}`,
    ].join("\n"),
  chosen: (name: string, previewUrl: string | null) =>
    `✅ מעכשיו ההצעות שלך בעיצוב "${name}". הצעות שכבר נחתמו לא משתנות.${previewUrl ? `\nלתצוגה מקדימה של הטיוטה: ${previewUrl}` : ""}`,
  notFound: (names: string[]) => `לא מצאתי תבנית כזו. התבניות: ${names.join(" / ")}. כתוב למשל "תבנית ${names[0] ?? "מודרני"}".`,
  locked: (name: string, plan: string, upgradeUrl: string) => `🔒 התבנית "${name}" זמינה בתוכנית ${plan} ומעלה. לשדרוג: ${upgradeUrl}`,
  none: () => `אין כרגע תבניות לבחירה.`,
};

/** §6.8 עבודות - repeat jobs. Distinct from `templates` above, which is design. */
export const jobs = {
  list: (items: { name: string; itemCount: number; total: number }[], settingsUrl: string) =>
    [
      `🔧 העבודות השמורות שלך:`,
      ...items.map(
        (j, i) => `${i + 1}. ${j.name} - ${j.itemCount} פריטים, ${formatMoney(j.total)}`,
      ),
      ``,
      `לשימוש: "${items[0]?.name ?? "התקנת מזגן"} לדני כהן"`,
      `לניהול ועדכון מחירים: ${settingsUrl}`,
    ].join("\n"),
  none: () =>
    [
      `עדיין אין עבודות שמורות.`,
      `כשתהיה לך הצעה שחוזרת על עצמה, כתוב "תשמור את זה כהתקנת מזגן" - ובפעם הבאה "התקנת מזגן לדני כהן" יפתח אותה מוכנה.`,
    ].join("\n"),
  saved: (name: string, itemCount: number, total: number, replaced: boolean) =>
    [
      `✅ ${replaced ? `העבודה "${name}" עודכנה` : `נשמר כעבודה "${name}"`} - ${itemCount} פריטים, ${formatMoney(total)}.`,
      `בפעם הבאה: "${name} לדני כהן".`,
    ].join("\n"),
  needDraft: () =>
    `אין הצעה לשמור. שלח לי הודעה קולית עם ההצעה, ואז "תשמור את זה כ<שם העבודה>".`,
  needName: () => `איך לקרוא לעבודה? למשל: "תשמור את זה כהתקנת מזגן".`,
  notFound: (names: string[]) =>
    names.length
      ? `לא מצאתי עבודה כזו. העבודות שלך: ${names.join(" / ")}.`
      : `אין לך עבודות שמורות עדיין. כתוב "עבודות" ואסביר איך שומרים.`,
  /** The repeat path (§6.8 layer 1) has nothing to fall back on. */
  repeatNotFound: (reference: string) =>
    `לא מצאתי הצעה קודמת ל"${reference}". שלח "הצעות" לרשימה, או תגיד לי את מספר ההצעה.`,
  repeatNeedReference: () =>
    `כמו איזו הצעה? תגיד לי שם לקוח או מספר - למשל "כמו ההצעה של דני כהן".`,
};

export const commands = {
  markedSent: (q: Quote) => `👍 הצעה #${q.number} סומנה כנשלחה. אעדכן אותך כשהלקוח יפתח.`,
  nothingToSend: () => `אין טיוטה פעילה לסימון. שלח "הצעות" לרשימה.`,
  cancelled: (q: Quote) => `🗑️ הצעה #${q.number} בוטלה.`,
  nothingToCancel: () => `אין טיוטה פעילה לביטול.`,
  newContext: () => `👌 שלח הודעה קולית להצעה חדשה.`,
  settings: (url: string) => `⚙️ הגדרות העסק: ${url}`,
  editLink: (q: Quote, url: string, sendUrl: string | null) =>
    [
      `🖊️ עריכת הצעה #${q.number}: ${url}`,
      ...(sendUrl && isMobile(q.customerPhone)
        ? [`📲 לשלוח ל${q.customerName ?? "לקוח"} (${formatPhone(q.customerPhone!)}): ${sendUrl}`]
        : []),
    ].join("\n"),
  noQuotes: () => `עדיין אין הצעות. שלח לי הודעה קולית ונתחיל 🎤`,
  pdfNotYet: () =>
    `הקישור ללקוח הוא ההצעה - תמיד מעודכן, ומאפשר אישור וחתימה. בדף עצמו יש כפתור "הדפס / שמור כ-PDF" אם צריך קובץ.`,
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
      `• עיצוב - לבחור תבנית להצעה`,
      `• עבודות - עבודות שמורות שחוזרות על עצמן`,
      ``,
      `עבודה שחוזרת? "תשמור את זה כהתקנת מזגן", ובפעם הבאה "התקנת מזגן לדני כהן".`,
      `או פשוט: "כמו ההצעה של דני, אבל לשרון".`,
    ].join("\n"),
  unclearCorrectionOrNew: (customer: string | null) =>
    `לתקן את ההצעה${customer ? ` ל${customer}` : " הפעילה"}, או הצעה חדשה? (ענה "תקן" או "חדש")`,
  unsupportedType: () => `אני מבין הודעות קוליות, טקסט ותמונות (ללוגו).`,
  logoUpdated: () => `הלוגו עודכן 👌`,
  question: () => `אני עופר, הבוט של QuickOffer - אני עושה הצעות מחיר 🙂 שלח לי הודעה קולית עם ההצעה, או "עזרה" לרשימת פקודות.`,
  greeting: (hasDraft: boolean) =>
    hasDraft
      ? `👋 יש לך טיוטה פעילה. תגיד לי תיקון, "שלחתי" כשהעברת ללקוח, או שלח הודעה קולית להצעה חדשה.`
      : `👋 היי, אני עופר - אתה מדבר, אני כותב את ההצעה. שלח לי הודעה קולית, למשל:
🎤 "הצעת מחיר לדני כהן - שלוש נקודות חשמל 180 שקל ליחידה, ביקור 200"
ואני מחזיר הצעה מוכנה תוך דקה.`,
};

/**
 * Billing. Money messages are the ones people screenshot, so they say the
 * amount, the plan and what happens next - never just "יש בעיה".
 */
export const billing = {
  upgraded: (plan: string, manageUrl: string) =>
    [
      `✅ החבילה שודרגה ל-${plan}.`,
      `המכסה נפתחה עכשיו, והחשבונית נשלחה לאימייל שנתת.`,
      `לניהול החבילה: ${manageUrl}`,
    ].join("\n"),
  chargeFailed: (plan: string, updateUrl: string) =>
    [
      `⚠️ החיוב החודשי לחבילת ${plan} לא עבר.`,
      `החבילה ממשיכה לפעול ואנחנו ננסה שוב בימים הקרובים.`,
      `כדי לא לאבד אותה - עדכן אמצעי תשלום: ${updateUrl}`,
    ].join("\n"),
  chargeRecovered: (plan: string) => `👍 החיוב עבר. חבילת ${plan} ממשיכה כרגיל.`,
  cancelled: (plan: string, upgradeUrl: string) =>
    [
      `חבילת ${plan} הסתיימה, וחזרת לחבילת הניסיון.`,
      `ההצעות שכבר שלחת ממשיכות לעבוד כרגיל.`,
      `לחידוש: ${upgradeUrl}`,
    ].join("\n"),
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
    [
      `הגעת ל-${limit} ההצעות של חבילת ${plan}.`,
      `ההצעה למעלה מוכנה - רק הקישור ללקוח נעול עד השדרוג.`,
      `👉 ${upgradeUrl}`,
    ].join("\n"),
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

  /**
   * The quote went quiet. Sent at most twice per quote (lib/quotes/follow-up.ts):
   * a nudge that closes deals, not a drip campaign.
   */
  followUp: (q: Quote, days: number, sendUrl: string | null) => {
    const who = q.customerName ?? "הלקוח";
    const what =
      q.status === "viewed"
        ? `👀 ${who} פתח את הצעה #${q.number} (${formatMoney(q.total)}) לפני ${days} ימים ולא חזר אליך.`
        : `⏳ הצעה #${q.number} ל${who} (${formatMoney(q.total)}) נשלחה לפני ${days} ימים ועוד לא נפתחה.`;
    const nudge = sendUrl
      ? `רוצה לשלוח תזכורת? לחץ כאן ותקבל הודעה מוכנה:\n${sendUrl}`
      : `שווה טלפון או הודעה - הצעה שנסגרת ביום השלישי שווה יותר מהצעה שנשכחת.`;
    return `${what}\n${nudge}`;
  },
};

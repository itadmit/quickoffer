import type { Quote, QuoteItem, User } from "../db/schema";
import { formatPhone, isMobile } from "../phone";
import { formatMoney, formatQty } from "../quotes/calc";
import { customerMessageText, daysUntil } from "../quotes/customer-message";
import type { FilledFromBook } from "../quotes/price-book";
import type { QuoteWithItems } from "../quotes/service";

/**
 * Bot copy - word for word from PRODUCT.md §6. Don't improvise here;
 * change the spec first.
 *
 * **Gender.** Half the trades we serve are women, and Hebrew has no neutral
 * second person - "שלח" tells a plumber named Sharon this wasn't written for
 * her. So nothing here addresses the professional or their customer in a
 * gendered form, and we get there with real Hebrew rather than slashes:
 *
 * - infinitive instead of imperative - "אפשר לשלוח" / "לכתוב", not "שלח"
 * - impersonal plural - "מדברים - ואני כותב", not "אתה מדבר"
 * - passive for what the customer did - "הצעה #12 נפתחה", not "דני פתח"
 * - unvocalised forms that are already identical: past 2nd person (שלחת,
 *   הגעת, נתת), the pronouns לך / אותך / אליך, and רוצה
 *
 * Verbs pointed *at the bot* stay masculine - עופר is a he, and "תשנה ביקור
 * ל-250" is the user talking to him.
 */

/**
 * The line every button on the landing page puts in the user's mouth.
 *
 * Shared rather than duplicated because the handler has to recognise it: it is
 * the single most common message the bot will ever receive, and it contains the
 * words "הצעת מחיר" without being one.
 */
export const OPENING_LINE = "אני רוצה הצעת מחיר מעוצבת";

export const onboarding = {
  askName: (suggested: string | null) =>
    `היי, אני עופר 👋 מדברים - ואני כותב את ההצעה.\nשתי שאלות ומתחילים.\n1️⃣ איך קוראים לעסק?${
      suggested ? ` (לפי WhatsApp: "${suggested}" - לכתוב "כן" או שם אחר)` : ""
    }`,
  askVat: () => `2️⃣ עוסק פטור, עוסק מורשה או חברה בע״מ?\n(מורשה/בע״מ = ההצעות יכללו מע״מ 18%)`,
  askLogo: () => `מעולה. יש לוגו? אפשר לשלוח אותו כתמונה, או לכתוב "דלג".`,
  /**
   * The activation message. Only two capabilities are named: correcting by
   * voice (the first worry a new user has) and "עזרה" as the door to the rest.
   * Anything that acts on an existing quote - templates, "שלחתי", designs -
   * has nothing to refer to yet and reads as noise here (PRODUCT.md §6.2).
   */
  done: (settingsUrl: string) =>
    [
      `✅ הכול מוכן. אפשר לשלוח לי הודעה קולית, למשל:`,
      `🎤 "הצעת מחיר לדני כהן - שלוש נקודות חשמל 180 שקל ליחידה, ביקור 200"`,
      `ותוך דקה חוזרת הצעה מוכנה להעברה ללקוח.`,
      ``,
      `טעיתי במשהו? פשוט להגיד לי - "תשנה ביקור ל-250".`,
      `"עזרה" - כל מה שאני יודע לעשות.`,
      ``,
      `פרטי העסק (כתובת, ח.פ., תנאי תשלום) - כאן: ${settingsUrl}`,
    ].join("\n"),
  didntGetName: () =>
    `לא הבנתי 🙂 איך קוראים לעסק? אפשר לכתוב את השם, או "כן" לאישור השם מ-WhatsApp.`,
  didntGetVat: () => `עוסק פטור, עוסק מורשה או חברה בע״מ? (מורשה/בע״מ = ההצעות יכללו מע״מ 18%)`,
  logoSaved: () => `הלוגו נשמר 👌`,
};

export const processing = () => `⏳ מעבד...`;

function itemLine(it: QuoteItem): string {
  const flag = it.needsReview ? " ⚠️" : "";
  return `• ${it.description} ×${formatQty(it.quantity)} - ${formatMoney(it.lineTotal)}${flag}`;
}

function totalsLines(q: Quote): string[] {
  const lines: string[] = [];
  if (q.discountAmount > 0) lines.push(`הנחה: -${formatMoney(q.discountAmount)}`);
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
    `🧠 השלמתי לפי המחירים הקבועים שלך: ${filled
      .map((f) => `${f.description} ${formatMoney(f.unitPrice)}`)
      .join(", ")} - להגיד לי אם השתנה.`,
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
      `⚠️ חסר מחיר: ${missing.map((m) => m.description).join(", ")} - להגיד לי את המחיר או לתקן בעריכה`,
    );
  }
  if (!q.customerName) lines.push(`❓ למי ההצעה? (אפשר להגיד לי את שם הלקוח)`);
  lines.push("", `✏️ לתקן: לכתוב או להגיד לי ("תשנה ביקור ל-250")`, `🖊️ עריכה מלאה: ${editUrl}`);
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
      `📲 לשלוח ל${who} (${formatPhone(q.customerPhone!)}) - בלחיצה אחת:`,
      sendUrl,
      `נפתח הצ׳אט עם ההודעה מוכנה. רק ללחוץ שלח.`,
    ].join("\n");
  }
  return [
    `👇 להעביר ללקוח - לחיצה ארוכה על ההודעה הבאה ← העבר`,
    `(או להגיד לי את הטלפון - "הטלפון של ${q.customerName ?? "הלקוח"} 050..." - ואשלח לך קישור בלחיצה אחת)`,
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
  if (!list.length) return `עדיין אין הצעות. אפשר לשלוח לי הודעה קולית ומתחילים 🎤`;
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
      `להחלפה - לכתוב למשל "עיצוב ${items.find((t) => !t.current && !t.lockedFor)?.name ?? items[0]?.name ?? "מודרני"}".`,
      `לראות איך כל עיצוב נראה: ${settingsUrl}`,
    ].join("\n"),
  chosen: (name: string, previewUrl: string | null) =>
    `✅ מעכשיו ההצעות שלך בעיצוב "${name}". הצעות שכבר נחתמו לא משתנות.${previewUrl ? `\nלתצוגה מקדימה של הטיוטה: ${previewUrl}` : ""}`,
  notFound: (names: string[]) => `לא מצאתי עיצוב כזה. העיצובים: ${names.join(" / ")}. לכתוב למשל "עיצוב ${names[0] ?? "מודרני"}".`,
  locked: (name: string, plan: string, upgradeUrl: string) => `🔒 העיצוב "${name}" זמין בתוכנית ${plan} ומעלה. לשדרוג: ${upgradeUrl}`,
  none: () => `אין כרגע עיצובים לבחירה.`,
};

/**
 * §6.8 - the professional's own saved jobs. To them this is "תבנית"; the
 * `templates` group above is the *look* of the quote, which they call "עיצוב".
 */
export const jobs = {
  list: (items: { name: string; itemCount: number; total: number }[], settingsUrl: string) =>
    [
      `🔧 התבניות השמורות שלך:`,
      ...items.map(
        (j, i) => `${i + 1}. ${j.name} - ${j.itemCount} פריטים, ${formatMoney(j.total)}`,
      ),
      ``,
      `לשימוש: "${items[0]?.name ?? "התקנת מזגן"} לדני כהן"`,
      `לניהול ועדכון מחירים: ${settingsUrl}`,
    ].join("\n"),
  none: () =>
    [
      `עדיין אין תבניות שמורות.`,
      `כשתהיה לך הצעה שחוזרת על עצמה - "תשמור את זה כהתקנת מזגן", ובפעם הבאה "התקנת מזגן לדני כהן" יפתח אותה מוכנה.`,
    ].join("\n"),
  saved: (name: string, itemCount: number, total: number, replaced: boolean) =>
    [
      `✅ ${replaced ? `התבנית "${name}" עודכנה` : `נשמר כתבנית "${name}"`} - ${itemCount} פריטים, ${formatMoney(total)}.`,
      `בפעם הבאה: "${name} לדני כהן".`,
    ].join("\n"),
  needDraft: () =>
    `אין הצעה לשמור. קודם הודעה קולית עם ההצעה, ואז "תשמור את זה כ<שם התבנית>".`,
  needName: () => `איך לקרוא לתבנית? למשל: "תשמור את זה כהתקנת מזגן".`,
  notFound: (names: string[]) =>
    names.length
      ? `לא מצאתי תבנית כזו. התבניות שלך: ${names.join(" / ")}.`
      : `אין לך תבניות שמורות עדיין - לכתוב "תבניות" ואסביר איך שומרים.`,
  /** The repeat path (§6.8 layer 1) has nothing to fall back on. */
  repeatNotFound: (reference: string) =>
    `לא מצאתי הצעה קודמת ל"${reference}". לכתוב "הצעות" לרשימה, או להגיד לי את מספר ההצעה.`,
  repeatNeedReference: () =>
    `כמו איזו הצעה? אפשר להגיד לי שם לקוח או מספר - למשל "כמו ההצעה של דני כהן".`,
};

export const commands = {
  markedSent: (q: Quote) => `👍 הצעה #${q.number} סומנה כנשלחה. אעדכן אותך כשההצעה תיפתח.`,
  nothingToSend: () => `אין טיוטה פעילה לסימון. לכתוב "הצעות" לרשימה.`,
  cancelled: (q: Quote) => `🗑️ הצעה #${q.number} בוטלה.`,
  nothingToCancel: () => `אין טיוטה פעילה לביטול.`,
  newContext: () => `👌 מוכן להצעה חדשה - אפשר לשלוח הודעה קולית.`,
  settings: (url: string) => `⚙️ הגדרות העסק: ${url}`,
  editLink: (q: Quote, url: string, sendUrl: string | null) =>
    [
      `🖊️ עריכת הצעה #${q.number}: ${url}`,
      ...(sendUrl && isMobile(q.customerPhone)
        ? [`📲 לשלוח ל${q.customerName ?? "לקוח"} (${formatPhone(q.customerPhone!)}): ${sendUrl}`]
        : []),
    ].join("\n"),
  noQuotes: () => `עדיין אין הצעות. אפשר לשלוח לי הודעה קולית ומתחילים 🎤`,
  pdfNotYet: () =>
    `הקישור ללקוח הוא ההצעה - תמיד מעודכן, ומאפשר אישור וחתימה. בדף עצמו יש כפתור "הדפס / שמור כ-PDF" אם צריך קובץ.`,
  help: () =>
    [
      `🎤 הודעה קולית - ואני מחזיר הצעת מחיר.`,
      `כשיש טיוטה פעילה, אפשר לכתוב או להגיד תיקון: "תשנה ביקור ל-250".`,
      ``,
      `פקודות:`,
      `• הצעות - 5 ההצעות האחרונות`,
      `• שלחתי - לסמן שההצעה נשלחה ללקוח`,
      `• ערוך - קישור לעריכה מלאה`,
      `• בטל - למחוק את הטיוטה`,
      `• חדש - להתחיל הצעה חדשה`,
      `• הגדרות - פרטי העסק והלוגו`,
      `• עיצוב - איך ההצעה נראית`,
      `• תבניות - עבודות שמורות שחוזרות על עצמן`,
      ``,
      `עבודה שחוזרת? "תשמור את זה כהתקנת מזגן", ובפעם הבאה "התקנת מזגן לדני כהן".`,
      `או פשוט: "כמו ההצעה של דני, אבל לשרון".`,
    ].join("\n"),
  unclearCorrectionOrNew: (customer: string | null) =>
    `לתקן את ההצעה${customer ? ` ל${customer}` : " הפעילה"}, או הצעה חדשה? (לכתוב "תקן" או "חדש")`,
  unsupportedType: () => `אני מבין הודעות קוליות, טקסט ותמונות (ללוגו).`,
  logoUpdated: () => `הלוגו עודכן 👌`,
  question: () => `אני עופר, הבוט של QuickOffer - אני עושה הצעות מחיר 🙂 אפשר לשלוח לי הודעה קולית עם ההצעה, או "עזרה" לרשימת פקודות.`,
  greeting: (hasDraft: boolean) =>
    hasDraft
      ? `👋 יש לך טיוטה פעילה. אפשר להגיד לי תיקון, לכתוב "שלחתי" כשהעברת ללקוח, או לשלוח הודעה קולית להצעה חדשה.`
      : `👋 היי, אני עופר - מדברים, ואני כותב את ההצעה. אפשר לשלוח לי הודעה קולית, למשל:
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
      `כדי לא לאבד אותה - לעדכן אמצעי תשלום: ${updateUrl}`,
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
    `לא הצלחתי לשמוע 🙉 אפשר לנסות שוב במקום שקט יותר, או לכתוב לי את ההצעה בטקסט.`,
  noItems: (transcript: string) =>
    `שמעתי: "${transcript.slice(0, 200)}" - אבל לא זיהיתי פריטים ומחירים. למשל: "לדני - 3 נקודות חשמל 180 שקל ליחידה".`,
  mediaUnavailable: () => `יש תקלה זמנית, אפשר לנסות שוב בעוד דקה.`,
  tooLong: () => `ההקלטה ארוכה מדי - עד 3 דקות.`,
  quotaExceeded: (plan: string, limit: number, upgradeUrl: string) =>
    [
      `הגעת ל-${limit} ההצעות של חבילת ${plan}.`,
      `ההצעה למעלה מוכנה - רק הקישור ללקוח נעול עד השדרוג.`,
      `👉 ${upgradeUrl}`,
    ].join("\n"),
  generic: () => `משהו השתבש אצלי 😕 אפשר לנסות שוב בעוד רגע.`,
  /**
   * The AI provider is rate limited. Sent once, and then the message really is
   * retried (cron tick) - so this promises something we keep.
   */
  busy: () => `יש עומס רגעי 🙏 ההודעה שלך אצלי, אני חוזר אליך תוך כמה דקות. אין צורך לשלוח שוב.`,
};

/**
 * §6.6 - what the customer did, reported to the professional.
 *
 * Phrased around the quote ("הצעה #12 נפתחה") rather than around the customer
 * ("דני פתח"), because the customer's gender is a name we can't conjugate: half
 * of them are Sharon, Noa or Michal. The name still leads with a dash when we
 * have one, so the notification is scannable at a glance.
 */
export const notifications = {
  viewed: (q: Quote) =>
    `👀 הצעה #${q.number} נפתחה${q.customerName ? ` - ${q.customerName}` : ""}`,
  approved: (q: Quote, signer: string) => {
    const by = signer || q.customerName;
    return `✅ הצעה #${q.number} אושרה ונחתמה (${formatMoney(q.total)})${by ? ` - ${by}` : ""}.`;
  },
  rejected: (q: Quote, reason: string | null) =>
    `❌ הצעה #${q.number} נדחתה${q.customerName ? ` - ${q.customerName}` : ""}.${reason ? ` סיבה: "${reason}"` : ""}`,
  /**
   * A question typed on the quote page. The answer must not be typed back here
   * - this chat is with the bot, and the customer would never see it - so the
   * notification carries a one-tap way into the customer's own chat with the
   * question already quoted.
   */
  question: (q: Quote, text: string, replyUrl: string | null) => {
    const who = q.customerName ?? "הלקוח";
    const lines = [`💬 הגיעה שאלה על הצעה #${q.number} מ${who}:`, `"${text}"`, ``];
    if (replyUrl && isMobile(q.customerPhone)) {
      lines.push(
        `📲 לענות ל${who} בשיחה אישית (${formatPhone(q.customerPhone!)}):`,
        replyUrl,
        `נפתח הצ׳אט עם השאלה מצוטטת - רק להשלים את התשובה ולשלוח.`,
      );
    } else {
      lines.push(`תשובה כאן בצ׳אט מגיעה אליי, לא ללקוח - אפשר לענות ישירות ב-WhatsApp.`);
    }
    return lines.join("\n");
  },

  /**
   * The quote went quiet. Sent at most twice per quote (lib/quotes/follow-up.ts):
   * a nudge that closes deals, not a drip campaign.
   */
  followUp: (q: Quote, days: number, sendUrl: string | null) => {
    const who = q.customerName ?? "הלקוח";
    const what =
      q.status === "viewed"
        ? `👀 הצעה #${q.number} ל${who} (${formatMoney(q.total)}) נפתחה לפני ${days} ימים - ומאז שקט.`
        : `⏳ הצעה #${q.number} ל${who} (${formatMoney(q.total)}) נשלחה לפני ${days} ימים ועוד לא נפתחה.`;
    const nudge = sendUrl
      ? `רוצה לשלוח תזכורת? כאן יש הודעה מוכנה:\n${sendUrl}`
      : `שווה טלפון או הודעה - הצעה שנסגרת ביום השלישי שווה יותר מהצעה שנשכחת.`;
    return `${what}\n${nudge}`;
  },
};

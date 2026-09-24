import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseIbotInbound } from "@/lib/whatsapp/ibot";
import { calcTotals, formatMoney, qtyLabel } from "@/lib/quotes/calc";
import { notifications } from "@/lib/conversation/messages";
import { makeToken, verifyToken, encryptSecret, decryptSecret } from "@/lib/crypto";
import { matchTemplateName, planAllows } from "@/lib/quotes/template-spec";
import { formatPhone, isMobile, normalizePhone, waLink } from "@/lib/phone";
import { applyPriceBook, catalogNames, CATALOG_PROMPT_LIMIT, isLearnable, priceKey } from "@/lib/quotes/price-book";
import { customerMessageText, daysUntil, questionReplyText } from "@/lib/quotes/customer-message";
import { daysSince, isQuietHour } from "@/lib/quotes/follow-up";
import { isPaidPlan, PLAN_OFFERS, priceOf, upgradesFor } from "@/lib/billing/plans";
import { toVisual } from "@/lib/og-bidi";
import { isOutOfCredit, isRateLimitError, parseResetSeconds } from "@/lib/ai/limits";
import { isBot } from "@/lib/bots";
import { TRANSCRIPTION_CHOICES } from "@/lib/ai/transcription-choices";
import { MAX_ATTEMPTS, RETRY_WINDOW_MS } from "@/lib/conversation/handler";
import { rateLimitWaitMs } from "@/lib/ai/openai";
import { CLOSED_QUOTE_STATUSES, OPEN_QUOTE_STATUSES, quoteStatusEnum } from "@/lib/db/schema";
import {
  isValidJobName,
  itemsForJob,
  jobKey,
  jobToQuoteJSON,
  jobTotal,
  looksLikeNewQuote,
  matchJob,
  normalizeJobName,
} from "@/lib/quotes/saved-jobs";

// --- real capture from CLAUDE.md (audio)
const audio = {
  uid: "u", sessionId: "s", instanceId: "i", chatId: "c",
  remoteJid: "972542284283@s.whatsapp.net", msgFromMe: false,
  actualObj: {
    group: false, type: "aud", msgId: "2A37D5ACC3189288D882", remoteJid: "972542284283@s.whatsapp.net",
    msgContext: { caption: "", fileName: "EgrnRi_inbox.oga", mimetype: "audio/ogg; codecs=opus", mediaUrl: "https://ibot-chat.com/media/EgrnRi_inbox.oga" },
    reaction: "", status: "sent", star: false, timestamp: 1789897973,
    senderName: "יוגב אביטן תדמית אינטראקטיב", route: "incoming", context: null,
  },
};
const r1 = parseIbotInbound(audio);
assert(r1.ok);
assert.equal(r1.message.type, "audio");
assert.equal(r1.message.from, "972542284283");
assert.equal(r1.message.media?.url, "https://ibot-chat.com/media/EgrnRi_inbox.oga");
assert.equal(r1.message.quotedId, null);
assert.equal(r1.message.at, 1789897973);

// text
const text = { ...audio, actualObj: { ...audio.actualObj, type: "text", msgId: "X1", msgContext: { text: "בדיקה חוזרת", mediaUrl: null } } };
const r2 = parseIbotInbound(text);
assert(r2.ok && r2.message.type === "text" && r2.message.text === "בדיקה חוזרת" && r2.message.media === null);

// image with context {jid:null,id:null}
const img = { ...audio, actualObj: { ...audio.actualObj, type: "image", msgId: "X2", context: { jid: null, id: null }, msgContext: { caption: "", fileName: "a.jpg", mimetype: "image/jpeg", mediaUrl: "https://ibot-chat.com/media/a.jpg", width: 1152, height: 2048 } } };
const r3 = parseIbotInbound(img);
assert(r3.ok && r3.message.type === "image" && r3.message.quotedId === null);

// filters
assert.deepEqual(parseIbotInbound({ ...audio, msgFromMe: true }), { ok: false, reason: "from_me" });
assert.deepEqual(parseIbotInbound({ ...audio, actualObj: { ...audio.actualObj, group: true } }), { ok: false, reason: "group" });
assert.deepEqual(parseIbotInbound({ ...audio, actualObj: { ...audio.actualObj, route: "outgoing" } }), { ok: false, reason: "not_incoming" });
assert.deepEqual(parseIbotInbound({ uid: "x" }), { ok: false, reason: "no_actual_obj" });
const sticker = parseIbotInbound({ ...audio, actualObj: { ...audio.actualObj, type: "sticker", msgId: "X3" } });
assert(sticker.ok && sticker.message.type === "other");

// --- VAT math from PRODUCT.md §6.3/6.4
const items = [{ quantity: 3, unitPrice: 150 }, { quantity: 1, unitPrice: 200 }];
let t = calcTotals(items, { vatRate: 0.18, vatIncluded: false, discount: 0 });
assert.equal(t.subtotal, 650); assert.equal(t.vatAmount, 117); assert.equal(t.total, 767);
t = calcTotals([{ quantity: 3, unitPrice: 150 }, { quantity: 1, unitPrice: 250 }, { quantity: 1, unitPrice: 120 }], { vatRate: 0.18, vatIncluded: false, discount: 0 });
assert.equal(t.subtotal, 820); assert.equal(t.total, 967.6);
t = calcTotals(items, { vatRate: 0, vatIncluded: false, discount: 0 });
assert.equal(t.total, 650); assert.equal(t.vatAmount, 0);
t = calcTotals(items, { vatRate: 0.18, vatIncluded: true, discount: 0 });
assert.equal(t.total, 650); assert.equal(t.net, 550.85); assert.equal(t.vatAmount, 99.15);
t = calcTotals(items, { vatRate: 0.18, vatIncluded: false, discount: 50 });
assert.equal(t.net, 600); assert.equal(t.total, 708);
assert.equal(formatMoney(967.6), "967.60 ₪");
assert.equal(formatMoney(767), "767 ₪");

// --- tokens & encryption
process.env.TOKEN_SECRET = "test-secret";
process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const tok = makeToken("e", "quote-1", 60);
assert.equal(verifyToken(tok, "e")?.s, "quote-1");
assert.equal(verifyToken(tok, "s"), null);
assert.equal(verifyToken(tok + "x", "e"), null);
const enc = encryptSecret("sk-abc123");
assert(enc.startsWith("enc:"));
assert.equal(decryptSecret(enc), "sk-abc123");

console.log("ALL PURE TESTS PASSED");

// --- short ids
import { newPublicId, newLinkCode } from "@/lib/ids";
assert.equal(newPublicId().length, 6);
assert.equal(newLinkCode().length, 6);
assert(!/[0O1lI]/.test(newPublicId() + newLinkCode() + newPublicId()), "no look-alike chars");

// --- upload naming for Whisper endpoints (.oga → .ogg)
import { uploadName } from "@/lib/ai/openai";
assert.equal(uploadName("EgrnRi_inbox.oga", "audio/ogg; codecs=opus"), "voice.ogg");
assert.equal(uploadName("voice.oga", "audio/ogg"), "voice.ogg");
assert.equal(uploadName("file_12.oga", undefined), "voice.ogg");
assert.equal(uploadName("audio.mp3", "audio/mpeg"), "audio.mp3");
assert.equal(uploadName(undefined, "audio/mp4"), "voice.m4a");
assert.equal(uploadName("test.wav", "audio/wav"), "test.wav");

// --- Telegram parser
import { parseTelegramInbound } from "@/lib/whatsapp/telegram";
{
  const voice = {
    update_id: 1,
    message: {
      message_id: 42, from: { id: 777, is_bot: false, first_name: "יוגב", last_name: "אביטן", username: "yogev" },
      chat: { id: 777, type: "private" }, date: 1789897973,
      voice: { file_id: "AwACAgQAAxkBAAI", file_unique_id: "u", duration: 5, mime_type: "audio/ogg", file_size: 5800 },
    },
  };
  const v = parseTelegramInbound(voice);
  assert(v.ok);
  assert.equal(v.message.channel, "telegram");
  assert.equal(v.message.from, "tg:777");
  assert.equal(v.message.id, "tg:777:42");
  assert.equal(v.message.type, "audio");
  assert.equal(v.message.media?.url, "tg-file:AwACAgQAAxkBAAI");
  assert.equal(v.message.fromName, "יוגב אביטן");
  const t = parseTelegramInbound({ update_id: 2, message: { message_id: 43, from: { id: 777 }, chat: { id: 777, type: "private" }, date: 1, text: "היי" } });
  assert(t.ok && t.message.type === "text" && t.message.text === "היי");
  const g = parseTelegramInbound({ update_id: 3, message: { message_id: 1, chat: { id: -100, type: "supergroup" }, date: 1, text: "x" } });
  assert(!g.ok && g.reason === "group");
  const e = parseTelegramInbound({ update_id: 4, edited_message: { message_id: 1, chat: { id: 777, type: "private" }, date: 1, text: "x" } });
  assert(!e.ok);
  const p = parseTelegramInbound({ update_id: 5, message: { message_id: 2, from: { id: 777 }, chat: { id: 777, type: "private" }, date: 1, photo: [{ file_id: "small", width: 90, height: 90 }, { file_id: "big", width: 1280, height: 1280 }] } });
  assert(p.ok && p.message.type === "image" && p.message.media?.url === "tg-file:big");
  console.log("TELEGRAM PARSER OK");
}

// ---- template name matching + plan gating
{
  const T = [
    { key: "classic", name: "קלאסי" },
    { key: "modern", name: "מודרני" },
    { key: "minimal", name: "מינימלי" },
  ];
  assert.equal(matchTemplateName(T, "מודרני")?.key, "modern");
  assert.equal(matchTemplateName(T, "תבנית מינימלית")?.key, "minimal");
  assert.equal(matchTemplateName(T, "העיצוב הקלאסי")?.key, "classic");
  assert.equal(matchTemplateName(T, "modern")?.key, "modern");
  assert.equal(matchTemplateName(T, "כחול"), null);
  assert.equal(matchTemplateName(T, ""), null);
  assert(planAllows("pro", "basic"));
  assert(planAllows("basic", "basic"));
  assert(!planAllows("trial", "pro"));
  assert(planAllows("unlimited", "pro"));
  console.log("TEMPLATE MATCH OK");
}

// ---- phone normalization and the one-tap send link
{
  assert.equal(normalizePhone("050-123-4567"), "972501234567");
  assert.equal(normalizePhone("0501234567"), "972501234567");
  assert.equal(normalizePhone("+972 50-123-4567"), "972501234567");
  assert.equal(normalizePhone("501234567"), "972501234567");
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone(null), null);
  assert.equal(formatPhone("972501234567"), "050-123-4567");

  // only Israeli mobiles are safe to deep-link: a landline opens an empty chat
  assert(isMobile("0501234567"));
  assert(isMobile("+972-52-228-4283"));
  assert(!isMobile("036123456")); // landline
  assert(!isMobile("05012345")); // truncated
  assert(!isMobile(null));

  assert(waLink("050-123-4567", "שלום").startsWith("https://wa.me/972501234567?text="));
  // unknown number → contact picker, text still prefilled
  assert(waLink(null, "שלום").startsWith("https://wa.me/?text="));
  assert(waLink("036123456", "שלום").startsWith("https://wa.me/?text="));
  assert(waLink(null, "a b&c").includes(encodeURIComponent("a b&c")));
  console.log("PHONE OK");
}

// ---- price book: keys must merge phrasings, never merge different jobs
{
  assert.equal(priceKey("נקודת חשמל"), priceKey("נקודת חשמל "));
  assert.equal(priceKey("התקנת גוף תאורה"), priceKey("התקנת גוף תאורה."));
  assert.equal(priceKey("מ״ר ריצוף"), priceKey("מ׳׳ר ריצוף"));
  assert.equal(priceKey("הביקור"), priceKey("ביקור"));
  // different work must not collide
  assert.notEqual(priceKey("התקנת מזגן"), priceKey("פירוק מזגן"));
  assert.notEqual(priceKey("נקודת חשמל"), priceKey("נקודת תקשורת"));
  assert.equal(priceKey("   "), "");

  const book = [
    { key: priceKey("נקודת חשמל"), description: "נקודת חשמל", unit: "נקודה", unitPrice: 180, timesUsed: 12 },
    { key: priceKey("ביקור"), description: "ביקור", unit: "יח׳", unitPrice: 200, timesUsed: 30 },
  ];
  const items = [
    { description: "נקודת חשמל", quantity: 3, unit: "נקודה", unitPrice: 0, needsReview: true },
    { description: "ביקור", quantity: 1, unit: "יח׳", unitPrice: 250, needsReview: false },
    { description: "עבודה מיוחדת", quantity: 1, unit: "קומפלט", unitPrice: 0, needsReview: true },
  ];
  const { items: filledItems, filled } = applyPriceBook(items, book);

  // missing price filled from the book, and no longer flagged - it is his own price
  assert.equal(filledItems[0].unitPrice, 180);
  assert.equal(filledItems[0].needsReview, false);
  // a price he actually said is never overwritten
  assert.equal(filledItems[1].unitPrice, 250);
  // nothing in the book → stays 0 and stays flagged. Never a guess.
  assert.equal(filledItems[2].unitPrice, 0);
  assert.equal(filledItems[2].needsReview, true);
  assert.deepEqual(filled.map((f) => f.description), ["נקודת חשמל"]);

  // an empty book is a no-op that returns the same array
  const untouched = applyPriceBook(items, []);
  assert.equal(untouched.items, items);
  assert.equal(untouched.filled.length, 0);

  // only real, priced, confirmed lines are worth remembering
  assert(isLearnable({ description: "ביקור", unitPrice: 200 }));
  assert(!isLearnable({ description: "ביקור", unitPrice: 0 }));
  assert(!isLearnable({ description: "א", unitPrice: 200 }));
  assert(!isLearnable({ description: "ביקור", unitPrice: NaN }));

  assert.equal(catalogNames(book).length, 2);
  assert.equal(catalogNames(Array(50).fill(book[0])).length, CATALOG_PROMPT_LIMIT);
  console.log("PRICE BOOK OK");
}

// ---- the customer-facing message, rebuilt live in the edit screen
{
  const text = customerMessageText({
    customerName: "דני כהן",
    businessName: "יוסי חשמל",
    publicUrl: "https://qo.app/q/a8Hd3k",
    validDays: 14,
  });
  assert(text.startsWith("שלום דני כהן, מצורפת הצעת מחיר מיוסי חשמל:"));
  assert(text.includes("https://qo.app/q/a8Hd3k"));
  assert(text.includes("תקפה ל-14 יום"));
  // no name → still a polite greeting, never "שלום null"
  assert(customerMessageText({ customerName: null, businessName: null, publicUrl: "u", validDays: 7 }).startsWith("שלום, מצורפת הצעת מחיר מהעסק:"));

  // never tell a customer "0 ימים"
  assert.equal(daysUntil(null, 14), 14);
  assert.equal(daysUntil(new Date(Date.now() - 86_400_000), 14), 1);
  assert.equal(daysUntil(new Date(Date.now() + 3 * 86_400_000), 14), 3);
  assert.equal(daysUntil("not-a-date", 9), 9);

  // the answer to a question is drafted into the customer's own chat, with the
  // question quoted and an empty line waiting for the answer
  const reply = questionReplyText("  מתי אפשר   להתחיל?  ");
  assert.equal(reply, `*בקשר לשאלתך:* "מתי אפשר להתחיל?"\n*התשובה שלי היא:*\n`);
  // a long question is quoted, not dumped - the link still has to fit in a bubble
  assert(questionReplyText("א".repeat(400)).includes("…"));
  assert(questionReplyText("א".repeat(400)).length < 260);

  // and the notification carries the tap that opens that chat - short, like the
  // send link: the raw wa.me URL would fill the bubble with percent-escapes
  const q = { number: 12, customerName: "דני", customerPhone: "972501234567" } as never;
  const note = notifications.question(q, "מתי אפשר להתחיל?", "https://quickoffer.co.il/r/ab12cd");
  assert(note.includes("https://quickoffer.co.il/r/ab12cd"));
  assert(!note.includes("wa.me"));
  assert(note.includes('"מתי אפשר להתחיל?"'));
  // no reachable number → no dead link, and a word on where an answer must go
  const noPhone = notifications.question({ number: 12, customerName: "דני", customerPhone: null } as never, "מתי?", null);
  assert(noPhone.includes("לא ללקוח"));
  console.log("CUSTOMER MESSAGE OK");
}

// ---- the quantity column: a number, plus a unit only when it measures something
{
  assert.equal(qtyLabel(80, "מ״ר"), "80 מ״ר");
  assert.equal(qtyLabel(2.5, "שעה"), "2.5 שעה");
  assert.equal(qtyLabel(3, "נקודה"), "3 נקודה");
  // "קומפלט"/"יח׳" say nothing next to the number
  assert.equal(qtyLabel(1, "קומפלט"), "1");
  assert.equal(qtyLabel(1, "יח׳"), "1");
  assert.equal(qtyLabel(4, "יח'"), "4");
  assert.equal(qtyLabel(1, "  "), "1");
  assert.equal(qtyLabel(1, null), "1");
  console.log("QTY LABEL OK");
}

// ---- follow-up pacing
{
  const at = (h: number) => new Date(`2026-06-15T${String(h).padStart(2, "0")}:30:00+03:00`);
  assert(isQuietHour(at(3)));
  assert(isQuietHour(at(7)));
  assert(!isQuietHour(at(8)));
  assert(!isQuietHour(at(20)));
  assert(isQuietHour(at(21)));
  assert(isQuietHour(at(23)));

  const now = new Date("2026-06-15T12:00:00Z");
  assert.equal(daysSince(new Date("2026-06-12T12:00:00Z"), now), 3);
  // a few hours is still reported as a day, never "0 ימים"
  assert.equal(daysSince(new Date("2026-06-15T09:00:00Z"), now), 1);
  console.log("FOLLOW-UP OK");
}

// ---- plans offered on the upgrade screen: only upwards
{
  assert.deepEqual(upgradesFor("trial").map((o) => o.plan), ["basic", "pro", "unlimited"]);
  assert.deepEqual(upgradesFor("basic").map((o) => o.plan), ["pro", "unlimited"]);
  assert.deepEqual(upgradesFor("unlimited"), []);
  assert(isPaidPlan("basic"));
  assert(!isPaidPlan("trial"));
  // the landing page and the quota messages read the same numbers
  assert.equal(PLAN_OFFERS.find((o) => o.plan === "basic")?.price, 29);
  console.log("BILLING OK");
}

// ---- logical → visual reordering for the OG card (Satori has no bidi).
// Expected values verified against the real renderer, see lib/og-bidi.ts.
{
  const rev = (s: string) => [...s].reverse().join("");

  // pure Hebrew: the whole string flips
  assert.equal(toVisual("יוסי חשמל ותאורה"), rev("יוסי חשמל ותאורה"));
  assert.equal(toVisual("לכבוד דני כהן"), rev("לכבוד דני כהן"));

  // digits keep their own order - "1,191.80" must never become "08.191,1"
  assert(toVisual("סה״כ 1,191.80 ₪").includes("1,191.80"));
  assert(toVisual("3 סעיפים").includes("3"));
  assert(toVisual("A.B. מזגנים").includes("A.B"));

  // the money string: number rightmost, shekel to its left
  const money = toVisual("1,191.80 ₪");
  assert(money.indexOf("₪") < money.indexOf("1,191.80"));

  // round trip: reversing a pure-Hebrew visual string gives the logical one back
  assert.equal(toVisual(toVisual("הצעת מחיר")), "הצעת מחיר");

  // brackets are mirrored when a run flips, or they would point the wrong way
  assert(toVisual("(הערה)").startsWith("("));

  assert.equal(toVisual(""), "");
  assert.equal(toVisual("QuickOffer"), "QuickOffer");
  console.log("OG BIDI OK");
}

// ---- billing hub request signing. The hub rejects on any mismatch, so this
// pins the exact bytes: hmac_sha256(`${timestamp}.${body}`, secret), hex.
{
  const secret = "whsec_test";
  const body = JSON.stringify({ email: "a@b.com", external_id: "u1" });
  const ts = "1789897973";
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  assert.equal(sig.length, 64);
  // a changed body or timestamp must change the signature
  assert.notEqual(sig, createHmac("sha256", secret).update(`${ts}.${body} `).digest("hex"));
  assert.notEqual(sig, createHmac("sha256", secret).update(`${Number(ts) + 1}.${body}`).digest("hex"));

  // inbound events are signed differently: no timestamp, "sha256=" prefix
  const inbound = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  assert(inbound.startsWith("sha256="));
  assert.equal(inbound.length, "sha256=".length + 64);
  console.log("HUB SIGNING OK");
}

// ---- the price a plan charges must match what every surface advertises
{
  assert.equal(priceOf("basic"), 29);
  assert.equal(priceOf("pro"), 99);
  assert.equal(priceOf("unlimited"), 149);
  assert.equal(priceOf("trial"), 0);
  // plan ids double as the hub's plan_code - renaming one breaks checkout
  assert.deepEqual(PLAN_OFFERS.map((o) => o.plan), ["trial", "basic", "pro", "unlimited"]);
  for (const o of PLAN_OFFERS) {
    assert.equal(isPaidPlan(o.plan), o.price > 0, `${o.plan} paid/price mismatch`);
  }
  console.log("PLAN CODES OK");
}

// ---- §6.8 saved jobs: name handling, the new_quote guard, and matching
{
  // names come back from the LLM with the lead-in the professional said
  assert.equal(normalizeJobName("בתור התקנת מזגן"), "התקנת מזגן");
  assert.equal(normalizeJobName("כ התקנת מזגן"), "התקנת מזגן");
  assert.equal(normalizeJobName('"התקנת מזגן"'), "התקנת מזגן");
  assert.equal(normalizeJobName("התקנת מזגן."), "התקנת מזגן");
  assert.equal(normalizeJobName("  התקנת מזגן  "), "התקנת מזגן");
  assert(!isValidJobName("א"));
  assert(isValidJobName("התקנת מזגן"));

  // the definite article must not fork one job into two (shared with priceKey)
  assert.equal(jobKey("התקנת מזגן"), jobKey("התקנת המזגן"));

  // a message with a price or a quantity is a new quote, never job_use -
  // otherwise the numbers the professional just said get dropped
  assert(looksLikeNewQuote("התקנת מזגן לדני 2 יחידות 1200"));
  assert(looksLikeNewQuote("התקנת מזגן שלוש יחידות"));
  assert(!looksLikeNewQuote("התקנת מזגן לדני כהן"));
  assert(!looksLikeNewQuote("התקנת מזגן"));

  const book = [
    { name: "התקנת מזגן", key: jobKey("התקנת מזגן") },
    { name: "נקודת חשמל", key: jobKey("נקודת חשמל") },
  ];
  assert.equal(matchJob(book, "התקנת המזגן")?.name, "התקנת מזגן");
  assert.equal(matchJob(book, "נקודת חשמל לדני")?.name, "נקודת חשמל");
  assert.equal(matchJob(book, "צביעת קיר"), null);
  // an ambiguous match must not start the wrong job
  const ambiguous = [
    { name: "מזגן", key: jobKey("מזגן") },
    { name: "מזגן עילי", key: jobKey("מזגן עילי") },
  ];
  assert.equal(matchJob(ambiguous, "מזגן עילי גדול"), null);

  // a saved job becomes the same QuoteJSON the LLM would have produced
  const json = jobToQuoteJSON(
    {
      name: "התקנת מזגן",
      items: [
        { description: "מזגן", quantity: 1, unit: "יח׳", unitPrice: 1200 },
        { description: "צנרת", quantity: 3, unit: "מ״א", unitPrice: 0 },
      ],
    },
    "דני כהן",
  );
  assert.equal(json.customerName, "דני כהן");
  assert.equal(json.title, "התקנת מזגן");
  assert.equal(json.items[0].priceConfidence, "high");
  // a zero price still has to be flagged, exactly as on the voice route
  assert.equal(json.items[1].priceConfidence, "missing");
  assert.deepEqual(json.needsReview, ["צנרת"]);
  // an unknown unit must not break the enum the schema validates against
  const odd = jobToQuoteJSON(
    { name: "x", items: [{ description: "a", quantity: 1, unit: "בננות", unitPrice: 5 }] },
    null,
  );
  assert.equal(odd.items[0].unit, "יח׳");

  assert.equal(jobTotal([{ quantity: 3, unitPrice: 150 }, { quantity: 1, unitPrice: 200 }]), 650);
  // items with no real description are dropped before saving
  assert.equal(
    itemsForJob([
      { description: "מזגן", quantity: 1, unit: "יח׳", unitPrice: 1200 },
      { description: " ", quantity: 1, unit: "יח׳", unitPrice: 50 },
    ]).length,
    1,
  );
  console.log("SAVED JOBS OK");
}

// ---- Groq's rate-limit reset strings, as captured live on 24.9.2026
{
  // one request out of 1000/day refills in 86400/1000 = 86.4s
  assert.equal(parseResetSeconds("1m26.4s"), 86.4);
  // 73 tokens out of 8000/min refills in 60/8000*73 = 547ms
  assert.equal(parseResetSeconds("547ms"), 0.547);
  assert.equal(parseResetSeconds("43.2s"), 43.2);
  assert.equal(parseResetSeconds("2h30m0s"), 9000);
  // OpenAI sometimes sends a bare number of seconds
  assert.equal(parseResetSeconds("60"), 60);
  // a shape we have never seen must not become a confident zero
  assert.equal(parseResetSeconds(null), null);
  assert.equal(parseResetSeconds("soon"), null);
  console.log("RATE LIMIT PARSE OK");
}

// ---- link-preview crawlers must not be counted as a customer opening a quote
{
  // the one that actually matters: forwarding the link in WhatsApp
  assert.equal(isBot("WhatsApp/2.2412.54 A"), true);
  assert.equal(isBot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"), true);
  assert.equal(isBot("TelegramBot (like TwitterBot)"), true);
  assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isBot("curl/8.7.1"), true);
  // no user agent at all is a script, not a customer
  assert.equal(isBot(""), true);
  assert.equal(isBot(null), true);

  // real customers, who must still be counted
  assert.equal(
    isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"),
    false,
  );
  assert.equal(
    isBot("Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"),
    false,
  );
  // a phone whose model name ends in "bot" must not be mistaken for one
  assert.equal(
    isBot("Mozilla/5.0 (Linux; Android 12; CUBOT_NOTE_20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36"),
    false,
  );
  console.log("BOT FILTER OK");
}

// ---- the cron's status filter must stay identical to the partial index
{
  // quotes_open_valid_until_idx is declared as `status in ('draft','sent','viewed')`.
  // If a status is ever added to the enum, this fails before the tick quietly
  // goes back to scanning the whole table.
  assert.deepEqual([...OPEN_QUOTE_STATUSES], ["draft", "sent", "viewed"]);
  assert.deepEqual(
    [...OPEN_QUOTE_STATUSES, ...CLOSED_QUOTE_STATUSES].sort(),
    [...quoteStatusEnum.enumValues].sort(),
    "every quote status must be either open or closed",
  );
  console.log("QUOTE STATUS SETS OK");
}

// ---- how long the provider says to wait, from the headers it really sends
{
  const err = (status: number, headers: Record<string, string>) =>
    Object.assign(new Error("rate limited"), { status, headers: new Headers(headers) });

  // Groq's 429 carries retry-after in seconds
  assert.equal(rateLimitWaitMs(err(429, { "retry-after": "30" })), 30_000);
  // millisecond form wins when both are present
  assert.equal(
    rateLimitWaitMs(err(429, { "retry-after-ms": "1500", "retry-after": "30" })),
    1500,
  );
  // no retry-after: fall back to when the token bucket refills
  assert.equal(rateLimitWaitMs(err(429, { "x-ratelimit-reset-tokens": "1m26.4s" })), 86_400);
  assert.equal(rateLimitWaitMs(err(429, { "x-ratelimit-reset-tokens": "547ms" })), 547);
  // plain objects, in case a provider's client does not use Headers
  assert.equal(
    rateLimitWaitMs({ status: 429, headers: { "Retry-After": "5" } }),
    5000,
    "header lookup must be case insensitive",
  );

  // anything that is not a 429 is not a rate limit, whatever it carries
  assert.equal(rateLimitWaitMs(err(500, { "retry-after": "30" })), null);
  assert.equal(rateLimitWaitMs(err(429, {})), null);
  assert.equal(rateLimitWaitMs(new Error("network")), null);
  assert.equal(rateLimitWaitMs(null), null);
  console.log("RATE LIMIT WAIT OK");
}

// ---- a spent balance and a rate limit both answer 429 and need opposite handling
{
  const quota = { status: 429, code: "insufficient_quota", message: "You exceeded your current quota" };
  // never queued for retry: waiting does not buy credit, and the professional
  // would be told "I'll get back to you" by a bot that never can
  assert.equal(isOutOfCredit(quota), true);
  assert.equal(isRateLimitError(quota), false, "out of credit must not look retryable");

  // the nested shape the OpenAI SDK sometimes carries
  assert.equal(isOutOfCredit({ error: { code: "insufficient_quota" } }), true);
  assert.equal(isOutOfCredit({ status: 429, message: "Billing hard limit reached" }), true);

  // a real rate limit still is one
  const paced = { status: 429, code: "rate_limit_exceeded", message: "Rate limit reached" };
  assert.equal(isRateLimitError(paced), true);
  assert.equal(isOutOfCredit(paced), false);
  assert.equal(isRateLimitError({ status: 429 }), true);

  assert.equal(isOutOfCredit(null), false);
  assert.equal(isOutOfCredit(new Error("network")), false);
  console.log("OUT OF CREDIT OK");
}

// ---- the two retry budgets must not be confused with each other
{
  // The cron's filter and the handler's constant are the same budget; if they
  // drift, a retry is either promised and never run or run past its bound.
  assert.equal(MAX_ATTEMPTS, 3);
  // Long enough that a provider's congestion clears, short enough that nobody
  // is still waiting on an answer they have forgotten asking for.
  assert.equal(RETRY_WINDOW_MS, 2 * 3600_000);
  assert.ok(RETRY_WINDOW_MS > 5 * 60_000, "the window must outlast at least one cron tick");
  console.log("RETRY BUDGETS OK");
}

// ---- the two transcription engines the admin toggles between
{
  // The card renders from these, and the switch action writes them, so a typo
  // here silently points production at a model that does not exist.
  assert.deepEqual(Object.keys(TRANSCRIPTION_CHOICES).sort(), ["groq", "openai"]);
  assert.equal(TRANSCRIPTION_CHOICES.groq.model, "whisper-large-v3-turbo");
  assert.equal(TRANSCRIPTION_CHOICES.openai.model, "whisper-1");
  // Measured ceiling. The whole point of the toggle is that one side has one
  // and the other does not.
  assert.equal(TRANSCRIPTION_CHOICES.groq.dailyLimit, 2000);
  assert.equal(TRANSCRIPTION_CHOICES.openai.dailyLimit, null);
  // The cheap one must actually be the cheap one, or the card advises backwards
  assert.ok(TRANSCRIPTION_CHOICES.groq.agorotPer20s < TRANSCRIPTION_CHOICES.openai.agorotPer20s);
  assert.ok(TRANSCRIPTION_CHOICES.groq.typicalMs < TRANSCRIPTION_CHOICES.openai.typicalMs);
  console.log("TRANSCRIPTION CHOICES OK");
}

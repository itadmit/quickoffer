import assert from "node:assert/strict";
import { parseIbotInbound } from "@/lib/whatsapp/ibot";
import { calcTotals, formatMoney } from "@/lib/quotes/calc";
import { makeToken, verifyToken, encryptSecret, decryptSecret } from "@/lib/crypto";

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
  const { matchTemplateName, planAllows } = await import("@/lib/quotes/template-spec");
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

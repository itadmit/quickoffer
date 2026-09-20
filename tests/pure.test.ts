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

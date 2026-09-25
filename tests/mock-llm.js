// The canned LLM answers behind tests/mock-server.mjs, kept apart from the
// server so pure.test.ts can check their shape without binding a port.
// CommonJS on purpose: the .mjs server imports it fine either way, and
// pure.test.ts is transpiled to CJS, which cannot require an ES module.

// Every call to a real provider goes through zodResponseFormat, which marks
// all properties required - so a live model returns the whole object with
// nulls, never a subset. The mock has to answer in that same shape or it
// exercises a case production never produces: `templateName` outlived the
// rename to `designName` here, and `reference`/`customerName` were added to
// IntentSchema without it, so every quote in the local flow died on a
// ZodError that read like a product bug.
const intent = (rest) => ({
  command: null,
  designName: null,
  reference: null,
  customerName: null,
  ...rest,
});

/**
 * An Israeli mobile the way a professional says it: "0542284283",
 * "054-228-4283". Deliberately NOT normalised here - a real model echoes the
 * local form it heard, and turning that into the 972… form WhatsApp needs is
 * the system's job, so the mock must hand over the messy version to exercise it.
 */
const phoneIn = (s) => (s.match(/0\d{2}[-\s]?\d{3}[-\s]?\d{4}/) ?? [null])[0];

function llmAnswer(system, user) {
  const msg = user;
  if (system.includes("מסווג הודעה")) {
    if (/"""\s*(היי|שלום|תודה)\s*"""/.test(msg)) return intent({ intent: "greeting" });
    // Handing over a detail about the customer - the phone above all - is a
    // correction, never unclear: the bot dictates this exact phrasing itself.
    if (phoneIn(msg)) return intent({ intent: "correction" });
    if (/תשנה|תוסיף|תמחק|בלי/.test(msg)) return intent({ intent: "correction" });
    if (/הצעת מחיר|נקודות|שקל/.test(msg)) return intent({ intent: "new_quote" });
    return intent({ intent: "unclear" });
  }
  if (system.includes("שאלת אונבורדינג")) {
    if (system.includes("השלב: שם העסק")) {
      if (/^["\n\s]*כן/.test(msg.split('"""')[1] ?? "")) return { acceptsSuggestedName: true, businessName: null, vatStatus: null, skipLogo: null, looksLikeQuote: false };
      return { acceptsSuggestedName: false, businessName: (msg.split('"""')[1] ?? "").trim(), vatStatus: null, skipLogo: null, looksLikeQuote: false };
    }
    if (system.includes("השלב: סטטוס מע״מ")) return { acceptsSuggestedName: null, businessName: null, vatStatus: /פטור/.test(msg) ? "exempt" : "registered", skipLogo: null, looksLikeQuote: false };
    return { acceptsSuggestedName: null, businessName: null, vatStatus: null, skipLogo: true, looksLikeQuote: false };
  }
  if (system.includes("מעדכן הצעת מחיר קיימת")) {
    const cur = JSON.parse(user.split("ההצעה הנוכחית:\n")[1].split("\n\nהוראת התיקון")[0]);
    const instruction = user.split("הוראת התיקון")[1] ?? "";
    // Phone given, prices untouched - the correction that unlocks one-tap send.
    const said = phoneIn(instruction);
    if (said)
      return { quote: { ...cur, customerPhone: said }, changes: [`טלפון - ${said}`] };
    const items = cur.items.map((i) => (i.description === "ביקור" ? { ...i, unitPrice: 250 } : i));
    items.push({ description: "שקע כפול", quantity: 1, unit: "יח׳", unitPrice: 120, priceConfidence: "high" });
    return { quote: { ...cur, items, needsReview: [] }, changes: ["ביקור — 250 ₪ (היה 200)", "+ שקע כפול ×1 — 120 ₪"] };
  }
  // structure
  return {
    customerName: "דני כהן",
    customerPhone: null,
    title: "התקנת גופי תאורה",
    items: [
      { description: "התקנת גוף תאורה", quantity: 3, unit: "יח׳", unitPrice: 150, priceConfidence: "high" },
      { description: "ביקור", quantity: 1, unit: "יח׳", unitPrice: 200, priceConfidence: "high" },
    ],
    discount: null,
    vatIncluded: false,
    paymentTerms: "50% מקדמה, היתרה בסיום העבודה",
    validDays: null,
    notes: [],
    needsReview: [],
  };
}

module.exports = { llmAnswer };

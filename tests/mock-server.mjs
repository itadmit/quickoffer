// Dev-only mock of iBot (send-*) and an OpenAI-compatible chat endpoint.
// Run: node tests/mock-server.mjs   → http://localhost:4001
// Then in /admin: ibot.base_url=http://localhost:4001/api/v1/, llm.provider=custom, llm.base_url=http://localhost:4001/v1
import http from "node:http";

const sent = [];

function llmAnswer(system, user) {
  const msg = user;
  if (system.includes("מסווג הודעה")) {
    if (/"""\s*(היי|שלום|תודה)\s*"""/.test(msg)) return { intent: "greeting", command: null, templateName: null };
    if (/תשנה|תוסיף|תמחק|בלי/.test(msg)) return { intent: "correction", command: null, templateName: null };
    if (/הצעת מחיר|נקודות|שקל/.test(msg)) return { intent: "new_quote", command: null, templateName: null };
    return { intent: "unclear", command: null, templateName: null };
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

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/api/v1/send-")) {
      const rec = { kind: url.pathname.replace("/api/v1/", ""), jid: url.searchParams.get("jid"), msg: url.searchParams.get("msg") ?? url.searchParams.get("caption"), docurl: url.searchParams.get("docurl") };
      sent.push(rec);
      console.log(`\n📤 ${rec.kind} → ${rec.jid}\n${rec.msg}`);
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ success: true, id: `mock-${sent.length}` }));
    }
    if (url.pathname === "/v1/chat/completions") {
      let body = "";
      for await (const c of req) body += c;
      const { messages, model } = JSON.parse(body);
      const system = messages.find((m) => m.role === "system")?.content ?? "";
      const user = messages.find((m) => m.role === "user")?.content ?? "";
      const content = JSON.stringify(llmAnswer(system, user));
      res.setHeader("content-type", "application/json");
      return res.end(
        JSON.stringify({
          id: "chatcmpl-mock", object: "chat.completion", created: Date.now() / 1000, model,
          choices: [{ index: 0, message: { role: "assistant", content, refusal: null }, finish_reason: "stop" }],
          usage: { prompt_tokens: 500, completion_tokens: 120, total_tokens: 620 },
        }),
      );
    }
    if (url.pathname === "/__sent") {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify(sent));
    }
    res.statusCode = 404;
    res.end("not found");
  })
  .listen(4001, () => console.log("mock iBot + LLM on http://localhost:4001"));

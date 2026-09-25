// Dev-only mock of iBot (send-*) and an OpenAI-compatible chat endpoint.
// Run: node tests/mock-server.mjs   → http://localhost:4001
// Then in /admin: ibot.base_url=http://localhost:4001/api/v1/, llm.provider=custom, llm.base_url=http://localhost:4001/v1
// The canned answers live in mock-llm.js, where pure.test.ts checks their shape.
import http from "node:http";
import { llmAnswer } from "./mock-llm.js";

const sent = [];

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

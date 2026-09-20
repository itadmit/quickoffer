import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema";
import { approveQuote, askQuestion, rejectQuote } from "@/lib/quotes/customer-actions";

async function main() {
  const [q] = await db.select().from(quotes).limit(1);
  const png = "data:image/png;base64," + Buffer.alloc(300, 1).toString("base64");

  const ask = await askQuestion(q.publicId, "זה כולל חומרים?");
  assert(ask.ok);

  const ap = await approveQuote(q.publicId, { signerName: "דני כהן", signaturePng: png, ip: "1.2.3.4", ua: "test" });
  assert(ap.ok);

  const [after] = await db.select().from(quotes).limit(1);
  assert.equal(after.status, "approved");
  assert(after.approvedAt);
  const snap = after.approvedSnapshot as { items: unknown[]; approval: { signerName: string }; business: { businessName: string } };
  assert.equal(snap.items.length, 3);
  assert.equal(snap.approval.signerName, "דני כהן");
  assert(snap.business.businessName);

  // final states are final
  const rj = await rejectQuote(q.publicId, "יקר");
  assert(!rj.ok && rj.error === "closed");
  const ap2 = await approveQuote(q.publicId, { signerName: "x", signaturePng: png, ip: null, ua: null });
  assert(ap2.ok && "already" in ap2);

  console.log("APPROVE FLOW OK");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

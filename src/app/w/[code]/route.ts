import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { customerMessage } from "@/lib/conversation/messages";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { waLink } from "@/lib/phone";
import { publicLink, resolveLink } from "@/lib/quotes/links";
import { getQuote, markSent } from "@/lib/quotes/service";

export const dynamic = "force-dynamic";

/**
 * GET /w/{code} - one tap from the chat to WhatsApp, with the customer's chat
 * open and the message ready to send.
 *
 * The message is rebuilt here rather than baked into the link, so a quote the
 * professional corrected after receiving the link still sends the corrected
 * text. Nothing goes out from our side: they press send, from their own number,
 * which is the whole point (PRODUCT.md §15 decision 7).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const quoteId = await resolveLink(code, "w");
  const quote = quoteId ? await getQuote(quoteId) : null;
  const user = quote ? await db.query.users.findFirst({ where: eq(users.id, quote.userId) }) : null;

  if (!quote || !user) {
    return NextResponse.redirect(new URL("/link-expired", req.nextUrl.origin), 307);
  }

  const text = customerMessage(quote, user, await publicLink(quote.publicId));
  // "sent" is declarative (§10) - we never see the forward, so the tap is the
  // best signal we get. Failure here must not block the redirect.
  await markSent(quote.id).catch((e) => console.error("[send-link] markSent", e));

  return NextResponse.redirect(waLink(quote.customerPhone, text), 307);
}

import { NextResponse, type NextRequest } from "next/server";
import { waLink } from "@/lib/phone";
import { PRO_DEVICE_COOKIE, proDeviceCookieOptions, proDeviceToken } from "@/lib/pro-device";
import { questionReplyText } from "@/lib/quotes/customer-message";
import { latestQuestion } from "@/lib/quotes/customer-actions";
import { resolveLink } from "@/lib/quotes/links";
import { getQuote } from "@/lib/quotes/service";

export const dynamic = "force-dynamic";

/**
 * GET /r/{code} - one tap from the notification into the customer's own chat,
 * with their question quoted and the cursor on an empty answer line.
 *
 * The question reached the professional in the bot chat, but an answer typed
 * there would go to the bot: the customer never talks to us. This closes that
 * loop without us ever writing to the customer - the reply goes out from the
 * professional's own number (PRODUCT.md §15 decision 7).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const quoteId = await resolveLink(code, "r");
  const quote = quoteId ? await getQuote(quoteId) : null;

  if (!quote) {
    return NextResponse.redirect(new URL("/link-expired", req.nextUrl.origin), 307);
  }

  // Rebuilt per tap, so a later question is the one quoted. Without a question
  // on record the chat still opens - empty, which beats a dead end.
  const question = await latestQuestion(quote.id);
  const res = NextResponse.redirect(
    waLink(quote.customerPhone, question ? questionReplyText(question) : ""),
    307,
  );
  // Only the professional ever reaches this route.
  try {
    res.cookies.set(PRO_DEVICE_COOKIE, proDeviceToken(quote.userId), proDeviceCookieOptions);
  } catch (e) {
    console.error("[reply-link] proDevice", e);
  }
  return res;
}

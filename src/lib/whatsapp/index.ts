import { db } from "../db";
import { outboundMessages } from "../db/schema";
import { setSetting } from "../settings";
import { ibot } from "./ibot";
import { isTelegramAddress, telegram } from "./telegram";
import type { SendResult, WhatsAppGateway } from "./types";

export type { Channel, InboundMessage, InboundType, ParseResult } from "./types";

/** The WhatsApp gateway. Swap here to move off iBot (PRODUCT.md §3.5). */
export const gateway: WhatsAppGateway = ibot;

/** Pick the gateway by address: "tg:<chatId>" → Telegram, digits → WhatsApp. */
export function gatewayFor(address: string): WhatsAppGateway {
  return isTelegramAddress(address) ? telegram : gateway;
}

const GAP_MS = 400;
const MAX_ATTEMPTS = 3;
const MAX_LEN = 3900;

// Serial outbound queue: iBot asks for no parallel calls. Per-instance only -
// good enough while a single webhook invocation sends a handful of messages.
let chain: Promise<unknown> = Promise.resolve();
let lastSentAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastSentAt + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await job();
    } finally {
      lastSentAt = Date.now();
    }
  });
  chain = run.catch(() => undefined);
  return run;
}

async function withRetry(fn: () => Promise<SendResult>): Promise<SendResult> {
  let last: SendResult = { ok: false, status: 0, body: "not attempted" };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      last = await fn();
    } catch (err) {
      last = { ok: false, status: 0, body: String(err) };
    }
    if (last.ok) return last;
    if (last.instanceDisconnected) break; // retrying won't help
    await sleep(500 * attempt);
  }
  return last;
}

async function log(
  to: string,
  type: string,
  body: string | null,
  docUrl: string | null,
  result: SendResult,
) {
  try {
    await db.insert(outboundMessages).values({
      userPhone: to,
      type,
      body,
      docUrl,
      ibotResponse: result.body as Record<string, unknown>,
      ok: result.ok,
    });
    if (isTelegramAddress(to)) return;
    if (result.instanceDisconnected) {
      await setSetting("ibot.instance_status", "disconnected", "system");
      await setSetting("ibot.instance_checked_at", new Date().toISOString(), "system");
    } else if (result.ok) {
      await setSetting("ibot.instance_status", "connected", "system");
      await setSetting("ibot.instance_checked_at", new Date().toISOString(), "system");
    }
  } catch (err) {
    console.error("[whatsapp] failed to log outbound", err);
  }
}

/** Split on paragraph boundaries so long messages don't get truncated. */
function chunk(text: string): string[] {
  if (text.length <= MAX_LEN) return [text];
  const parts: string[] = [];
  let cur = "";
  for (const para of text.split("\n\n")) {
    if ((cur + "\n\n" + para).length > MAX_LEN && cur) {
      parts.push(cur);
      cur = para;
    } else {
      cur = cur ? `${cur}\n\n${para}` : para;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

export async function sendText(to: string, text: string): Promise<SendResult> {
  let last: SendResult = { ok: true, status: 200, body: null };
  for (const part of chunk(text)) {
    last = await enqueue(() => withRetry(() => gatewayFor(to).sendText(to, part)));
    await log(to, "text", part, null, last);
    if (!last.ok) break;
  }
  return last;
}

export async function sendDoc(
  to: string,
  docUrl: string,
  caption = "",
): Promise<SendResult> {
  const r = await enqueue(() => withRetry(() => gatewayFor(to).sendDoc(to, docUrl, caption)));
  await log(to, "doc", caption, docUrl, r);
  return r;
}

export async function sendImage(
  to: string,
  imageUrl: string,
  caption = "",
): Promise<SendResult> {
  const r = await enqueue(() =>
    withRetry(() => gatewayFor(to).sendImage(to, imageUrl, caption)),
  );
  await log(to, "image", caption, imageUrl, r);
  return r;
}

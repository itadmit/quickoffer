import { db } from "../db";
import { outboundMessages } from "../db/schema";
import { setSetting, touchSetting } from "../settings";
import { ibot } from "./ibot";
import { createQueue } from "./queue";
import { isTelegramAddress, telegram } from "./telegram";
import type { SendResult, WhatsAppGateway } from "./types";

export type { Channel, InboundMessage, InboundType, ParseResult } from "./types";

/** The WhatsApp gateway. Swap here to move off iBot (PRODUCT.md §3.5). */
export const gateway: WhatsAppGateway = ibot;

/** Pick the gateway by address: "tg:<chatId>" → Telegram, digits → WhatsApp. */
export function gatewayFor(address: string): WhatsAppGateway {
  return isTelegramAddress(address) ? telegram : gateway;
}

const MAX_ATTEMPTS = 3;
const MAX_LEN = 3900;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ordered per recipient, paced globally (queue.ts).
 *
 * These are the numbers the old single chain produced, kept deliberately:
 * CLAUDE.md records "one message at a time, 300-500ms apart" as a decision
 * about what the iBot connection tolerates. `maxConcurrent: 2` or `3` is what
 * removes cross-recipient latency once a single instance is handling several
 * conversations at once - worth doing, but only with the WhatsApp account's
 * tolerance in mind.
 */
const queue = createQueue({ gapMs: 400, maxConcurrent: 1 });

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
    // setSetting skips a write when nothing changed, so the status costs a row
    // only on a real transition; the timestamp is throttled to once a minute.
    if (result.instanceDisconnected) {
      await setSetting("ibot.instance_status", "disconnected", "system");
      await touchSetting("ibot.instance_checked_at");
    } else if (result.ok) {
      await setSetting("ibot.instance_status", "connected", "system");
      await touchSetting("ibot.instance_checked_at");
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
    last = await queue.enqueue(to, () => withRetry(() => gatewayFor(to).sendText(to, part)));
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
  const r = await queue.enqueue(to, () => withRetry(() => gatewayFor(to).sendDoc(to, docUrl, caption)));
  await log(to, "doc", caption, docUrl, r);
  return r;
}

export async function sendImage(
  to: string,
  imageUrl: string,
  caption = "",
): Promise<SendResult> {
  const r = await queue.enqueue(to, () => withRetry(() => gatewayFor(to).sendImage(to, imageUrl, caption)));
  await log(to, "image", caption, imageUrl, r);
  return r;
}

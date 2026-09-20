import { getSettings } from "../settings";
import type {
  InboundMessage,
  InboundType,
  ParseResult,
  SendResult,
  WhatsAppGateway,
} from "./types";

/**
 * iBot Chat adapter. Facts verified against a real webhook capture on 20.9.2026
 * (see CLAUDE.md) - NOT against the docs page, which documents sending only.
 */

// Payload shape as actually received
type IbotPayload = {
  uid?: string;
  sessionId?: string;
  instanceId?: string;
  chatId?: string;
  remoteJid?: string;
  msgFromMe?: boolean;
  actualObj?: {
    group?: boolean;
    type?: string;
    msgId?: string;
    remoteJid?: string;
    msgContext?: {
      text?: string | null;
      caption?: string | null;
      fileName?: string | null;
      mimetype?: string | null;
      mediaUrl?: string | null;
      width?: number;
      height?: number;
    } | null;
    timestamp?: number;
    senderName?: string;
    route?: string;
    // null in audio/text; {"jid":null,"id":null} in image - handle both
    context?: { jid?: string | null; id?: string | null } | null;
  };
};

const TYPE_MAP: Record<string, InboundType> = {
  text: "text",
  chat: "text",
  audio: "audio",
  aud: "audio", // legacy value still emitted by iBot
  ptt: "audio",
  voice: "audio",
  image: "image",
  img: "image",
  document: "document",
  doc: "document",
};

export function jidToPhone(jid: string): string {
  return jid.split("@")[0].replace(/\D/g, "");
}

export function phoneToJid(phone: string): string {
  return `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
}

export function parseIbotInbound(payload: unknown): ParseResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "invalid" };
  }
  const p = payload as IbotPayload;
  const a = p.actualObj;
  if (!a) return { ok: false, reason: "no_actual_obj" };
  if (a.group === true) return { ok: false, reason: "group" };
  if (p.msgFromMe === true) return { ok: false, reason: "from_me" };
  if (a.route && a.route !== "incoming") {
    return { ok: false, reason: "not_incoming" };
  }
  const jid = p.remoteJid ?? a.remoteJid;
  if (!jid || !a.msgId) return { ok: false, reason: "invalid" };
  // Group jids end with @g.us - belt and braces in case `group` is missing
  if (jid.endsWith("@g.us")) return { ok: false, reason: "group" };

  const ctx = a.msgContext ?? {};
  const type = TYPE_MAP[(a.type ?? "").toLowerCase()] ?? "other";
  const text = (ctx.text ?? ctx.caption ?? "").trim() || null;

  const message: InboundMessage = {
    id: a.msgId,
    from: jidToPhone(jid),
    fromName: a.senderName?.trim() || null,
    type,
    text,
    media: ctx.mediaUrl
      ? {
          url: ctx.mediaUrl,
          mimetype: ctx.mimetype ?? null,
          fileName: ctx.fileName ?? null,
        }
      : null,
    quotedId: a.context?.id ?? null,
    at: a.timestamp ?? Math.floor(Date.now() / 1000),
    raw: payload,
  };
  return { ok: true, message };
}

// ---------------------------------------------------------------- sending

async function ibotGet(
  path: string,
  params: Record<string, string>,
): Promise<SendResult> {
  const s = await getSettings(["ibot.base_url", "ibot.token", "ibot.instance_id"]);
  if (!s["ibot.token"] || !s["ibot.instance_id"]) {
    return { ok: false, status: 0, body: "iBot token/instance_id not configured" };
  }
  const url = new URL(path, s["ibot.base_url"]);
  url.searchParams.set("token", s["ibot.token"]);
  url.searchParams.set("instance_id", s["ibot.instance_id"]);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const raw = await res.text();
  let body: unknown = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    /* plain text response */
  }
  const asText = typeof body === "string" ? body : JSON.stringify(body);
  const instanceDisconnected = /not connected|disconnected/i.test(asText);
  const errored =
    !res.ok ||
    instanceDisconnected ||
    (typeof body === "object" &&
      body !== null &&
      (("error" in body && Boolean((body as { error: unknown }).error)) ||
        ("success" in body && (body as { success: unknown }).success === false) ||
        ("status" in body && (body as { status: unknown }).status === "error")));
  return { ok: !errored, status: res.status, body, instanceDisconnected };
}

export const ibot: WhatsAppGateway = {
  parseInbound: parseIbotInbound,
  sendText(to, text) {
    return ibotGet("send-text", { jid: phoneToJid(to), msg: text });
  },
  sendDoc(to, docUrl, caption = "") {
    return ibotGet("send-doc", { jid: phoneToJid(to), docurl: docUrl, caption });
  },
  sendImage(to, imageUrl, caption = "") {
    return ibotGet("send-image", { jid: phoneToJid(to), imageurl: imageUrl, caption });
  },
};

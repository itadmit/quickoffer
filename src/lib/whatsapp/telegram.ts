import { getSettings } from "../settings";
import type { InboundMessage, ParseResult, SendResult, WhatsAppGateway } from "./types";

/**
 * Telegram Bot API adapter. Same interface as iBot so the conversation
 * layer doesn't care which channel it's talking to. Addresses are "tg:<chatId>".
 *
 * Media: parseInbound is sync, so media URLs are stored as "tg-file:<file_id>"
 * and resolved (getFile) only when fetched - the download URL contains the
 * bot token and must never be persisted.
 */

export const TG_PREFIX = "tg:";
export const TG_FILE_PREFIX = "tg-file:";

export const isTelegramAddress = (addr: string) => addr.startsWith(TG_PREFIX);
export const chatIdOf = (addr: string) => addr.slice(TG_PREFIX.length);

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
type TgFile = { file_id: string; file_unique_id?: string; mime_type?: string; file_name?: string; file_size?: number };
type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: "private" | "group" | "supergroup" | "channel" };
  date: number;
  text?: string;
  caption?: string;
  voice?: TgFile & { duration: number };
  audio?: TgFile & { duration: number };
  photo?: (TgFile & { width: number; height: number })[];
  document?: TgFile;
  sticker?: unknown;
  location?: unknown;
  contact?: unknown;
  reply_to_message?: { message_id: number };
};
type TgUpdate = { update_id: number; message?: TgMessage; edited_message?: TgMessage };

export function parseTelegramInbound(payload: unknown): ParseResult {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "invalid" };
  const u = payload as TgUpdate;
  const m = u.message;
  if (!m) return { ok: false, reason: "no_actual_obj" }; // edited/channel/other updates
  if (m.chat.type !== "private") return { ok: false, reason: "group" };
  if (m.from?.is_bot) return { ok: false, reason: "from_me" };

  let type: InboundMessage["type"] = "other";
  let media: InboundMessage["media"] = null;
  const file = (f: TgFile, fallbackMime: string, fallbackName: string) => ({
    url: `${TG_FILE_PREFIX}${f.file_id}`,
    mimetype: f.mime_type ?? fallbackMime,
    fileName: f.file_name ?? fallbackName,
  });
  if (m.voice) {
    type = "audio";
    media = file(m.voice, "audio/ogg", "voice.oga");
  } else if (m.audio) {
    type = "audio";
    media = file(m.audio, "audio/mpeg", "audio.mp3");
  } else if (m.photo?.length) {
    type = "image";
    media = file(m.photo[m.photo.length - 1], "image/jpeg", "photo.jpg");
  } else if (m.document) {
    type = m.document.mime_type?.startsWith("image/") ? "image" : "document";
    media = file(m.document, "application/octet-stream", "file");
  } else if (typeof m.text === "string") {
    type = "text";
  }

  const name = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ").trim();
  return {
    ok: true,
    message: {
      id: `tg:${m.chat.id}:${m.message_id}`,
      channel: "telegram",
      from: `${TG_PREFIX}${m.chat.id}`,
      fromName: name || m.from?.username || null,
      type,
      text: (m.text ?? m.caption ?? "").trim() || null,
      media,
      quotedId: m.reply_to_message ? `tg:${m.chat.id}:${m.reply_to_message.message_id}` : null,
      at: m.date ?? Math.floor(Date.now() / 1000),
      raw: payload,
    },
  };
}

// ---------------------------------------------------------------- Bot API

async function botToken(): Promise<string> {
  const { "telegram.bot_token": token } = await getSettings(["telegram.bot_token"]);
  return token;
}

export async function tgCall<T = unknown>(
  method: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<{ ok: boolean; result?: T; description?: string; status: number }> {
  const t = token ?? (await botToken());
  if (!t) return { ok: false, description: "telegram.bot_token not configured", status: 0 };
  const res = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  return { ok: !!json.ok, result: json.result, description: json.description, status: res.status };
}

function toSendResult(r: Awaited<ReturnType<typeof tgCall>>): SendResult {
  return { ok: r.ok, status: r.status, body: r.ok ? r.result : r.description };
}

/** "tg-file:<id>" → temporary download URL (contains the bot token; use immediately, never store). */
export async function resolveTelegramFileUrl(fileRef: string): Promise<string> {
  const fileId = fileRef.slice(TG_FILE_PREFIX.length);
  const token = await botToken();
  const r = await tgCall<{ file_path: string }>("getFile", { file_id: fileId }, token);
  if (!r.ok || !r.result?.file_path) throw new Error(`telegram getFile failed: ${r.description}`);
  return `https://api.telegram.org/file/bot${token}/${r.result.file_path}`;
}

export const telegram: WhatsAppGateway = {
  parseInbound: parseTelegramInbound,
  async sendText(to, text) {
    return toSendResult(
      await tgCall("sendMessage", { chat_id: chatIdOf(to), text, disable_web_page_preview: true }),
    );
  },
  async sendDoc(to, docUrl, caption = "") {
    return toSendResult(await tgCall("sendDocument", { chat_id: chatIdOf(to), document: docUrl, caption }));
  },
  async sendImage(to, imageUrl, caption = "") {
    return toSendResult(await tgCall("sendPhoto", { chat_id: chatIdOf(to), photo: imageUrl, caption }));
  },
};

/** Register (or refresh) the webhook. Called from the admin page. */
export async function setTelegramWebhook(appUrl: string, secret: string) {
  return tgCall("setWebhook", {
    url: `${appUrl.replace(/\/$/, "")}/api/webhooks/telegram`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
}

export async function getTelegramMe() {
  return tgCall<{ id: number; username: string; first_name: string }>("getMe", {});
}

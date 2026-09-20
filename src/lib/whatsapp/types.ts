/** Normalized inbound message (PRODUCT.md §5.1). Provider-agnostic. */
export type InboundType = "text" | "audio" | "image" | "document" | "other";

export type InboundMessage = {
  /** provider message id - dedup key */
  id: string;
  /** digits only, e.g. 972501234567 */
  from: string;
  /** WhatsApp push name */
  fromName: string | null;
  type: InboundType;
  text: string | null;
  media: { url: string; mimetype: string | null; fileName: string | null } | null;
  quotedId: string | null;
  /** unix seconds */
  at: number;
  raw: unknown;
};

/** Why an inbound payload was dropped silently (still 200). */
export type DropReason =
  | "group"
  | "from_me"
  | "not_incoming"
  | "no_actual_obj"
  | "invalid";

export type ParseResult =
  | { ok: true; message: InboundMessage }
  | { ok: false; reason: DropReason };

export type SendResult = {
  ok: boolean;
  status: number;
  body: unknown;
  /** true when the gateway says the WhatsApp instance is disconnected */
  instanceDisconnected?: boolean;
};

export interface WhatsAppGateway {
  parseInbound(payload: unknown): ParseResult;
  sendText(to: string, text: string): Promise<SendResult>;
  sendDoc(to: string, docUrl: string, caption?: string): Promise<SendResult>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<SendResult>;
}

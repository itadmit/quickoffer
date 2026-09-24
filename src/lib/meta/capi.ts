import { createHash } from "node:crypto";
import type { User } from "../db/schema";
import { getSettings } from "../settings";

/**
 * Meta Conversions API - server-side events for the steps the pixel can't see.
 *
 * The landing page only gets as far as "opened WhatsApp". Everything after that
 * (the bot conversation, the upgrade) happens off the site, so the pixel never
 * sees it. We report those steps from here and let Meta match them to the ad
 * click by the hashed phone number - WhatsApp gives us that for free.
 *
 * Tracking must never cost a message: every failure is logged and swallowed.
 */

const GRAPH = "https://graph.facebook.com/v23.0";
const TIMEOUT_MS = 4_000;

type MetaEvent = "Lead" | "CompleteRegistration" | "Subscribe";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function trackMetaEvent(
  name: MetaEvent,
  user: Pick<User, "id" | "phone" | "channel">,
  custom: { value?: number; currency?: string; plan?: string } = {},
): Promise<void> {
  try {
    const s = await getSettings(["meta.pixel_id", "meta.capi_token", "meta.test_event_code"]);
    if (!s["meta.pixel_id"] || !s["meta.capi_token"]) return;

    // Telegram users are "tg:<chatId>" - no phone to match on, only the id.
    const userData: Record<string, string[]> = { external_id: [sha256(user.id)] };
    if (user.channel === "whatsapp" && /^\d{8,15}$/.test(user.phone)) {
      userData.ph = [sha256(user.phone)];
      userData.country = [sha256("il")];
    }

    const body: Record<string, unknown> = {
      data: [
        {
          event_name: name,
          event_time: Math.floor(Date.now() / 1000),
          // Stable per user and event, so a webhook retry doesn't count twice.
          event_id: `${name}:${user.id}${custom.plan ? `:${custom.plan}` : ""}`,
          action_source: "chat",
          user_data: userData,
          custom_data: {
            ...(custom.value !== undefined && { value: custom.value, currency: custom.currency ?? "ILS" }),
            ...(custom.plan && { content_name: custom.plan }),
          },
        },
      ],
    };
    if (s["meta.test_event_code"]) body.test_event_code = s["meta.test_event_code"];

    const res = await fetch(
      `${GRAPH}/${s["meta.pixel_id"]}/events?access_token=${encodeURIComponent(s["meta.capi_token"])}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) console.error("[meta capi]", name, res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("[meta capi]", name, err instanceof Error ? err.message : err);
  }
}

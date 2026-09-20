import { makeToken } from "../crypto";
import { getSetting } from "../settings";

const EDIT_TTL = 7 * 24 * 3600; // §8.1 — 7 days
const SETTINGS_TTL = 30 * 24 * 3600;

export async function appUrl(): Promise<string> {
  return (await getSetting("app.url")).replace(/\/$/, "");
}

export async function editLink(quoteId: string): Promise<string> {
  return `${await appUrl()}/e/${makeToken("e", quoteId, EDIT_TTL)}`;
}

export async function publicLink(publicId: string): Promise<string> {
  return `${await appUrl()}/q/${publicId}`;
}

export async function settingsLink(userId: string): Promise<string> {
  return `${await appUrl()}/s/${makeToken("s", userId, SETTINGS_TTL)}`;
}

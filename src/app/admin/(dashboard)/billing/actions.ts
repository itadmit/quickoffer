"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { HubError, ping } from "@/lib/billing/hub";

/** "בדוק חיבור" - a signed GET against the hub, so it exercises the real auth path. */
export async function pingHubAction() {
  await requireAdmin();
  try {
    const body = await ping();
    return { ok: true as const, body };
  } catch (err) {
    if (err instanceof HubError) {
      return { ok: false as const, error: `${err.status} ${err.code}: ${err.message}` };
    }
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

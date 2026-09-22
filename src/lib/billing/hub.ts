import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSettings } from "../settings";

/**
 * Client for the Quick Commerce Billing Hub (quick-billing).
 *
 * The hub owns money, cards, invoices, dunning and VAT. QuickOffer owns the
 * quota. The only things we keep on our side are the hub's customer and
 * subscription ids and which plan is in force - everything else would be a
 * second source of truth about someone's money, which is how billing bugs
 * become refunds.
 *
 * Auth is Bearer + HMAC over `${timestamp}.${body}` with the product's webhook
 * secret, a ±5 minute timestamp window, and an idempotency key on every
 * mutation.
 */

export class HubError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HubError";
  }
}

/**
 * Two different secrets, deliberately.
 *
 * `apiSecret` (products.webhook_secret in the hub) signs the requests we send.
 * `endpointSecret` (webhook_endpoints.secret) signs the events they send us.
 * The hub keeps them apart, and so do we - one leaking must not let anyone
 * forge in the other direction.
 */
type HubConfig = {
  baseUrl: string;
  productId: string;
  apiKey: string;
  apiSecret: string;
  endpointSecret: string;
};

async function config(): Promise<HubConfig> {
  const s = await getSettings([
    "billing.hub_url",
    "billing.product_id",
    "billing.api_key",
    "billing.api_secret",
    "billing.endpoint_secret",
  ]);
  const cfg = {
    baseUrl: s["billing.hub_url"].replace(/\/$/, ""),
    productId: s["billing.product_id"],
    apiKey: s["billing.api_key"],
    apiSecret: s["billing.api_secret"],
    endpointSecret: s["billing.endpoint_secret"],
  };
  if (!cfg.baseUrl || !cfg.productId || !cfg.apiKey || !cfg.apiSecret) {
    throw new HubError(503, "NOT_CONFIGURED", "Billing hub is not configured (admin → תשלומים)");
  }
  return cfg;
}

/** Is billing wired up at all? Used to hide the upgrade UI rather than fail it. */
export async function isBillingConfigured(): Promise<boolean> {
  try {
    await config();
    return true;
  } catch {
    return false;
  }
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const cfg = await config();
  const raw = body === undefined ? "" : JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));

  const headers: Record<string, string> = {
    authorization: `Bearer ${cfg.apiKey}`,
    "x-product-id": cfg.productId,
    "x-timestamp": timestamp,
    // Signed over the exact bytes we send - re-serializing would break it.
    "x-signature": createHmac("sha256", cfg.apiSecret).update(`${timestamp}.${raw}`).digest("hex"),
  };
  if (method !== "GET") {
    headers["content-type"] = "application/json";
    headers["x-idempotency-key"] = randomUUID();
  }

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : raw,
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body - surfaced as the message below */
  }

  if (!res.ok) {
    const e = parsed as { error?: string; message?: string } | null;
    throw new HubError(res.status, e?.error ?? "HUB_ERROR", e?.message ?? text.slice(0, 300));
  }
  return parsed as T;
}

// ------------------------------------------------------------------- types

export type HubCustomer = { id: string; email: string; phone: string | null; name: string | null };

export type SetupSession = {
  session_id: string;
  payment_page_url: string;
  process_id: string;
  expires_at: string;
};

export type HubSubscription = {
  id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  payment_method_id: string | null;
};

// --------------------------------------------------------------- endpoints

/** Create or update the customer. Matched on email across every Quick product. */
export function upsertCustomer(input: {
  email: string;
  phone?: string;
  name?: string;
  company_name?: string;
  vat_number?: string;
  /** our user id, so the hub dashboard can point back here */
  external_id: string;
}): Promise<HubCustomer> {
  return call<HubCustomer>("POST", "/api/v1/customers", input);
}

/**
 * Open a hosted card page. `amount` is charged immediately, so this doubles as
 * the first payment - the hub emits `payment_method.created` and `invoice.paid`
 * once the customer completes it.
 *
 * `accept` is a Grow regulatory requirement: the consent checkbox must have
 * been shown and ticked before this call.
 */
export function createSetupSession(input: {
  customer_id: string;
  amount: number;
  description: string;
  success_url: string;
  failure_url: string;
  cancel_url?: string;
}): Promise<SetupSession> {
  return call<SetupSession>("POST", "/api/v1/payment-methods/setup", {
    ...input,
    context_type: "subscription_setup",
    accept: true,
  });
}

export function createSubscription(input: {
  customer_id: string;
  plan_code: string;
  payment_method_id?: string;
  billing_interval?: "monthly" | "yearly";
  trial_days?: number;
}): Promise<HubSubscription> {
  return call<HubSubscription>("POST", "/api/v1/subscriptions", {
    billing_interval: "monthly",
    // The free tier is five quotes, not a countdown - by the time someone
    // upgrades they have already had their trial, and the card page just
    // charged them.
    trial_days: 0,
    ...input,
  });
}

export function cancelSubscription(id: string, atPeriodEnd = true): Promise<unknown> {
  return call("POST", `/api/v1/subscriptions/${id}/cancel`, {
    at_period_end: atPeriodEnd,
  });
}

export function ping(): Promise<{ ok?: boolean; product?: string }> {
  return call("GET", "/api/v1/ping");
}

// ---------------------------------------------------------------- webhooks

/**
 * Verify an inbound webhook. The hub signs the exact body bytes with the
 * endpoint secret and sends `sha256=<hex>`.
 */
export async function verifyWebhook(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const { endpointSecret } = await config();
  if (!endpointSecret) return false;
  const expected = `sha256=${createHmac("sha256", endpointSecret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

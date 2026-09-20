"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { approveQuote, askQuestion, rejectQuote } from "@/lib/quotes/customer-actions";

async function clientMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    ua: h.get("user-agent"),
  };
}

export async function approveAction(publicId: string, signerName: string, signaturePng: string) {
  const name = signerName.trim();
  if (name.length < 2) return { ok: false as const, error: "name" };
  if (!signaturePng.startsWith("data:image/png;base64,") || signaturePng.length < 200) {
    return { ok: false as const, error: "signature" };
  }
  const r = await approveQuote(publicId, { signerName: name, signaturePng, ...(await clientMeta()) });
  revalidatePath(`/q/${publicId}`);
  return r;
}

export async function rejectAction(publicId: string, reason: string | null) {
  const r = await rejectQuote(publicId, reason?.trim() || null);
  revalidatePath(`/q/${publicId}`);
  return r;
}

export async function questionAction(publicId: string, text: string) {
  return askQuestion(publicId, text);
}

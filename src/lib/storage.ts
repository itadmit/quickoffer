import { put } from "@vercel/blob";

/**
 * Files: audio copies (30 days, debugging), logos, signatures. Vercel Blob.
 * Without BLOB_READ_WRITE_TOKEN (local dev) uploads are skipped and null is returned.
 */
export async function storeFile(
  path: string,
  data: Buffer | string,
  contentType: string,
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const blob = await put(path, data, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (err) {
    console.error("[storage] upload failed", path, err);
    return null;
  }
}

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

/**
 * iBot media is public and deleted after 30 days - fetch immediately
 * (PRODUCT.md §5.2). Retries 3× within ~1 minute.
 */
export async function fetchMedia(
  url: string,
): Promise<{ buffer: Buffer; contentType: string | null }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`media fetch ${res.status}`);
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_MEDIA_BYTES) throw new Error("media too large");
      return { buffer: Buffer.from(ab), contentType: res.headers.get("content-type") };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 3_000 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Rough duration for Ogg/Opus voice notes: ~1.2 KB/s measured from WhatsApp (5.8KB ≈ 5s). */
export function estimateAudioSeconds(bytes: number): number {
  return bytes / 1200;
}

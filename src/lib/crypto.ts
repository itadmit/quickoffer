import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ENC_PREFIX = "enc:";

function encryptionKey(): Buffer {
  const b64 = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!b64) throw new Error("SETTINGS_ENCRYPTION_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must be 32 bytes (base64)");
  }
  return key;
}

/** AES-256-GCM. Output: enc:<iv b64>.<tag b64>.<ciphertext b64> */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value;
  const [ivB64, tagB64, ctB64] = value.slice(ENC_PREFIX.length).split(".");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** sk-…7f3a - never expose full secrets to the admin UI */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 3)}…${value.slice(-4)}`;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---------- Signed tokens for magic links (/e/{token}, /s/{token}, admin cookie)

function tokenSecret(): string {
  const s = process.env.TOKEN_SECRET;
  if (!s) throw new Error("TOKEN_SECRET is not set");
  return s;
}

type TokenPayload = {
  /** purpose: e=edit quote, s=settings, a=admin session, d=professional's own device */
  p: "e" | "s" | "a" | "d";
  /** subject: quote id / user id / "admin" */
  s: string;
  /** expiry, unix seconds */
  x: number;
};

const b64url = (buf: Buffer) => buf.toString("base64url");

export function signToken(payload: TokenPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", tokenSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(
  token: string,
  purpose: TokenPayload["p"],
): TokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(
    createHmac("sha256", tokenSecret()).update(body).digest(),
  );
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as TokenPayload;
    if (payload.p !== purpose) return null;
    if (payload.x < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function makeToken(
  purpose: TokenPayload["p"],
  subject: string,
  ttlSeconds: number,
): string {
  return signToken({
    p: purpose,
    s: subject,
    x: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
}

import { b64url, fromB64url } from "./encoding";

// Session cookie value: base64url("<userId>|<expiresMs>") + "." + base64url(HMAC-SHA256).

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const enc = new TextEncoder();

async function hmac(secret: string, payload: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, enc.encode(payload));
}

export async function signSession(userId: number, secret: string, now = Date.now()): Promise<string> {
  const payload = b64url(`${userId}|${now + SESSION_TTL_MS}`);
  return `${payload}.${b64url(await hmac(secret, payload))}`;
}

export async function verifySession(
  cookie: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<number | null> {
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const expected = b64url(await hmac(secret, payload));
  if (!timingSafeEqual(sig, expected)) return null;

  const decoded = fromB64url(payload);
  const match = decoded?.match(/^(\d+)\|(\d+)$/);
  if (!match) return null;
  const [, id, expires] = match;
  if (Number(expires) < now) return null;
  return Number(id);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

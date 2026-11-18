const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array | string): string {
  const data = typeof bytes === "string" ? enc.encode(bytes) : new Uint8Array(bytes);
  let bin = "";
  for (const b of data) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): string | null {
  try {
    return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

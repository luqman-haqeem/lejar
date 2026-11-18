import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "../src/session";

const SECRET = "s3cret";
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 18);

describe("session cookie", () => {
  it("round-trips the user id", async () => {
    const cookie = await signSession(42, SECRET, NOW);
    expect(await verifySession(cookie, SECRET, NOW + DAY)).toBe(42);
  });

  it("is still valid just before 30 days and expired after", async () => {
    const cookie = await signSession(42, SECRET, NOW);
    expect(await verifySession(cookie, SECRET, NOW + 30 * DAY - 1)).toBe(42);
    expect(await verifySession(cookie, SECRET, NOW + 30 * DAY + 1)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const cookie = await signSession(42, "other", NOW);
    expect(await verifySession(cookie, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const cookie = await signSession(42, SECRET, NOW);
    const [, sig] = cookie.split(".");
    const forged = `${btoa(`7|${NOW + 30 * DAY}`).replace(/=+$/, "")}.${sig}`;
    expect(await verifySession(forged, SECRET, NOW)).toBeNull();
  });

  it("rejects missing and malformed cookies", async () => {
    expect(await verifySession(undefined, SECRET, NOW)).toBeNull();
    expect(await verifySession("", SECRET, NOW)).toBeNull();
    expect(await verifySession("garbage", SECRET, NOW)).toBeNull();
    expect(await verifySession("a.b.c", SECRET, NOW)).toBeNull();
  });
});

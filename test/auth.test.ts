import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { verifySession } from "../src/session";
import { cookieValue, fakeGoogle, signInThroughGoogle } from "./fake-google";

const app = createApp();

describe("route guard and sign-in page", () => {
  it("redirects a signed-out visitor from the dashboard to sign-in", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("redirects a forged session cookie to sign-in", async () => {
    const res = await app.request("/", { headers: { cookie: "kereta_session=forged.cookie" } }, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("serves the health check without signing in", async () => {
    const res = await app.request("/healthz", {}, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("shows a Sign in with Google button", async () => {
    const res = await app.request("/login", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Sign in with Google");
    expect(html).toContain('href="/auth/google"');
  });
});

describe("starting Google sign-in", () => {
  it("redirects to Google with PKCE, state and only the openid email scopes", async () => {
    const res = await app.request("https://kereta.test/auth/google", {}, env);
    expect(res.status).toBe(302);

    const url = new URL(res.headers.get("location")!);
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email");
    expect(url.searchParams.get("redirect_uri")).toBe("https://kereta.test/auth/google/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/^kereta_oauth=/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Max-Age=600");
  });

  it("uses a fresh state each time", async () => {
    const a = new URL((await app.request("/auth/google", {}, env)).headers.get("location")!);
    const b = new URL((await app.request("/auth/google", {}, env)).headers.get("location")!);
    expect(a.searchParams.get("state")).not.toBe(b.searchParams.get("state"));
  });
});

describe("returning from Google", () => {
  it("signs in a verified account, creating its user, and opens the dashboard", async () => {
    const app = createApp({
      fetchFn: fakeGoogle({ sub: "sub-new", email: "new@example.com", email_verified: true }),
    });
    const res = await signInThroughGoogle(app);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    const sessionHeader = res.headers.getSetCookie().find((c) => c.startsWith("kereta_session="))!;
    expect(sessionHeader).toContain("HttpOnly");
    expect(sessionHeader).toContain("Secure");
    expect(sessionHeader).toContain(`Max-Age=${30 * 24 * 60 * 60}`);

    const dashboard = await app.request(
      "/",
      { headers: { cookie: `kereta_session=${cookieValue(res, "kereta_session")}` } },
      env,
    );
    expect(dashboard.status).toBe(200);
  });

  it("reuses the same user for the same Google account and refreshes its email", async () => {
    const first = await signInThroughGoogle(
      createApp({ fetchFn: fakeGoogle({ sub: "sub-repeat", email: "old@example.com", email_verified: true }) }),
    );
    const second = await signInThroughGoogle(
      createApp({ fetchFn: fakeGoogle({ sub: "sub-repeat", email: "new@example.com", email_verified: true }) }),
    );
    const other = await signInThroughGoogle(
      createApp({ fetchFn: fakeGoogle({ sub: "sub-someone-else", email: "x@example.com", email_verified: true }) }),
    );

    const id1 = await verifySession(cookieValue(first, "kereta_session"), env.SESSION_SECRET);
    const id2 = await verifySession(cookieValue(second, "kereta_session"), env.SESSION_SECRET);
    const id3 = await verifySession(cookieValue(other, "kereta_session"), env.SESSION_SECRET);
    expect(id1).not.toBeNull();
    expect(id2).toBe(id1);
    expect(id3).not.toBe(id1);

    const row = await env.DB.prepare("SELECT email FROM users WHERE google_sub = ?").bind("sub-repeat").first();
    expect(row?.email).toBe("new@example.com");
  });
});

describe("refusing to sign in", () => {
  const verified = { sub: "sub-refused", email: "r@example.com", email_verified: true };

  it("rejects an unverified Google email without creating a user or session", async () => {
    const app = createApp({ fetchFn: fakeGoogle({ sub: "sub-unverified", email: "u@example.com", email_verified: false }) });
    const res = await signInThroughGoogle(app);

    expect(res.status).toBe(403);
    expect(await res.text()).toContain("Not authorised");
    expect(cookieValue(res, "kereta_session")).toBeUndefined();
    const row = await env.DB.prepare("SELECT id FROM users WHERE google_sub = ?").bind("sub-unverified").first();
    expect(row).toBeNull();
  });

  it("rejects a state that does not match the one we issued", async () => {
    const res = await signInThroughGoogle(createApp({ fetchFn: fakeGoogle(verified) }), { state: "attacker-state" });
    expect(res.status).toBe(400);
    expect(cookieValue(res, "kereta_session")).toBeUndefined();
  });

  it("rejects a callback that arrives without our sign-in cookie", async () => {
    const res = await signInThroughGoogle(createApp({ fetchFn: fakeGoogle(verified) }), { withOauthCookie: false });
    expect(res.status).toBe(400);
    expect(cookieValue(res, "kereta_session")).toBeUndefined();
  });

  it("shows sign-in again with an error when Google refuses the code", async () => {
    const res = await signInThroughGoogle(createApp({ fetchFn: fakeGoogle(verified) }), { code: "expired-code" });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Sign in with Google");
    expect(cookieValue(res, "kereta_session")).toBeUndefined();
  });
});

describe("edge cases on the way back from Google", () => {
  it("says sign-in was cancelled when the user declines on Google's screen", async () => {
    const res = await app.request("https://kereta.test/auth/google/callback?error=access_denied&state=x", {}, env);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Sign-in was cancelled");
  });

  it("keeps the session cookie Secure over https but not on plain-http local dev", async () => {
    const user = { sub: "sub-local", email: "l@example.com", email_verified: true };
    const https = await signInThroughGoogle(createApp({ fetchFn: fakeGoogle(user) }));
    const httpApp = createApp({ fetchFn: fakeGoogle(user) });
    const start = await httpApp.request("http://localhost:8787/auth/google", {}, env);
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const local = await httpApp.request(
      `http://localhost:8787/auth/google/callback?code=good-code&state=${state}`,
      { headers: { cookie: start.headers.get("set-cookie")!.split(";")[0] } },
      env,
    );

    const secureOf = (res: Response) =>
      res.headers.getSetCookie().find((c) => c.startsWith("kereta_session="))!.includes("Secure");
    expect(local.status).toBe(302);
    expect(secureOf(https)).toBe(true);
    expect(secureOf(local)).toBe(false);
  });
});

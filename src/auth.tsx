import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "./app-types";
import { b64url, randomToken } from "./encoding";
import { SESSION_TTL_MS, signSession } from "./session";
import { upsertUser } from "./users";
import { Login } from "./views/Login";

export const SESSION_COOKIE = "kereta_session";
export const OAUTH_COOKIE = "kereta_oauth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

/** Hosts the local dev sign-in answers on. Exact matches only, so "localhost.example.com" is refused. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * True only on a local dev server with DEV_LOGIN=1 in .dev.vars, where Google sign-in can't complete.
 * Both must hold: production never sets the flag, and a deployed host is never local.
 */
export function devLoginAllowed(c: Context<AppEnv>): boolean {
  return c.env.DEV_LOGIN === "1" && LOCAL_HOSTS.has(new URL(c.req.url).hostname);
}

export type GoogleClient = { clientId: string; clientSecret: string; redirectUri: string };
export type GoogleIdentity = { sub: string; email: string; verified: boolean };

export async function fetchGoogleIdentity(
  client: GoogleClient,
  code: string,
  verifier: string,
  fetchFn: typeof fetch,
): Promise<GoogleIdentity> {
  const tokenRes = await fetchFn(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: client.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json<{ access_token: string }>();

  const infoRes = await fetchFn(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) throw new Error(`userinfo failed: ${infoRes.status}`);
  const info = await infoRes.json<{ sub: string; email: string; email_verified: boolean }>();
  return { sub: info.sub, email: info.email, verified: info.email_verified === true };
}

// The sign-in cookie carries the state we issued and the PKCE verifier, as "<state>.<verifier>".
type PendingSignIn = { state: string; verifier: string };

function encodePending(p: PendingSignIn): string {
  return `${p.state}.${p.verifier}`;
}

function decodePending(raw: string | undefined): PendingSignIn | null {
  const [state, verifier, ...rest] = (raw ?? "").split(".");
  return state && verifier && rest.length === 0 ? { state, verifier } : null;
}

async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

function googleClient(c: Context<AppEnv>): GoogleClient {
  return {
    clientId: c.env.GOOGLE_CLIENT_ID,
    clientSecret: c.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${new URL(c.req.url).origin}/auth/google/callback`,
  };
}

// Secure everywhere except plain-http local dev, where Safari would drop a Secure cookie.
function cookieOptions(c: Context<AppEnv>, path: string) {
  return { httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Lax", path } as const;
}

export function authRoutes(fetchFn: typeof fetch = fetch) {
  const routes = new Hono<AppEnv>();

  routes.get("/auth/google", async (c) => {
    const pending = { state: randomToken(), verifier: randomToken() };
    setCookie(c, OAUTH_COOKIE, encodePending(pending), { ...cookieOptions(c, "/auth"), maxAge: 600 });

    const client = googleClient(c);
    const url = new URL(GOOGLE_AUTH_URL);
    url.search = new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: client.redirectUri,
      response_type: "code",
      scope: "openid email",
      state: pending.state,
      code_challenge: await pkceChallenge(pending.verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return c.redirect(url.toString(), 302);
  });

  routes.get("/auth/google/callback", async (c) => {
    const pending = decodePending(getCookie(c, OAUTH_COOKIE));
    deleteCookie(c, OAUTH_COOKIE, cookieOptions(c, "/auth"));

    if (c.req.query("error")) {
      return c.html(<Login error="Sign-in was cancelled." />, 400);
    }
    const code = c.req.query("code");
    if (!pending || c.req.query("state") !== pending.state || !code) {
      return c.html(<Login error="Sign-in expired or was interrupted. Please try again." />, 400);
    }

    let identity: GoogleIdentity;
    try {
      identity = await fetchGoogleIdentity(googleClient(c), code, pending.verifier, fetchFn);
    } catch {
      return c.html(<Login error="Google sign-in didn't complete. Please try again." />, 400);
    }
    if (!identity.verified) {
      return c.html(<Login error="Not authorised: your Google email isn't verified." />, 403);
    }

    const userId = await upsertUser(c.env.DB, identity.sub, identity.email);
    setCookie(c, SESSION_COOKIE, await signSession(userId, c.env.SESSION_SECRET), {
      ...cookieOptions(c, "/"),
      maxAge: SESSION_TTL_MS / 1000,
    });
    return c.redirect("/", 302);
  });

  // Always registered, so a refused request is a plain 404 rather than a redirect to sign-in.
  routes.post("/auth/dev", async (c) => {
    if (!devLoginAllowed(c)) return c.text("Not found", 404);
    const userId = await upsertUser(c.env.DB, "dev-local", "dev@localhost");
    setCookie(c, SESSION_COOKIE, await signSession(userId, c.env.SESSION_SECRET), {
      ...cookieOptions(c, "/"),
      maxAge: SESSION_TTL_MS / 1000,
    });
    return c.redirect("/", 302);
  });

  routes.post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, cookieOptions(c, "/"));
    return c.redirect("/login", 302);
  });

  return routes;
}

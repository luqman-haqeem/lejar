import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "./app-types";
import { b64url, SESSION_TTL_MS, signSession } from "./session";
import { upsertUser } from "./users";
import { Login } from "./views/Login";

export const SESSION_COOKIE = "kereta_session";
export const OAUTH_COOKIE = "kereta_oauth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleIdentity = { sub: string; email: string; verified: boolean };

export async function fetchGoogleIdentity(
  code: string,
  verifier: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  fetchFn: typeof fetch,
): Promise<GoogleIdentity> {
  const tokenRes = await fetchFn(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
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

function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

function callbackUrl(requestUrl: string): string {
  return `${new URL(requestUrl).origin}/auth/google/callback`;
}

export function authRoutes(fetchFn: typeof fetch = fetch) {
  const routes = new Hono<AppEnv>();

  routes.get("/auth/google", async (c) => {
    const state = randomToken();
    const verifier = randomToken();
    setCookie(c, OAUTH_COOKIE, `${state}.${verifier}`, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/auth",
      maxAge: 600,
    });

    const url = new URL(GOOGLE_AUTH_URL);
    url.search = new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID,
      redirect_uri: callbackUrl(c.req.url),
      response_type: "code",
      scope: "openid email",
      state,
      code_challenge: await pkceChallenge(verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return c.redirect(url.toString(), 302);
  });

  routes.get("/auth/google/callback", async (c) => {
    const [expectedState, verifier] = (getCookie(c, OAUTH_COOKIE) ?? "").split(".");
    deleteCookie(c, OAUTH_COOKIE, { path: "/auth", secure: true });
    const state = c.req.query("state");
    const code = c.req.query("code");
    if (!expectedState || !verifier || state !== expectedState || !code) {
      return c.html(<Login error="Sign-in expired or was interrupted. Please try again." />, 400);
    }

    let identity: GoogleIdentity;
    try {
      identity = await fetchGoogleIdentity(
        code,
        verifier,
        callbackUrl(c.req.url),
        c.env.GOOGLE_CLIENT_ID,
        c.env.GOOGLE_CLIENT_SECRET,
        fetchFn,
      );
    } catch {
      return c.html(<Login error="Google sign-in didn't complete. Please try again." />, 400);
    }
    if (!identity.verified) {
      return c.html(<Login error="Not authorised: your Google email isn't verified." />, 403);
    }

    const userId = await upsertUser(c.env.DB, identity.sub, identity.email);
    setCookie(c, SESSION_COOKIE, await signSession(userId, c.env.SESSION_SECRET), {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
    return c.redirect("/", 302);
  });

  routes.post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
    return c.redirect("/login", 302);
  });

  return routes;
}

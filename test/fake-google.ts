import { env } from "cloudflare:workers";
import type { Hono } from "hono";

export type GoogleUser = { sub: string; email: string; email_verified: boolean };

/** Stands in for Google's token and userinfo endpoints. Only knows the code "good-code". */
export function fakeGoogle(user: GoogleUser): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.href === "https://oauth2.googleapis.com/token" && req.method === "POST") {
      const form = await req.formData();
      if (form.get("code") !== "good-code" || !form.get("code_verifier")) {
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      return Response.json({ access_token: "fake-access-token", token_type: "Bearer" });
    }
    if (url.href === "https://openidconnect.googleapis.com/v1/userinfo") {
      if (req.headers.get("authorization") !== "Bearer fake-access-token") {
        return new Response("unauthorized", { status: 401 });
      }
      return Response.json(user);
    }
    return new Response("unexpected request", { status: 500 });
  }) as typeof fetch;
}

/** Starts sign-in, then hits the callback the way the browser would after Google redirects back. */
export async function signInThroughGoogle(
  app: Hono<any>,
  opts: { code?: string; state?: string; withOauthCookie?: boolean } = {},
): Promise<Response> {
  const start = await app.request("https://kereta.test/auth/google", {}, env);
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const oauthCookie = start.headers.get("set-cookie")!.split(";")[0];

  const params = new URLSearchParams({ code: opts.code ?? "good-code", state: opts.state ?? state });
  const headers: Record<string, string> = {};
  if (opts.withOauthCookie !== false) headers.cookie = oauthCookie;
  return app.request(`https://kereta.test/auth/google/callback?${params}`, { headers }, env);
}

export function cookieValue(res: Response, name: string): string | undefined {
  const all = res.headers.getSetCookie();
  const hit = all.find((c) => c.startsWith(`${name}=`));
  return hit?.split(";")[0].slice(name.length + 1);
}

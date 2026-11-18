import { env } from "cloudflare:workers";
import { SESSION_COOKIE } from "../src/auth";
import { signSession } from "../src/session";
import { upsertUser } from "../src/users";

/** Creates a user directly (as if they had signed in with Google) and returns its id. */
export async function makeUser(email = "someone@example.com"): Promise<number> {
  return upsertUser(env.DB, `sub-${crypto.randomUUID()}`, email);
}

/** Request headers carrying a valid session for the given user. */
export async function sessionHeaders(userId: number): Promise<Record<string, string>> {
  return { cookie: `${SESSION_COOKIE}=${await signSession(userId, env.SESSION_SECRET)}` };
}

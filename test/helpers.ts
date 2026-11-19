import { env } from "cloudflare:workers";
import { SESSION_COOKIE } from "../src/auth";
import { signSession } from "../src/session";
import { listItems } from "../src/db";
import { upsertUser } from "../src/users";

/** Creates a user directly (as if they had signed in with Google) and returns its id. */
export async function makeUser(email = "someone@example.com"): Promise<number> {
  return upsertUser(env.DB, `sub-${crypto.randomUUID()}`, email);
}

/** Request headers carrying a valid session for the given user. */
export async function sessionHeaders(userId: number): Promise<Record<string, string>> {
  return { cookie: `${SESSION_COOKIE}=${await signSession(userId, env.SESSION_SECRET)}` };
}

/** POSTs urlencoded form fields as the given user. */
export async function postForm(
  app: { request: (path: string, init: RequestInit, env: Cloudflare.Env) => Response | Promise<Response> },
  path: string,
  userId: number,
  fields: Record<string, string>,
): Promise<Response> {
  return app.request(
    path,
    { method: "POST", headers: await sessionHeaders(userId), body: new URLSearchParams(fields) },
    env,
  );
}

/** A vehicle's schedule, read as its owner. */
export async function itemsOf(vehicleId: number) {
  const owner = await env.DB.prepare("SELECT user_id FROM vehicles WHERE id = ?").bind(vehicleId).first<{ user_id: number }>();
  return listItems(env.DB, owner!.user_id, vehicleId);
}

/**
 * Starts a vehicle's schedule (as if the owner had set one last-done date) on its last item, leaving the
 * others unknown, so the dashboard shows its rows rather than the "not started" row.
 */
export async function startSchedule(vehicleId: number, date = "2026-10-01") {
  const items = await itemsOf(vehicleId);
  await env.DB.prepare("UPDATE service_items SET baseline_date = ? WHERE id = ?").bind(date, items.at(-1)!.id).run();
}

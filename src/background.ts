import type { Context } from "hono";
import type { AppEnv } from "./app-types";

/** Runs work after the response when the runtime allows it (Workers), otherwise inline (tests). Never throws. */
export async function inBackground(c: Context<AppEnv>, work: Promise<unknown>): Promise<void> {
  const safe = work.catch(() => {});
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    await safe;
  }
}

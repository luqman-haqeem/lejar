import type { Context } from "hono";
import type { AppEnv } from "./app-types";
import { NotFound } from "./views/NotFound";

/** 404 for anything missing or not the user's, so other users' records stay invisible. */
export const notFound = (c: Context<AppEnv>) => c.html(<NotFound />, 404);

/** A positive integer id from a query or form value, or null. */
export const idOf = (s: unknown) => (typeof s === "string" && /^\d+$/.test(s) ? Number(s) : null);

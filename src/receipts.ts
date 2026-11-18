import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { receiptKeysInUse } from "./db";

// Receipt photos live in the private R2 bucket under receipts/<userId>/<uuid>.<ext>. The database
// stores only the key, and the worker serves photos to their owner through /receipts/....

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type PhotoProblem = { status: 413 | 415; message: string };

/** Why an upload can't be stored, or null if it's fine. */
export function photoProblem(file: File): PhotoProblem | null {
  if (file.size > MAX_PHOTO_BYTES) return { status: 413, message: "Photo too large" };
  if (!(file.type in EXTENSIONS)) return { status: 415, message: "Unsupported image" };
  return null;
}

const ownPrefix = (userId: number) => `receipts/${userId}/`;
const KEY_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** True for a well-formed key in this user's prefix. Says nothing about whether the object exists. */
export function isOwnKey(key: string, userId: number): boolean {
  return key.startsWith(ownPrefix(userId)) && KEY_NAME.test(key.slice(ownPrefix(userId).length));
}

/** Stores a checked photo (see photoProblem) and returns its key. */
export async function putReceipt(bucket: R2Bucket, userId: number, file: File): Promise<string> {
  const key = `${ownPrefix(userId)}${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return key;
}

export async function receiptExists(bucket: R2Bucket, key: string): Promise<boolean> {
  return (await bucket.head(key)) !== null;
}

export async function deleteReceipt(bucket: R2Bucket, key: string | null): Promise<void> {
  if (key) await bucket.delete(key);
}

/**
 * Deletes the user's photos that are over 24 hours old and that no service references: uploads
 * whose form was never saved. Returns how many it deleted.
 */
export async function cleanupOrphans(bucket: R2Bucket, db: D1Database, userId: number, now = Date.now()): Promise<number> {
  const [listing, inUse] = await Promise.all([
    bucket.list({ prefix: ownPrefix(userId) }),
    receiptKeysInUse(db, userId),
  ]);
  const orphans = listing.objects
    .filter((o) => now - o.uploaded.getTime() > ORPHAN_AGE_MS && !inUse.has(o.key))
    .map((o) => o.key);
  if (orphans.length > 0) await bucket.delete(orphans);
  return orphans.length;
}

export function receiptRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/receipts/:userId{[0-9]+}/:name", async (c) => {
    const key = `receipts/${c.req.param("userId")}/${c.req.param("name")}`;
    if (!isOwnKey(key, c.get("userId"))) return c.notFound();
    const object = await c.env.RECEIPTS.get(key);
    if (!object) return c.notFound();
    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "cache-control": "private, max-age=86400",
      },
    });
  });

  return routes;
}

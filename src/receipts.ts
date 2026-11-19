import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { referencedPhotoKeys } from "./db";

// Receipt photos live in the private R2 bucket under receipts/<userId>/<uuid>.<ext>, and Vehicle
// photos under vehicle-photos/<userId>/<uuid>.<ext>. The database stores only the key, and the worker
// serves photos to their owner through /receipts/... and /vehicle-photos/....

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
/** A form post bigger than this can't hold an acceptable photo, so it's refused before parsing. */
export const MAX_UPLOAD_REQUEST_BYTES = MAX_PHOTO_BYTES + 256 * 1024;
export const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type PhotoProblem = { status: 413 | 415; message: string };

/** Why an upload can't be stored, or null if it's fine. */
export function photoProblem(file: File): PhotoProblem | null {
  if (file.size > MAX_PHOTO_BYTES) return PHOTO_TOO_LARGE;
  if (!(file.type in EXTENSIONS)) return { status: 415, message: "Unsupported image" };
  return null;
}

export const PHOTO_TOO_LARGE: PhotoProblem = { status: 413, message: "Photo too large" };

/** True when the request says it's bigger than any acceptable photo upload. */
export function uploadTooLarge(req: Request): boolean {
  return Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_REQUEST_BYTES;
}

const PREFIX = "receipts/";
const VEHICLE_PREFIX = "vehicle-photos/";
const ownPrefix = (userId: number, prefix = PREFIX) => `${prefix}${userId}/`;

/** Where the app serves a stored photo (to its owner only). */
export const receiptUrl = (key: string) => `/${key}`;
const KEY_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** True for a well-formed key in this user's prefix. Says nothing about whether the object exists. */
export function isOwnKey(key: string, userId: number, prefix = PREFIX): boolean {
  const own = ownPrefix(userId, prefix);
  return key.startsWith(own) && KEY_NAME.test(key.slice(own.length));
}

async function putPhoto(bucket: R2Bucket, prefix: string, file: File): Promise<string> {
  const key = `${prefix}${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  await bucket.put(key, file, { httpMetadata: { contentType: file.type } });
  return key;
}

/** Stores a checked receipt photo (see photoProblem) and returns its key. */
export const putReceipt = (bucket: R2Bucket, userId: number, file: File) => putPhoto(bucket, ownPrefix(userId), file);

/** Stores a checked Vehicle photo (see photoProblem) and returns its key. */
export const putVehiclePhoto = (bucket: R2Bucket, userId: number, file: File) =>
  putPhoto(bucket, ownPrefix(userId, VEHICLE_PREFIX), file);

/** Where the app serves a stored Vehicle photo (to its owner only). */
export const vehiclePhotoUrl = (key: string) => `/${key}`;

export async function receiptExists(bucket: R2Bucket, key: string): Promise<boolean> {
  return (await bucket.head(key)) !== null;
}

export async function deleteReceipt(bucket: R2Bucket, key: string | null): Promise<void> {
  if (key) await bucket.delete(key);
}

/** Pages of the bucket listing one cleanup run looks at, bounding its cost. */
const CLEANUP_PAGES = 5;

/**
 * Deletes photos over 24 hours old that no service or vehicle references: uploads whose form was never
 * saved. Covers every user, so one who abandons a form and never uploads again is still cleaned up.
 * Returns how many it deleted.
 */
export async function cleanupOrphans(bucket: R2Bucket, db: D1Database, now = Date.now()): Promise<number> {
  const old: string[] = [];
  for (const prefix of [PREFIX, VEHICLE_PREFIX]) {
    let cursor: string | undefined;
    for (let page = 0; page < CLEANUP_PAGES; page++) {
      const listing = await bucket.list({ prefix, cursor });
      for (const o of listing.objects) if (now - o.uploaded.getTime() > ORPHAN_AGE_MS) old.push(o.key);
      if (!listing.truncated) break;
      cursor = listing.cursor;
    }
  }
  if (old.length === 0) return 0;
  const inUse = await referencedPhotoKeys(db, old);
  const orphans = old.filter((k) => !inUse.has(k));
  for (let i = 0; i < orphans.length; i += 1000) await bucket.delete(orphans.slice(i, i + 1000));
  return orphans.length;
}

export function receiptRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/:prefix{receipts|vehicle-photos}/:userId{[0-9]+}/:name", async (c) => {
    const prefix = `${c.req.param("prefix")}/`;
    const key = `${prefix}${c.req.param("userId")}/${c.req.param("name")}`;
    if (!isOwnKey(key, c.get("userId"), prefix)) return c.notFound();
    const object = await c.env.RECEIPTS.get(key);
    if (!object) return c.notFound();
    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
      },
    });
  });

  return routes;
}

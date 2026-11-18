export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Receipt photos, keyed receipts/<userId>/<uuid>.<ext>. Never public. */
  RECEIPTS: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
};

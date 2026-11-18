export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Receipt photos, keyed receipts/<userId>/<uuid>.<ext>. Never public. */
  RECEIPTS: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  OPENROUTER_API_KEY: string;
  /** OpenRouter vision model for receipt scans. */
  SCAN_MODEL: string;
  /** AI scans allowed per user per Malaysia day (manual logging is never limited). */
  SCAN_CAP_PER_USER: string;
  /** AI scans allowed per Malaysia day across all users: a backstop on the OpenRouter bill. */
  SCAN_CAP_GLOBAL: string;
  /** Shown on /privacy for questions and deletion requests. A secret, to keep the address out of the repo. */
  CONTACT_EMAIL: string;
};

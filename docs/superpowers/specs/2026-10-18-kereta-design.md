# Kereta — personal vehicle service book (CareReta-style), on Cloudflare Workers

## Context
The user tried carereta.my, a Malaysian digital car service book, and wants their own version. They'll use it themselves first, but **anyone with a Google account can sign up** (decided 2026-10-18), and each user sees only their own data. It will be a **standalone web app with no Hermes connection**.

What the user decided:
- **Features:** service log and history, due-date tracking (service by km or date, road tax, insurance), and receipt photo scan. Fuel, tyres and the duplicate-part alert are out of scope.
- **Vehicles:** several, both cars and motorbikes, each with its own intervals.
- **Odometer:** taken from each service log. Mileage between services is estimated.
- **Login:** **Google sign-in, open to anyone** with a verified Google account. There's no allowlist.
- **Scan cap:** **20 receipt scans per user per day** (Malaysia date) to protect the OpenRouter bill. Manual logging is never capped.
- **Receipt photos:** stored in **R2**.
- **Hosting:** a Cloudflare `*.workers.dev` address on the user's existing account.
- **Receipt reading:** an OpenRouter vision model, using the user's existing key.
- **Phone:** iPhone.
- **Push notifications:** deferred to **Phase 2**. In Phase 1, the dashboard shows what's due.
- **Past history:** exists as paper receipts and a service book. The user will enter it themselves, so backdated entry must be quick, and old receipts can go through the scan flow.
- **Expenses:** service costs are not linked to any expense tracker.

**Success (Phase 1):** the user opens the app on their iPhone, signs in with Google, and snaps a workshop receipt. They check and correct the fields, then save. The dashboard shows which oil change, road tax or insurance renewal is coming up. They can print or save any vehicle's full history as a PDF for resale.

**Anti-goals:**
- One user seeing or changing another user's vehicles, services or receipts.
- A surprise OpenRouter bill. Hence the per-user cap, plus a global daily cap (Claude's call).
- Ads, a workshop marketplace, teams, or shared vehicles.
- Wrong due dates caused by a misread odometer, which is why every scan is confirmed before saving.
- A heavy build toolchain to maintain.

## Stack (Claude's calls; the user can override)
- **Code:** a new git repo at **`~/kereta`**, TypeScript, **Hono** on Cloudflare Workers. Pages are server-rendered with Hono JSX, plus a little vanilla JS for photo compression and upload. There is no React/SPA build.
- **Data:** **D1** (SQLite) holds all data.
- **Receipts:** stored in an **R2** bucket called `kereta-receipts`. The browser compresses each photo to a JPEG of about 500 KB before upload. Each object is keyed `receipts/<user_id>/<uuid>.jpg` (`.png`/`.webp` if the browser couldn't convert it), and D1 stores only the key. The worker serves images through an auth-guarded route `/receipts/:key`, and the bucket is never public.
- **PWA:** a manifest and icons, so the app can be added to the iPhone Home Screen and feel like an app. The service worker comes in Phase 2 along with push.
- **Free plan:** everything is built to fit the Workers Free plan's limit of about 10 ms CPU per request. Images are compressed on the client, and OpenRouter and Google calls are network waits, which don't count as CPU time.
- **Secrets** (set with `wrangler secret`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `OPENROUTER_API_KEY`.
- **Variables:** `SCAN_MODEL` (default `google/gemini-2.5-flash`), `SCAN_CAP_PER_USER` (20), and `SCAN_CAP_GLOBAL` (300 per day across all users; Claude's call, a backstop in case of many throwaway accounts).
- **Tests:** vitest with `@cloudflare/vitest-plugin` (the renamed successor of `@cloudflare/vitest-pool-workers`).
- **Locale:** UI in English, money in RM, dates shown as DD/MM/YYYY, timezone Asia/Kuala_Lumpur.

## Auth: Google sign-in
This is a plain OAuth 2.0 authorization-code flow with PKCE, written by hand or with the small `arctic` library. There is no heavy auth framework.
- **Sign-in:** `GET /login` shows a "Sign in with Google" button.
- **Start:** `GET /auth/google` creates `state` and a PKCE verifier, stores them in short-lived HttpOnly cookies, and redirects to Google with scope `openid email`.
- **Callback:** `GET /auth/google/callback` checks `state`, exchanges the code, and reads the email.
  - It reads `email` and `email_verified` from Google's userinfo endpoint. This avoids verifying the JWT signature on the Worker.
  - Any verified Google email is accepted. An unverified one gets "Not authorised".
  - The user is upserted into `users`, keyed by Google `sub`, and the session stores the user id.
  - On success, it sets an HMAC-signed, HttpOnly, Secure session cookie that lasts 30 days.
- **Protection:** a middleware guards every route except `/login`, `/auth/*`, `/privacy` and `/healthz`.
- **Sign-out:** `POST /logout` clears the cookie.
- **One-time setup (the user does this):**
  1. Create an OAuth client of type "Web application" in Google Cloud Console. The existing Google Cloud project used for the Hermes Gmail OAuth can be reused, or a new one created.
  2. Add the redirect URIs `https://kereta.<subdomain>.workers.dev/auth/google/callback` and `http://localhost:8787/auth/google/callback`.
  3. While building, keep the consent screen in "Testing" mode with the user as a test user. To open to the public, **publish** the consent screen. With only the `openid email` scopes this needs no security review, but Google requires a homepage and a privacy policy URL, so the app serves `/privacy`.

## Data model (D1, `migrations/`: one numbered migration per ticket that adds tables)
- **`users`**: id, google_sub (unique), email, created_at.
- **`scan_usage`**: user_id, date (Malaysia date), count. Primary key (user_id, date).
- **Ownership:** `vehicles` carries `user_id`. Everything else belongs to a user through its vehicle. Every query and route checks ownership, and another user's id returns 404.
- **`vehicles`**: id, user_id, type (`car` | `motorbike`), name, plate, make, model, year, roadtax_expiry, insurance_expiry, insurer, archived.
- **`service_items`**: the schedule for each vehicle. Columns: id, vehicle_id, name, interval_km (nullable), interval_months (nullable), baseline_date (nullable), baseline_km (nullable).
  - New vehicles are seeded from a template for their type, and the user can edit it.
  - Car template: engine oil 10k km / 6 mo, oil filter 10k / 6, air filter 20k / 12, cabin filter 20k / 12, ATF/CVT 40k / 24, spark plugs 40k / 24, brake fluid — / 24, coolant 40k / 24.
  - Motorbike template: engine oil 3k / 3, oil filter 6k / 6, spark plug 10k / 12, drive chain/belt 1k / 1, brake fluid — / 24.
  - These intervals are Claude's guesses, for the user to correct.
- **`services`**: one row per workshop visit. Columns: id, vehicle_id, date, odometer_km, workshop, total_rm, notes, receipt_key (nullable, the R2 key).
- **`service_lines`**: id, service_id, description, cost_rm, service_item_id (nullable). A line linked to a schedule item resets that item's due clock.
- **`odometer_readings`**: id, vehicle_id, date, km, source (`service` | `manual`). Every service also writes a reading.
- **Phase 2 tables** (not created in Phase 1): `push_subscriptions` and `notifications_sent`.

## Due-date logic (`src/lib/due.ts`, pure functions, fully unit-tested)
- **Estimated current km:** the latest reading plus (average km/day × days since that reading). The average uses readings from the last 12 months, plus the latest reading before them as an anchor. With fewer than 2 readings, the estimate is the latest reading; with none, there is no estimate and only date-based due dates apply.
- **For each service item:**
  - The last time it was done is the most recent linked `service_line`. If there isn't one, the baseline is used.
  - Due km = last km + interval km. Due date = last date + interval months. Whichever comes first wins.
  - With neither a linked line nor a baseline, the item shows "unknown — set last done". Tapping it opens a small baseline form asking for an approximate date and/or km.
  - Baselines never appear in history or the print view, so a buyer never sees made-up workshop visits.
- **Service item status:**
  - **Overdue:** past the due km or due date.
  - **Due soon:** within 1,000 km (car) or 300 km (motorbike), or within 14 days.
  - **OK:** otherwise.
- **Road tax and insurance:** due soon from 30 days before expiry, and overdue on and after expiry.
- **Stale odometer:** if the latest reading is more than 30 days old, the dashboard shows an "Update odometer" prompt.

## Screens / routes (Phase 1)
- **`/`** — dashboard. One card per vehicle, showing the nearest due items colour-coded, road tax and insurance countdowns, the stale-odometer prompt, and a prominent **Scan receipt** button.
- **`/vehicles/new`** and **`/vehicles/:id/edit`** — vehicle details plus an editable schedule table, including baselines.
- **`/vehicles/:id`** — history, newest first, showing date, odometer, workshop and total. Also shows totals per year, a **Print / Save PDF** link, and **Add odometer reading**.
- **`/services/new?vehicle=`** — the service form, with date, odometer, workshop, total and lines. Each line can be tagged with a schedule item.
  - Any past date is accepted.
  - **Save & add another** keeps the vehicle and workshop filled in, so entering old paper records is quick.
- **Scan flow:**
  0. If the user has hit 20 scans today, or the global cap is reached, show "Daily scan limit reached — you can still log manually" with a link to the manual form. Nothing is uploaded.
  1. The user picks or takes a photo, and the client compresses it.
  2. `POST /api/scan` puts the photo in R2, then calls OpenRouter with a JSON-schema response asking for date, odometer, workshop, total, and lines (description, cost).
  3. The server suggests a schedule item for each line using a keyword map. For example, "minyak hitam" or "engine oil" maps to Engine oil.
  4. The service form opens prefilled, with the receipt image beside it. **Nothing is saved to D1 until the user presses Save.** The date comes from the receipt, so old receipts work too.
  5. Any field the AI couldn't read is left blank and highlighted.
  6. Receipts that are uploaded but never saved are deleted by a small cleanup: R2 objects older than 1 day that no service references.
- **`/services/:id`** — view, edit or delete a service, with its receipt image. Deleting a service also deletes its R2 object.
- **`/vehicles/:id/print`** — a page styled for printing, with the vehicle header, full history, line items and totals. The user saves it as a PDF from the browser.

## Public pages
- **`/privacy`**: a short plain-English privacy policy. It covers what's stored, that receipt photos are sent to OpenRouter for reading, that nothing is shared or sold, and how to request deletion via the contact email. This is required to publish the Google consent screen.
- The sign-in page doubles as a one-line homepage.

## Phase 2 (later, separate request)
- Self-serve account deletion and data export.
- Web Push to the iPhone. This needs the app installed on the Home Screen, iOS 16.4+, VAPID keys, and a push library that runs on Workers WebCrypto.
- A daily Cron Trigger at `0 1 * * *` UTC (09:00 Malaysia time) that sends each due threshold once.
- A settings page to enable push and send a test notification.

## Project layout
```
~/kereta/
  wrangler.jsonc          # D1 + R2 bindings, assets
  migrations/0001_init.sql
  src/index.tsx           # Hono app
  src/auth.ts  src/db.ts  src/scan.ts  src/receipts.ts
  src/lib/due.ts  src/lib/templates.ts  src/lib/matchItems.ts
  src/views/*.tsx
  public/                 # manifest, icons, app.js (compress+upload), print.css
  test/*.test.ts
```

## Left to the builder
- Visual styling: clean, mobile-first, no generic AI look.
- The exact receipt-extraction prompt and JSON schema.
- The keyword map.
- Whether to use `arctic` or a hand-rolled OAuth flow.
- Icons.

## Build order
1. Scaffold, D1 migration, Google auth.
2. Vehicles and schedule templates.
3. Manual service log and history.
4. `due.ts` with tests, plus the dashboard.
5. R2 receipts and the scan flow.
6. Print view.
7. Manifest and icons.
8. Deploy.

## Verification
- **Unit tests** (`npx vitest run`):
  - Due logic: km reached first vs date reached first, baselines, never-logged items, the estimate with fewer than 2 readings, road tax and insurance thresholds.
  - The auth callback rejects an email that isn't allowed and a mismatched `state`.
  - The scan response parser, with OpenRouter mocked.
  - Deleting a service also deletes its R2 object.
- **Local walkthrough** (`npx wrangler dev`, with local D1 and R2 in the browser):
  1. Sign in with Google.
  2. Add a car and a motorbike.
  3. Set baselines.
  4. Log a backdated manual service.
  5. Scan a real workshop receipt, correct the fields, and save. Confirm the image loads from R2.
  6. Check the dates on the dashboard.
  7. Open the print view and save it as a PDF.
- **Deploy:**
  1. The user runs `wrangler login`.
  2. Run `wrangler d1 create kereta`, `wrangler r2 bucket create kereta-receipts`, and `d1 migrations apply --remote`.
  3. Set the secrets and run `wrangler deploy`.
  4. Add the production redirect URI in Google Cloud.
  5. Sign in from the iPhone and add the app to the Home Screen.

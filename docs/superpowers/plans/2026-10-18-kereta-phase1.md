# Kereta Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A vehicle service-book web app that anyone can join with a Google account, where each user sees only their own data. Users sign in with Google, log services manually or by scanning a receipt, see what's due, and print a vehicle's history to PDF.

**Architecture:** One Cloudflare Worker running a Hono app that renders HTML on the server with Hono JSX. D1 holds all records and R2 holds receipt images. Due-date logic is a pure module (`src/lib/due.ts`). Everything that talks to the network (Google, OpenRouter) takes an injectable `fetchFn` so tests never hit the real services.

**Tech Stack:** TypeScript, Hono, Wrangler, D1, R2, vitest + `@cloudflare/vitest-pool-workers`, and OpenRouter's chat completions API with image input.

**Spec:** `docs/superpowers/specs/2026-10-18-kereta-design.md`

## Global Constraints
- **Hosting:** Workers Free plan, with a limit of about 10 ms CPU per request. Do no heavy hashing, and don't do image processing on the server.
- **Dependencies:** runtime deps are `hono` only, plus `arctic` if you choose it. There is no React or bundled SPA. Browser JS is one plain `public/app.js`.
- **Secrets:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `OPENROUTER_API_KEY`. Vars: `SCAN_MODEL` = `google/gemini-2.5-flash`, `SCAN_CAP_PER_USER` = `20`, `SCAN_CAP_GLOBAL` = `300`, `CONTACT_EMAIL` (set by the user).
- **Ownership:** every `db.ts` function that reads or writes user data takes `userId` and filters by it, through `vehicles.user_id`. Every route that sees an id belonging to another user returns **404** (not 403), so it doesn't reveal that the record exists.
- **Bindings:** D1 `DB` (database `kereta`) and R2 `RECEIPTS` (bucket `kereta-receipts`).
- **Dates:** stored as ISO `YYYY-MM-DD` and shown as `DD/MM/YYYY`. "Today" is always computed in `Asia/Kuala_Lumpur`.
- **Money:** stored as integer **sen** (`*_sen` columns) and shown as `RM 1,234.50`. This is Claude's call, to avoid float drift. The spec's `total_rm` / `cost_rm` become `total_sen` / `cost_sen`.
- **Locale:** UI copy is in English.
- **Commits:** one-line messages with no Co-Authored-By trailer.
- **Phase 2 is out of scope:** no push, cron, service worker, `push_subscriptions` or `notifications_sent`.

## Review Focus
1. **Odometer typo or out of order:** a service or reading whose km is lower than an earlier-dated reading, or higher than a later-dated one, for the same vehicle. Reject it with "Odometer X km conflicts with DD/MM/YYYY reading of Y km". This matters because backdated entry is common. Covered by a test in Task 5.
2. **Scan fails:** OpenRouter errors, times out, or returns something that isn't JSON. The form still opens with the receipt attached, the fields empty, and a banner saying "Couldn't read receipt — fill in manually". It must never return a 500. Covered by a test in Task 7.
3. **Month-end date maths:** last done 31/08 plus 6 months is due 28/02 (or 29/02), never 03/03. Covered by a test in Task 4.
4. **One user reaching another's data:** user B opens, edits, deletes, prints, or attaches a service to user A's vehicle, service or receipt by changing an id in the URL or form. Every case returns 404 and changes nothing. Covered by tests in Tasks 3, 5, 7 and 8.
5. **Upload that isn't a usable image:** a request over 2 MB or with a non-image content type gets a 413 or 415 with a readable message, and nothing is written to R2. Covered by a test in Task 7.

---

## File structure
```
wrangler.jsonc  package.json  tsconfig.json  vitest.config.ts
migrations/0001_init.sql
src/index.tsx            # app assembly, route mounting, auth middleware, exports default {fetch}
src/env.ts               # Env type (bindings + secrets)
src/auth.ts              # session sign/verify, Google OAuth routes
src/db.ts                # all D1 queries (typed row interfaces live here)
src/lib/dates.ts         # todayKL, addMonths, fmtDate, daysBetween
src/lib/money.ts         # parseRM -> sen, fmtRM
src/lib/templates.ts     # CAR_TEMPLATE, MOTORBIKE_TEMPLATE
src/lib/due.ts           # pure due computations
src/lib/matchItems.ts    # keyword -> service item suggestion
src/scan.ts              # OpenRouter call + response parsing
src/receipts.ts          # R2 put/get/delete/orphan cleanup + routes
src/routes/vehicles.tsx  src/routes/services.tsx  src/routes/dashboard.tsx  src/routes/print.tsx
src/views/Layout.tsx     src/views/*.tsx (one component per page/form)
public/app.js  public/app.css  public/print.css  public/manifest.webmanifest  public/icon-192.png  public/icon-512.png  public/apple-touch-icon.png
test/setup.ts  test/helpers.ts  test/*.test.ts
```

---

### Task 1: Scaffold, schema, test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `wrangler.jsonc`, `vitest.config.ts`, `migrations/0001_init.sql`, `src/env.ts`, `src/index.tsx`, `test/setup.ts`, `test/helpers.ts`, `test/schema.test.ts`, `.gitignore` (`node_modules`, `.wrangler`, `.dev.vars`), `.dev.vars.example`

**Interfaces:**
- Produces:
  - `type Env = { DB: D1Database; RECEIPTS: R2Bucket; ASSETS: Fetcher; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string; SESSION_SECRET: string; OPENROUTER_API_KEY: string; SCAN_MODEL: string; SCAN_CAP_PER_USER: string; SCAN_CAP_GLOBAL: string; CONTACT_EMAIL: string }`
  - `app: Hono<{ Bindings: Env }>`, exported default from `src/index.tsx`.
  - In `test/helpers.ts`: `testEnv(): Env`, which spreads `env` from `cloudflare:test` and adds fixed fake secrets.

**Notes:**
- `wrangler.jsonc` needs: name `kereta`, `main: src/index.tsx`, a recent `compatibility_date`, `compatibility_flags: ["nodejs_compat"]`, `assets: { directory: "public", binding: "ASSETS" }`, the `d1_databases` binding `DB` with `migrations_dir: "migrations"`, the `r2_buckets` binding `RECEIPTS`, and `vars.SCAN_MODEL`.
- The vitest config uses `defineWorkersConfig`, reads migrations with `readD1Migrations`, and passes them as the `TEST_MIGRATIONS` binding. `test/setup.ts` runs `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`.
- Schema, all tables with `id INTEGER PRIMARY KEY` unless stated:
  - `users(google_sub TEXT UNIQUE NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL)`
  - `scan_usage(user_id INTEGER NOT NULL REFERENCES users, date TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(user_id, date))`, with no id column.
  - `vehicles(user_id INTEGER NOT NULL REFERENCES users, type TEXT CHECK in ('car','motorbike'), name, plate, make, model, year INTEGER, roadtax_expiry TEXT, insurance_expiry TEXT, insurer TEXT, archived INTEGER DEFAULT 0)`
  - `service_items(vehicle_id REFERENCES vehicles ON DELETE CASCADE, name, interval_km INTEGER, interval_months INTEGER, baseline_date TEXT, baseline_km INTEGER, sort INTEGER)`
  - `services(vehicle_id, date TEXT NOT NULL, odometer_km INTEGER NOT NULL, workshop TEXT, total_sen INTEGER, notes TEXT, receipt_key TEXT)`
  - `service_lines(service_id REFERENCES services ON DELETE CASCADE, description, cost_sen INTEGER, service_item_id REFERENCES service_items ON DELETE SET NULL)`
  - `odometer_readings(vehicle_id, date, km INTEGER, source TEXT CHECK in ('service','manual'), service_id INTEGER REFERENCES services ON DELETE CASCADE)`
  - Indexes on `vehicles(user_id)`, and on `(vehicle_id, date)` for both `services` and `odometer_readings`.

- [ ] **Step 1:** `npm init -y`. Install `hono` as a dependency. Install `wrangler typescript vitest @cloudflare/vitest-pool-workers @cloudflare/workers-types` as dev dependencies.
- [ ] **Step 2:** Write `test/schema.test.ts`, with two tests:
  - `it('creates all phase-1 tables')`: query `sqlite_master` and expect exactly `users, scan_usage, vehicles, service_items, services, service_lines, odometer_readings`, ignoring `d1_migrations`/`_cf_%`.
  - `it('GET /healthz returns ok')`: `await app.request('/healthz', {}, testEnv())` returns status 200 with text `ok`.
- [ ] **Step 3:** Run `npx vitest run test/schema.test.ts`. Expect FAIL.
- [ ] **Step 4:** Write the config files, the migration, `env.ts`, and `index.tsx` with an unauthenticated `/healthz`.
- [ ] **Step 5:** Run `npx vitest run`. Expect PASS. Then run `npx tsc --noEmit`, which should be clean.
- [ ] **Step 6:** Commit with `git commit -m "Scaffold worker, D1 schema and test harness"`.

---

### Task 2: Users, sessions and Google sign-in

**Files:**
- Create: `src/auth.ts`, `src/views/Layout.tsx`, `src/views/Login.tsx`, `test/auth.test.ts`
- Modify: `src/index.tsx`, to mount auth routes and the guard middleware

**Interfaces:**
- Produces:
  - `signSession(userId: number, secret: string, now?: number): Promise<string>`. The value is `base64url(userId|expiresMs).base64url(HMAC-SHA256)`, and it expires after 30 days.
  - `verifySession(cookie: string | undefined, secret: string, now?: number): Promise<number | null>`, which returns the userId or null.
  - `fetchGoogleEmail(code: string, verifier: string, redirectUri: string, env: Env, fetchFn?: typeof fetch): Promise<{ sub: string; email: string; verified: boolean }>`. It POSTs to `https://oauth2.googleapis.com/token`, then GETs `https://openidconnect.googleapis.com/v1/userinfo`.
  - `upsertUser(db: D1Database, sub: string, email: string): Promise<number>`. It inserts or updates the email by `google_sub` and returns the user id.
  - `authRoutes(fetchFn?: typeof fetch): Hono<{Bindings: Env}>`, which serves `GET /login`, `GET /auth/google`, `GET /auth/google/callback`, and `POST /logout`.
  - `requireAuth`: Hono middleware. A missing or invalid session sends `302 /login`. On success it sets `c.var.userId` (number).
  - `Layout({ title, children })`: the HTML shell, with links to `/app.css` and `/manifest.webmanifest`, the apple-touch-icon, the meta viewport, and `apple-mobile-web-app-capable`.
  - In `test/helpers.ts`:
    - `makeUser(email?: string): Promise<number>`, which inserts a user with a random `google_sub`.
    - `authed(path, init?, userId?)`, which calls `app.request` with a valid session cookie. If no `userId` is given, it creates a user.

**Cookie names:**
- `kereta_session`: HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 days.
- `kereta_oauth`: holds `state` and the PKCE verifier, Max-Age 600.

The redirect URI comes from the request origin + `/auth/google/callback`. Scope is `openid email`. PKCE uses S256.

- [ ] **Step 1:** Write `test/auth.test.ts`:
  - `signSession`/`verifySession`: a round trip returns the email; a tampered payload returns null; an expired cookie (`now` past 30 days) returns null; a different secret returns null.
  - `upsertUser` called twice with the same `sub` returns the same id, and the second call updates the email.
  - `GET /` with no cookie returns 302 to `/login`. `GET /` with a forged cookie returns 302 to `/login`.
  - `GET /auth/google` returns 302. Its Location starts with `https://accounts.google.com/o/oauth2/v2/auth` and contains `code_challenge_method=S256`, and the response sets `kereta_oauth`.
  - Callback with a `state` that doesn't match the cookie returns 400, with no session cookie set.
  - Callback with a mocked `fetchFn` where `email_verified: false` returns 403 "Not authorised", with no session cookie and no `users` row.
  - Callback with a mocked verified, never-seen email returns 302 to `/`, sets `kereta_session`, and creates 1 `users` row. A second sign-in with the same `sub` still leaves 1 row.
  - `POST /logout` clears `kereta_session`.
- [ ] **Step 2:** Run `npx vitest run test/auth.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `src/auth.ts`, `Layout`, and `Login` (a single "Sign in with Google" button). Wire `requireAuth` onto everything except `/login`, `/auth/*`, `/healthz`, and static assets. Use WebCrypto `crypto.subtle` HMAC and a timing-safe comparison.
- [ ] **Step 4:** Run `npx vitest run`. Expect PASS.
- [ ] **Step 5:** Commit with `git commit -m "Add Google sign-in and signed sessions"`.

---

### Task 3: Dates, money, templates, vehicles CRUD

**Files:**
- Create: `src/lib/dates.ts`, `src/lib/money.ts`, `src/lib/templates.ts`, `src/db.ts` (vehicles and items section), `src/routes/vehicles.tsx`, `src/views/VehicleForm.tsx`, `test/lib.test.ts`, `test/vehicles.test.ts`

**Interfaces:**
- Produces:
  - `todayKL(now?: Date): string`
  - `addMonths(iso: string, n: number): string`, which clamps to the end of the month.
  - `daysBetween(a: string, b: string): number`, which is `b - a`.
  - `fmtDate(iso: string): string`, giving `DD/MM/YYYY`.
  - `parseRM(input: string): number | null`, returning sen. It accepts `"RM 1,234.5"`, `"85"`, and `"85.00"`. Bad input or negatives give null.
  - `fmtRM(sen: number): string`, giving `"RM 1,234.50"`.
  - `type TemplateItem = { name: string; interval_km: number | null; interval_months: number | null }`
  - `CAR_TEMPLATE`, `MOTORBIKE_TEMPLATE`: arrays of `TemplateItem` with exactly the spec's values (see the table below).
  - In `db.ts`:
    - `interface Vehicle`, `interface ServiceItem`, matching the columns.
    - `createVehicle(db, userId, v: Omit<Vehicle,'id'|'archived'|'user_id'>): Promise<number>`, which inserts the vehicle and seeds the template items with `sort` = index, in a single `db.batch`.
    - `getVehicle(db, userId, id): Promise<Vehicle | null>`, which returns null when the vehicle isn't the user's.
    - `listVehicles(db, userId)` (non-archived, ordered by name), `updateVehicle(db, userId, id, v)`, `archiveVehicle(db, userId, id)`.
    - `listItems(db, vehicleId)`, `saveItems(db, vehicleId, items: Array<Partial<ServiceItem> & {name:string}>)`. Callers check ownership with `getVehicle` first. `saveItems` ignores item ids that don't belong to that vehicle. `saveItems` upserts by id, inserts rows without an id, and deletes rows that were removed.
  - Routes:
    - `GET /vehicles/new` and `POST /vehicles`, which redirects to `/vehicles/:id/edit`.
    - `GET /vehicles/:id/edit` and `POST /vehicles/:id`, which saves details and the schedule table, including baseline date and km.
    - `POST /vehicles/:id/archive`.

**Templates** (name, km, months):

| Car | km | months |
|---|---|---|
| Engine oil | 10000 | 6 |
| Oil filter | 10000 | 6 |
| Air filter | 20000 | 12 |
| Cabin filter | 20000 | 12 |
| ATF/CVT fluid | 40000 | 24 |
| Spark plugs | 40000 | 24 |
| Brake fluid | null | 24 |
| Coolant | 40000 | 24 |

| Motorbike | km | months |
|---|---|---|
| Engine oil | 3000 | 3 |
| Oil filter | 6000 | 6 |
| Spark plug | 10000 | 12 |
| Drive chain/belt | 1000 | 1 |
| Brake fluid | null | 24 |

- [ ] **Step 1:** Write `test/lib.test.ts`:
  - `addMonths('2026-08-31', 6)` gives `'2027-02-28'`, and `addMonths('2027-08-31', 6)` gives `'2028-02-29'`.
  - `addMonths('2026-01-15', 1)` gives `'2026-02-15'`.
  - `todayKL(new Date('2026-10-18T17:30:00Z'))` gives `'2026-10-19'`.
  - `fmtDate('2026-03-05')` gives `'05/03/2026'`.
  - `parseRM('RM 1,234.5')` gives `123450`, `parseRM('abc')` gives null, and `parseRM('-5')` gives null.
  - `fmtRM(123450)` gives `'RM 1,234.50'`.
- [ ] **Step 2:** Write `test/vehicles.test.ts`:
  - Creating a car seeds 8 items in template order. Creating a motorbike seeds 5.
  - `POST /vehicles` (authed, form data) redirects to `/vehicles/:id/edit`.
  - `POST /vehicles/:id` with an edited interval, a new item, and a removed item persists all three changes.
  - Setting a baseline (`baseline_date=2026-01-10`, `baseline_km=50000`) persists it.
  - An unauthenticated `POST /vehicles` returns 302 to `/login`.
  - User B: `GET /vehicles/<A's id>/edit` returns 404. `POST /vehicles/<A's id>` returns 404, and A's vehicle is unchanged. `listVehicles(db, B)` doesn't include A's vehicle.
- [ ] **Step 3:** Run `npx vitest run test/lib.test.ts test/vehicles.test.ts`. Expect FAIL.
- [ ] **Step 4:** Implement the code. The vehicle form is mobile-first, and the schedule table has inline inputs plus "Add item" (JS clones a row; without JS there is one blank row).
- [ ] **Step 5:** Run `npx vitest run`. Expect PASS.
- [ ] **Step 6:** Commit with `git commit -m "Add vehicles, schedule templates, date and money helpers"`.

---

### Task 4: Due-date logic (pure)

**Files:**
- Create: `src/lib/due.ts`, `test/due.test.ts`

**Interfaces:**
- Consumes: `addMonths` and `daysBetween` from Task 3.
- Produces:
  - `type Reading = { date: string; km: number }`
  - `estimateKm(readings: Reading[], today: string): number | null`
    - Use readings from the last 365 days, plus the latest reading before that window as an anchor if one exists.
    - With fewer than 2 readings, or a zero-day span, return the latest km, or null if there are no readings at all.
    - Otherwise compute `rate = (lastKm - firstKm) / days(first,last)` and return `Math.round(lastKm + rate * days(last, today))`.
  - `type ItemDue = { itemId: number; name: string; status: 'overdue'|'soon'|'ok'|'unknown'; dueDate: string | null; dueKm: number | null; kmLeft: number | null; daysLeft: number | null; lastDate: string | null; lastKm: number | null }`
  - `itemDue(item: {id:number; name:string; interval_km:number|null; interval_months:number|null; baseline_date:string|null; baseline_km:number|null}, lastDone: {date:string; km:number} | null, estKm: number | null, vehicleType: 'car'|'motorbike', today: string): ItemDue`
    - The "last" point is `lastDone`. If that's missing, use the baseline (date and/or km, either may be null). If there's neither, the status is `unknown`.
    - `dueKm = lastKm + interval_km` when both exist. `dueDate = addMonths(lastDate, interval_months)` when both exist.
    - `kmLeft = dueKm - estKm` when both exist. `daysLeft = daysBetween(today, dueDate)`.
    - Status is `overdue` if kmLeft ≤ 0 or daysLeft < 0. It's `soon` if kmLeft ≤ 1000 (car) or ≤ 300 (motorbike), or daysLeft ≤ 14. Otherwise it's `ok`.
  - `expiryStatus(expiry: string | null, today: string): { status: 'overdue'|'soon'|'ok'|'unset'; daysLeft: number | null }`. With `daysLeft = daysBetween(today, expiry)`: `daysLeft <= 0` is overdue (the spec says "on and after expiry"), `<= 30` is soon, and anything else is ok.
  - `odometerStale(readings: Reading[], today: string): boolean`, true when the latest reading is more than 30 days old.
  - `sortByUrgency(items: ItemDue[]): ItemDue[]`. Order is overdue, then soon, then unknown, then ok. Within a group, sort by `daysLeft` ascending (nulls last), then by `kmLeft` ascending.

- [ ] **Step 1:** Write `test/due.test.ts` (today = `'2026-10-18'` unless stated):
  - Km reached first: car, last `{2026-06-01, 50000}`, oil 10000/6, estKm 59500. Expect `dueKm` 60000, `kmLeft` 500, status `soon`, `dueDate` `'2026-12-01'`.
  - Date reached first: last `{2026-04-01, 50000}`, estKm 52000. Expect `dueDate` `'2026-10-01'`, `daysLeft` -17, status `overdue`.
  - Motorbike threshold: kmLeft 400 is `ok` (when daysLeft > 14), and kmLeft 300 is `soon`.
  - Brake fluid (`interval_km` null, 24 months): only date-based, and `dueKm` is null.
  - Baseline used when there's no lastDone: `baseline_date` `'2025-11-01'`, `baseline_km` null, oil 10000/6. Expect `dueDate` `'2026-05-01'` and `overdue`.
  - Neither lastDone nor baseline gives `unknown`.
  - Month-end: lastDone `{2026-08-31, ...}` with 6 months gives `dueDate` `'2027-02-28'`.
  - `estimateKm`: `[{2026-01-01,40000},{2026-07-01,49050}]` on `2026-10-18` (181 days, 50 km/day, 109 more days) gives `54500`. A single reading gives its km. No readings gives null.
  - `expiryStatus`: `'2026-11-17'` is soon/30. `'2026-11-18'` is ok/31. `'2026-10-18'` is overdue/0. `null` is unset.
  - `odometerStale`: latest `'2026-09-18'` gives false (exactly 30 days); `'2026-09-17'` gives true.
- [ ] **Step 2:** Run `npx vitest run test/due.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `src/lib/due.ts` with no I/O.
- [ ] **Step 4:** Run `npx vitest run`. Expect PASS.
- [ ] **Step 5:** Commit with `git commit -m "Add due-date computation"`.

---

### Task 5: Services, odometer readings, history

**Files:**
- Modify: `src/db.ts` (services section)
- Create: `src/routes/services.tsx`, `src/views/ServiceForm.tsx`, `src/views/VehicleHistory.tsx`, `test/services.test.ts`

**Interfaces:**
- Consumes: `parseRM`, `fmtRM`, `fmtDate`, `listItems`, `getVehicle`.
- Produces (in `db.ts`):
  - `interface ServiceInput { vehicle_id: number; date: string; odometer_km: number; workshop: string | null; total_sen: number | null; notes: string | null; receipt_key: string | null; lines: Array<{ description: string; cost_sen: number | null; service_item_id: number | null }> }`
  - Ownership: every service function below takes `userId` as its second argument and scopes by the vehicle's `user_id`. `getService(db, userId, id)` returns null when the service isn't the user's. `createService` returns 404 at the route level if `getVehicle(db, userId, vehicle_id)` is null.
  - `checkOdometer(db, vehicleId, date, km, excludeServiceId?): Promise<string | null>`
    - Returns null when the reading is consistent.
    - Otherwise it returns the message `Odometer {km} km conflicts with {DD/MM/YYYY} reading of {km} km`.
    - A conflict is an earlier-dated reading with a higher km, or a later-dated reading with a lower km.
  - `createService(db, s: ServiceInput): Promise<number>`, which writes the service, its lines, and an odometer reading (`source='service'`, `service_id`) in one `db.batch`.
  - `updateService(db, id, s)`, which replaces the lines and updates the linked reading.
  - `deleteService(db, id): Promise<string | null>`, which deletes the service and returns its `receipt_key` for the caller to remove from R2. Cascades remove its lines and its reading.
  - `getService(db, id)`, returning the service with its lines.
  - `listServices(db, vehicleId)`, newest first by date then odometer.
  - `lastDoneByItem(db, vehicleId): Promise<Map<number, {date:string; km:number}>>`, giving the latest linked line per item.
  - `listReadings(db, vehicleId): Promise<Reading[]>`, ascending by date.
  - `addReading(db, vehicleId, date, km)`, with `source='manual'`.
  - `yearTotals(db, vehicleId): Promise<Array<{year:string; total_sen:number}>>`
- Routes:
  - `GET /services/new?vehicle=` and `POST /services`.
    - On success it redirects to `/vehicles/:id`.
    - With `action=save_add`, it redirects to `/services/new?vehicle=:id&workshop=<prefill>`.
    - An odometer conflict re-renders the form with status 422, the error message shown, and the input preserved.
  - `GET /services/:id`, `GET /services/:id/edit`, `POST /services/:id`, `POST /services/:id/delete`.
  - `GET /vehicles/:id`: history, year totals, an "Add odometer reading" form posting to `POST /vehicles/:id/readings`, and the Print link.
- `ServiceForm` props: `{ vehicle, items, values?: Partial<ServiceInput>, error?, receiptKey?, unreadFields?: string[] }`. Task 7 reuses it for the scan result.
  - Lines are repeatable rows of description, cost, and an item `<select>` with a "—" option.
  - If total is blank, it defaults to the sum of the line costs.

- [ ] **Step 1:** Write `test/services.test.ts`:
  - `createService` writes 1 service, N lines, and 1 reading with `source='service'`.
  - `lastDoneByItem` returns the latest dated linked line per item.
  - `checkOdometer`: with readings `{2026-01-01: 40000}` and `{2026-06-01: 49000}`:
    - `(2026-03-01, 45000)` gives null.
    - `(2026-03-01, 50000)` gives `'Odometer 50000 km conflicts with 01/06/2026 reading of 49000 km'`.
    - `(2026-07-01, 39000)` gives a conflict message.
  - `POST /services` with a conflicting odometer returns 422, the body contains the message, and no row is inserted.
  - `POST /services` with `action=save_add` redirects to `/services/new?vehicle=…&workshop=…`.
  - Backdated date `2019-05-01` is accepted.
  - `deleteService` removes the lines and reading and returns the `receipt_key`.
  - `GET /vehicles/:id` lists services newest first and shows `fmtRM` year totals.
  - User B: `GET`, `/edit`, `POST` and `/delete` on A's service each return 404, and A's data is unchanged. `POST /services` with `vehicle_id` set to A's vehicle returns 404 and inserts nothing. `POST /vehicles/<A's id>/readings` returns 404.
- [ ] **Step 2:** Run `npx vitest run test/services.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement. On delete, the route calls `deleteReceipt` from Task 7 once that exists; for now it ignores the returned key and Task 7 wires it in.
- [ ] **Step 4:** Run `npx vitest run`. Expect PASS.
- [ ] **Step 5:** Commit with `git commit -m "Add service logging, odometer readings and history"`.

---

### Task 6: Dashboard

**Files:**
- Create: `src/routes/dashboard.tsx`, `src/views/Dashboard.tsx`, `public/app.css`, `test/dashboard.test.ts`

**Interfaces:**
- Consumes: `listVehicles`, `listItems`, `lastDoneByItem`, `listReadings`, `estimateKm`, `itemDue`, `sortByUrgency`, `expiryStatus`, `odometerStale`, `todayKL`.
- Produces: `GET /`. With no vehicles it shows an empty state linking to `/vehicles/new`.
  - Each vehicle gets a card showing: name and plate; the estimated km ("~54,500 km"); the top 3 urgent items with a status colour and "in 500 km / 12 days" or "overdue by …"; road tax and insurance chips; and an "Update odometer" link when stale.
  - "Unknown" items link to the edit page anchor so the user can set a baseline.
  - A fixed **Scan receipt** button goes to `/scan`.
- Status colours are CSS classes `.s-overdue`, `.s-soon`, `.s-ok`, `.s-unknown`. The visual style is the builder's call: mobile-first and restrained.

- [ ] **Step 1:** Write `test/dashboard.test.ts`, seeding through `db.ts`:
  - With no vehicles, the body contains a link to `/vehicles/new`.
  - A car with oil last done `{2026-04-01, 50000}` and an injected today of `2026-10-18` renders `s-overdue` next to "Engine oil".
  - Road tax `2026-11-01` renders a `s-soon` chip with "14 days".
  - Readings 40 days old render an "Update odometer" link.
  - User B's dashboard doesn't contain user A's vehicle name.

  The route reads today via `c.get('today') ?? todayKL()`. Tests set it with a small test-only middleware in `helpers.ts`.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run`. Expect PASS.
- [ ] **Step 5:** Commit with `git commit -m "Add dashboard with due status"`.

---

### Task 7: R2 receipts and AI scan

**Files:**
- Create: `src/receipts.ts`, `src/scan.ts`, `src/lib/matchItems.ts`, `src/views/ScanPage.tsx`, `public/app.js`, `test/scan.test.ts`, `test/receipts.test.ts`
- Modify: `src/routes/services.tsx` (delete removes the R2 object; the form shows the receipt image), `src/index.tsx`

**Interfaces:**
- Produces:
  - `putReceipt(bucket: R2Bucket, userId: number, body: ArrayBuffer, contentType: string): Promise<string>`, which returns key `receipts/<userId>/<uuid>.jpg`.
  - `takeScan(db, userId: number, today: string, perUser: number, global: number): Promise<boolean>`.
    - It returns false if `SUM(count)` for `today` across all users is ≥ `global`.
    - Otherwise it runs `INSERT … ON CONFLICT(user_id,date) DO UPDATE SET count = count + 1 WHERE count < perUser` and returns `meta.changes === 1`.
    - A scan counts when it's attempted, even if the AI then fails. This is Claude's call, to bound cost.
  - `deleteReceipt(bucket, key: string | null): Promise<void>`
  - `cleanupOrphans(bucket, db, now?: number): Promise<number>`. It lists the `receipts/` prefix, and deletes objects whose `uploaded` time is more than 24 h old and whose key isn't in `services.receipt_key`. It returns the count deleted.
  - Route `GET /receipts/:userId/:name`: authed. A `userId` that isn't the session user returns 404. It streams the object with its stored content type and `Cache-Control: private, max-age=86400`. Unknown keys give 404.
  - `type ScanResult = { date: string|null; odometer_km: number|null; workshop: string|null; total_sen: number|null; lines: Array<{description:string; cost_sen:number|null}> }`
  - `parseScanResponse(raw: string): ScanResult | null`
    - It strips markdown fences and parses JSON.
    - It coerces numbers and RM strings via `parseRM`.
    - It nulls an invalid date or a date in the future.
    - It returns null when the result isn't usable JSON.
  - `scanReceipt(imageB64: string, env: Env, fetchFn?: typeof fetch): Promise<ScanResult | null>`
    - It POSTs to `https://openrouter.ai/api/v1/chat/completions` with `model: env.SCAN_MODEL`, an image as a `data:image/jpeg;base64,…` URL, and `response_format` `json_schema` matching `ScanResult` (money in RM as numbers; the parser converts to sen).
    - It uses a 25 s `AbortSignal.timeout`.
    - On any error it returns null and never throws.
  - `suggestItem(description: string, items: ServiceItem[]): number | null`. It matches case-insensitively on keywords:

    | Keywords | Item |
    |---|---|
    | `minyak hitam`, `engine oil`, `oil change`, `fully synthetic`, `semi synthetic` | Engine oil |
    | `oil filter`, `penapis minyak` | Oil filter |
    | `air filter`, `penapis udara` | Air filter |
    | `cabin`, `aircond filter` | Cabin filter |
    | `atf`, `cvt`, `gear oil`, `minyak gear` | ATF/CVT fluid |
    | `spark plug`, `plug` | Spark plug(s) |
    | `brake fluid`, `minyak brek` | Brake fluid |
    | `coolant`, `radiator` | Coolant |
    | `chain`, `rantai`, `belt` | Drive chain/belt |

    "Oil filter" is checked before "Engine oil", so the more specific match wins. It matches the item whose name starts with the target. With no match it returns null.
  - Routes:
    - `GET /scan?vehicle=` shows a vehicle picker, if there's more than one vehicle, plus a file input `accept="image/*" capture="environment"`.
    - `POST /api/scan` takes a multipart `photo` plus `vehicle`.
      - A vehicle that isn't the user's gives 404.
      - If `takeScan` returns false, it gives 429 with the page "Daily scan limit reached — you can still log manually" and a link to `/services/new?vehicle=`. Nothing goes to R2 and OpenRouter isn't called. Check size and type before `takeScan`, so rejected uploads don't use up a scan.
      - `GET /scan` shows "N scans left today".
      - A file over 2 MB gives 413 "Photo too large". A type outside `image/jpeg|png|webp` gives 415 "Unsupported image". Nothing is stored in either case.
      - Otherwise it puts the photo in R2, calls `ctx.waitUntil(cleanupOrphans(...))`, and runs `scanReceipt`.
      - It renders `ServiceForm` prefilled, with `receiptKey`, suggested `service_item_id`s, and `unreadFields` listing every null field.
      - On a null result it renders the form empty, with `receiptKey` and the banner "Couldn't read receipt — fill in manually".
- `public/app.js`:
  - It compresses the chosen image client-side: canvas resize to a 1600 px long edge, JPEG quality 0.8, stepping down to 0.6 if the result is over 500 KB.
  - It replaces the file in a `FormData` and submits to `/api/scan`, showing "Reading receipt…".
  - It also handles "Add line" row cloning for the forms.

- [ ] **Step 1:** Write `test/scan.test.ts`:
  - `parseScanResponse` on fenced JSON `{"date":"2026-09-02","odometer_km":"52,310","workshop":"Bengkel Ah Seng","total":"RM 245.00","lines":[{"description":"Minyak hitam 4L","cost":180}]}` gives `odometer_km` 52310, `total_sen` 24500, and line `cost_sen` 18000.
  - A future date gives `date` null. `'not json'` gives null.
  - `scanReceipt` with a `fetchFn` that throws gives null. With a `fetchFn` returning HTTP 500 it gives null.
  - `suggestItem('Penapis minyak', carItems)` gives the Oil filter id. `suggestItem('Fully synthetic 5W-30', carItems)` gives the Engine oil id. `suggestItem('Wiper blade', carItems)` gives null.
  - `POST /api/scan` with a mocked scan returning null gives 200, a body with "Couldn't read receipt", and one R2 object stored.
  - `POST /api/scan` with a 3 MB body gives 413, with zero R2 objects. With `text/plain` it gives 415.
  - `POST /api/scan` with a mocked result prefills the odometer input with `52310` and marks `workshop` unread when it's null.
  - `takeScan` returns true 20 times, then false on the 21st for the same user and day. It's true again the next day, and true for a different user.
  - With `global` = 2, a third scan by any user is false.
  - The 21st `POST /api/scan` gives 429, the body contains "Daily scan limit reached", there's no new R2 object, and the mocked fetch isn't called.

  `/api/scan` gets its `fetchFn` from an injectable factory, the same pattern as `authRoutes`.
- [ ] **Step 2:** Write `test/receipts.test.ts`:
  - `putReceipt` then `GET /receipts/<userId>/<name>` as that user gives 200 with matching bytes. Unauthed it gives 302 to `/login`. As user B it gives 404.
  - `POST /services/:id/delete` removes the service and its R2 object.
  - `cleanupOrphans` with `now` = 25 h later deletes an unreferenced object and keeps a referenced one.
- [ ] **Step 3:** Run `npx vitest run test/scan.test.ts test/receipts.test.ts`. Expect FAIL.
- [ ] **Step 4:** Implement it all, and wire `deleteReceipt` into service delete.
- [ ] **Step 5:** Run `npx vitest run`. Expect PASS.
- [ ] **Step 6:** Manual check with a real key: `cp .dev.vars.example .dev.vars`, fill it in, run `npx wrangler dev`, and scan one real workshop receipt photo. The fields should prefill and the image should show beside the form.
- [ ] **Step 7:** Commit with `git commit -m "Add R2 receipt storage and AI receipt scan"`.

---

### Task 8: Print view, privacy page, PWA manifest

**Files:**
- Create: `src/routes/print.tsx`, `src/views/PrintHistory.tsx`, `src/views/Privacy.tsx`, `public/print.css`, `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `test/print.test.ts`

**Interfaces:**
- Consumes: `getVehicle`, `listServices`, `getService` lines, `yearTotals`, `fmtRM`, `fmtDate`.
- Produces: `GET /vehicles/:id/print`.
  - It shows the vehicle header (name, plate, make/model/year, and "Generated DD/MM/YYYY").
  - Each service lists date, odometer, workshop, line items with costs, and total, followed by the grand total.
  - A "Print / Save as PDF" button calls `window.print()` and is hidden in print media.
  - It does **not** show baselines.
- `GET /privacy`: public, no auth needed. A plain-English policy covering:
  - What's stored: the Google email, vehicles, services and receipt photos.
  - That receipt photos are sent to OpenRouter to be read.
  - That nothing is sold or shared.
  - How to ask for deletion: email the contact address in the `CONTACT_EMAIL` var.
  - Link to it from the login page footer.
- Manifest: `name` "Kereta", `display: standalone`, `start_url: /`, the icons, and `theme_color`. Icons are simple generated PNGs (the design is the builder's call).

- [ ] **Step 1:** Write `test/print.test.ts`:
  - The page contains each service's workshop and line descriptions, plus the grand total in `fmtRM`.
  - A vehicle with a baseline set (`baseline_date 2025-11-01`) renders no `01/11/2025` text.
  - User B's `GET /vehicles/<A's id>/print` returns 404.
  - `GET /privacy` without a cookie returns 200 and contains "OpenRouter".
  - `GET /manifest.webmanifest` is served (via ASSETS) with JSON whose `display` is `standalone`.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run`. Expect PASS. Then `npx tsc --noEmit`, which should be clean.
- [ ] **Step 5:** Commit with `git commit -m "Add printable history and PWA manifest"`.

---

### Task 9: Local walkthrough and deploy (with the user)

- [ ] **Step 1:** `npx wrangler d1 migrations apply kereta --local`, then `npx wrangler dev`. Walk through the spec's verification list in the browser: sign in, add a car and a motorbike, set baselines, backdate a manual service, scan a real receipt, check the dashboard, and save the print view as a PDF.
- [ ] **Step 2 (user):** create a Google OAuth web client with redirect URIs `http://localhost:8787/auth/google/callback` and, after the first deploy, `https://kereta.<subdomain>.workers.dev/auth/google/callback`. Put the consent screen in Testing mode with the user's own account as a test user. Also run `! npx wrangler login`.
- [ ] **Step 3:**
  - `npx wrangler d1 create kereta`, then put the `database_id` into `wrangler.jsonc`.
  - `npx wrangler r2 bucket create kereta-receipts`. R2 requires a card on file in the Cloudflare account.
  - `npx wrangler d1 migrations apply kereta --remote`.
- [ ] **Step 4:** Run `npx wrangler secret put` for each of the 4 secrets, then `npx wrangler deploy`. Then:
  - `curl https://kereta.<subdomain>.workers.dev/healthz` should return `ok`.
  - Unauthenticated `/` should return 302 to `/login`.
- [ ] **Step 5 (user):** in Google Cloud, set the consent screen's homepage to `https://kereta.<subdomain>.workers.dev/` and its privacy URL to `/privacy`, then **Publish app** so anyone can sign in. With only the `openid email` scopes, no security review is needed.
- [ ] **Step 6 (user):** on the iPhone, sign in, use Share → Add to Home Screen, and scan one receipt end to end.
- [ ] **Step 7:** Commit the `wrangler.jsonc` database id with `git commit -m "Configure production D1 id"`.

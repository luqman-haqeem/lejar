# Rename Kereta to Lejar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users see "Lejar" and the new stamp icon everywhere, and the worker deploys as `lejar`, without touching stored data.

**Architecture:** A name swap across the Hono JSX views, the auth cookies, the client preference keys, the static manifest and icons, the worker config, the go-live script and the product docs. The D1 database (`kereta`), the R2 bucket (`kereta-receipts`) and the bindings (`DB`, `RECEIPTS`) stay as they are. The live cutover is a human checklist ticket.

**Tech Stack:** Cloudflare Workers, Hono JSX, vitest with `@cloudflare/vitest-pool-workers`, wrangler.

**Spec:** `docs/superpowers/specs/2026-11-20-rename-to-lejar-design.md`

## Global Constraints

- The product name is exactly `Lejar` (capital L, rest lower case) in copy and manifest. Identifiers are lower case: `lejar_session`, `lejar_oauth`, `lejar-theme`, `lejar-text-size`, `window.lejarScheme`, worker `lejar`.
- `database_name` stays `kereta`, `bucket_name` stays `kereta-receipts`, and the bindings `DB` and `RECEIPTS` don't change. `deploy.yml`'s `d1 migrations apply kereta` stays.
- Historical files stay as written: `docs/superpowers/specs/2026-10-18-kereta-*`, `docs/superpowers/plans/2026-10-18-kereta-*`, `.scratch/kereta-phase1/`.
- Test request hosts such as `https://kereta.test` are fixtures, not product copy. Leave them.
- Commits are one-line messages with no Co-Authored-By trailer (CLAUDE.md).
- Icon sources are in `.superpowers/names/final-lejar/` (git-ignored). Copy them into the repo; don't regenerate them.

## Review Focus

- **A leftover "Kereta" anywhere a user can see it**, such as a page title suffix, the privacy text, the mail subject or the Home Screen label. Expected: none. Task 1 adds a test that no public page or signed-in page contains `Kereta`.
- **A browser sending only the old `kereta_session` cookie** (for example, local dev before a re-login). Expected: treated as signed out and sent to `/login`, not a crash. Task 1 adds a test.
- **Android cropping the icon to a circle.** Expected: a separate `purpose: "maskable"` icon with the stamp scaled to fit, and no `"any maskable"` on the full-bleed icon. Task 2 asserts this.
- **Dark-mode browser tab.** Expected: a dark favicon picked by `prefers-color-scheme`. Task 2 asserts both `<link rel="icon">` tags and their media queries.
- **Deploying under the new name without secrets.** Expected: the cutover ticket lists every secret before the deploy step. Task 4 owns the checklist. No code test applies.

---

### Task 1: Name, cookies and preference keys in code

**Files:**
- Modify: `src/auth.tsx:10-11`, `src/views/Layout.tsx:10,54,63`, `src/views/Login.tsx:5,7`, `src/views/Privacy.tsx:12,15,20,59`, `public/app.js:147,159`, `public/manifest.webmanifest`
- Test: `test/public-pages.test.ts`, `test/auth.test.ts`, `test/dashboard.test.ts`, `test/dev-login.test.ts`

**Interfaces:**
- Produces: `SESSION_COOKIE = "lejar_session"`, `OAUTH_COOKIE = "lejar_oauth"` (exported from `src/auth.tsx`); `window.lejarScheme`; localStorage keys `lejar-theme` and `lejar-text-size`.

- [ ] **Step 1: Update the test expectations to the new names**

In `test/auth.test.ts`, `test/dashboard.test.ts` and `test/dev-login.test.ts`, replace every cookie name `kereta_session` with `lejar_session` and `kereta_oauth` with `lejar_oauth`. In `test/public-pages.test.ts`, expect `content="Lejar"` on the apple-mobile-web-app-title tag and `name: "Lejar"` in the manifest. Add these two tests to `test/public-pages.test.ts`:

```ts
it("never shows the old name", async () => {
  for (const html of [
    await (await app.request("/login", {}, env)).text(),
    await (await app.request("/privacy", {}, env)).text(),
    await (await app.request("/", { headers: await sessionHeaders(await makeUser()) }, env)).text(),
  ]) {
    expect(html).not.toMatch(/kereta/i);
    expect(html).toContain("Lejar");
  }
});

it("treats an old kereta_session cookie as signed out", async () => {
  const res = await app.request("/", { headers: { cookie: "kereta_session=anything" } }, env);
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/login");
});
```

The `/kereta/i` check also covers `keretaScheme` and the `kereta-theme` keys in the inline prefs script.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- test/public-pages.test.ts test/auth.test.ts test/dashboard.test.ts test/dev-login.test.ts`
Expected: FAIL on the cookie names, the title tag, the manifest name and "never shows the old name". The old-cookie test may already pass.

- [ ] **Step 3: Rename in source**

- `src/auth.tsx`: set the cookie constants to the values in Interfaces.
- `src/views/Layout.tsx`: in `PREFS_SCRIPT`, `kereta-theme` → `lejar-theme`, `kereta-text-size` → `lejar-text-size`, `window.keretaScheme` → `window.lejarScheme`. The title becomes `{title === "Lejar" ? title : `${title} · Lejar`}`, and `apple-mobile-web-app-title` becomes `Lejar`.
- `src/views/Login.tsx`: `title="Lejar"` and `<h1>Lejar</h1>`.
- `src/views/Privacy.tsx`: `← Lejar`, "Lejar is a personal vehicle service book…", "Lejar asks Google for nothing…", and mail subject `Lejar%20account%20deletion`.
- `public/app.js`: the same two keys and `window.lejarScheme?.()`.
- `public/manifest.webmanifest`: `"name": "Lejar"` and `"short_name": "Lejar"`.

- [ ] **Step 4: Run the full suite and the type check**

Run: `npm test && npm run typecheck`
Expected: all tests PASS, and tsc exits 0. `grep -rn -i kereta src public` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src public/app.js public/manifest.webmanifest test
git commit -m "Rename the app to Lejar in pages, manifest, cookies and preference keys"
```

### Task 2: Stamp icons and favicons

**Files:**
- Create: `public/icon-512-maskable.png`, `public/favicon-32.png`, `public/favicon-32-dark.png`, `design/icon/lejar-icon.svg`, `design/icon/lejar-icon-dark.svg`, `design/icon/lejar-favicon.svg`, `design/icon/README.md`
- Replace: `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`
- Modify: `public/manifest.webmanifest` (icons), `src/views/Layout.tsx:59` (favicon links)
- Test: `test/public-pages.test.ts`

**Interfaces:**
- Consumes: the manifest from Task 1.
- Produces: manifest `icons` = `[{src:"/icon-192.png",sizes:"192x192"}, {src:"/icon-512.png",sizes:"512x512"}, {src:"/icon-512-maskable.png",sizes:"512x512",purpose:"maskable"}]`, all `type: "image/png"`.

- [ ] **Step 1: Write the failing tests** in `test/public-pages.test.ts`

```ts
it("has a separate maskable icon", async () => {
  const manifest = (await (await env.ASSETS.fetch("https://kereta.test/manifest.webmanifest")).json()) as { icons: { src: string; purpose?: string }[] };
  expect(manifest.icons).toContainEqual(expect.objectContaining({ src: "/icon-512-maskable.png", purpose: "maskable" }));
  expect(manifest.icons.filter((i) => i.purpose?.includes("maskable"))).toHaveLength(1);
});

it("picks a light or dark favicon from the colour scheme", async () => {
  const html = await (await app.request("/login", {}, env)).text();
  expect(html).toContain('<link rel="icon" href="/favicon-32.png" type="image/png" media="(prefers-color-scheme: light)"');
  expect(html).toContain('<link rel="icon" href="/favicon-32-dark.png" type="image/png" media="(prefers-color-scheme: dark)"');
});
```

Extend the existing PNG loop's list with `"/favicon-32.png"` and `"/favicon-32-dark.png"`.

- [ ] **Step 2: Run and confirm they fail**

Run: `npm test -- test/public-pages.test.ts`
Expected: FAIL. There's no maskable entry, and the favicon links are missing.

- [ ] **Step 3: Copy the assets**

From `.superpowers/names/final-lejar/`:
- `apple-touch-icon-dark.png` → `public/apple-touch-icon.png`
- `icon-512-dark.png` → `public/icon-512.png`
- `icon-512-maskable-dark.png` → `public/icon-512-maskable.png`
- `favicon-32.png` → `public/favicon-32.png`
- `favicon-32-dark.png` → `public/favicon-32-dark.png`
- `lejar-icon.svg`, `lejar-icon-dark.svg` and `lejar-favicon.svg` → `design/icon/`

There's no dark 192 export. Render one at 192×192 from `final-lejar/lejar-icon-dark.html` with the same headless-Chromium command used for the others (window 192×192, transparent background) and save it to `public/icon-192.png`. `design/icon/README.md` says in two lines that the icons are rendered from these SVGs with Barlow 700 and Courier Prime 700 from `public/fonts/`, and that iOS gets the dark version.

- [ ] **Step 4: Wire them up**

Set the manifest `icons` to the Produces value. In `Layout.tsx`, replace the single `rel="icon"` link with the two links asserted in Step 1.

- [ ] **Step 5: Run the suite, then look at the icons**

Run: `npm test`
Expected: PASS. Then open `public/apple-touch-icon.png` and `public/icon-512-maskable.png` and check them by eye: the dark stamp reading LEJAR, and the maskable one with margin all round.

- [ ] **Step 6: Commit**

```bash
git add public design src/views/Layout.tsx test/public-pages.test.ts
git commit -m "Lejar stamp icons: dark iOS and web app icons, a maskable icon, light and dark favicons"
```

### Task 3: Worker name, go-live script and docs

**Files:**
- Modify: `wrangler.jsonc:3`, `scripts/go-live.sh:225,313-320`, `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, `GLOSSARY.md`, `docs/agents/issue-tracker.md`, `.impeccable/design.json`, `.impeccable/design-full.md`

**Interfaces:**
- Consumes: nothing from code.
- Produces: worker name `lejar`. The go-live script variable is renamed `KERETA_URL` → `APP_URL`.

- [ ] **Step 1: Worker and script**

- `wrangler.jsonc`: `"name": "lejar"` only.
- `go-live.sh`: the banner becomes `Lejar: go live on workers.dev`, the URL grep becomes `https://lejar\.[a-z0-9-]+\.workers\.dev`, the prompt example becomes `https://lejar.<subdomain>.workers.dev`, and `KERETA_URL` is renamed `APP_URL` throughout. Every `d1 … kereta` and `kereta-receipts` line stays.

- [ ] **Step 2: Docs**

Replace the product name Kereta → Lejar in `CLAUDE.md` (title; the spec line now lists both the original and the rename spec), `PRODUCT.md`, `DESIGN.md` (frontmatter `name:` and prose), `GLOSSARY.md` and `.impeccable/design.json` / `design-full.md`. These are hand-edited to mirror DESIGN.md, so only the name changes. In `docs/agents/issue-tracker.md`, add a `lejar-rename` entry beside `kereta-phase1` that points at the rename spec and `.scratch/lejar-rename/issues/`. Leave the `kereta-phase1` entry as it is.

- [ ] **Step 3: Verify**

Run: `bash -n scripts/go-live.sh && npm test && grep -rn -i kereta CLAUDE.md PRODUCT.md DESIGN.md GLOSSARY.md wrangler.jsonc scripts .impeccable/design.json .impeccable/design-full.md`
Expected: the syntax check is clean and tests PASS. The grep shows only the historical spec path in CLAUDE.md, the `database_name`/`bucket_name` lines in wrangler.jsonc, and the D1/R2 lines in go-live.sh.

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc scripts/go-live.sh CLAUDE.md PRODUCT.md DESIGN.md GLOSSARY.md docs/agents/issue-tracker.md .impeccable/design.json .impeccable/design-full.md
git commit -m "Worker, go-live script and docs renamed to Lejar; D1 and R2 names kept"
```

### Task 4: Cutover ticket

**Files:**
- Create: `.scratch/lejar-rename/issues/01-cutover.md`

- [ ] **Step 1: Write the ticket** in the same format as `.scratch/kereta-phase1/issues/10-go-live.md`, with `**Status:** ready-for-human`. What to build: the app runs at `lejar.<subdomain>.workers.dev` with all existing data. The boxes go in this order:
  1. If the app was never live, run `./scripts/go-live.sh` instead and tick everything else.
  2. Set secrets on the new worker with `npx wrangler secret put <NAME>`, one at a time: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `OPENROUTER_API_KEY`, `CONTACT_EMAIL`.
  3. Add `https://lejar.<subdomain>.workers.dev/auth/google/callback` to the Google OAuth client. Keep the kereta one for now.
  4. Push to master, or run `npx wrangler deploy`. `/healthz` returns `ok`.
  5. Sign in on the new address. Existing vehicles, services and receipt photos are there.
  6. Update the Google consent screen's homepage and privacy URLs to the new address, and rename the app there to Lejar.
  7. On the iPhone, add Lejar to the Home Screen (the dark stamp icon shows) and remove the old Kereta icon.
  8. Delete the `kereta` worker (`npx wrangler delete --name kereta`) and remove the old redirect URI.

- [ ] **Step 2: Commit**

```bash
git add .scratch/lejar-rename
git commit -m "Cutover ticket for moving the live app to the lejar worker"
```

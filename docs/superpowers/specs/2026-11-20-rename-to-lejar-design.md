# Rename Kereta to Lejar

## Intent
"Kereta" just means "car": generic, hard to own, and it leaves out motorbikes. The user wants a name with a maintenance and record-keeping feel. After rounds of options (Jaga, Pomen, Rekodrive, Jagarage, Lejar blends), the user chose **Lejar** (Malay for "ledger", the book where every entry is kept). It fits the app's existing "stamped service book" look.

**Rejected on the way:** Pomen is an existing Malaysian car-maintenance app (2018, App Store and Play, MARii partner), so it is a clear name conflict. Rekodo is too close to Rekods and Rekode, and Servisbuk too close to several ServiceBook apps. A quick web search found no app or company called Lejar. That was not a trademark search; the user should check MyIPO (classes 9 and 37) before relying on the name.

## Goals
- Every place a user sees the name says **Lejar**: page titles, sign-in page, privacy page, Home Screen label, web app manifest.
- The new **stamp icon** ships: the iPhone Home Screen icon, the web app icons and the favicon.
- The web address becomes `lejar.<subdomain>.workers.dev`.
- The docs that describe the product today (CLAUDE.md, PRODUCT.md, DESIGN.md, GLOSSARY.md, docs/agents) say Lejar.

## Non-goals
- No change to features, layout, colours or the design system beyond the name and icon.
- No custom domain.
- Old specs and plans (`2026-10-18-kereta-*`) stay as written; they are history.
- The repo folder `~/kereta` and any GitHub repo name are left for the user to rename if they want.

## Anti-goals
- Losing any user's vehicles, services or receipt photos.
- A broken Google sign-in after the switch.
- The old name and the new icon (or the reverse) showing together.

## Constraints
- Users are likely already on the app: `wrangler.jsonc` has a real D1 `database_id`, and CI deploys `master` on push. Claude couldn't confirm it from here, so the design assumes the app is live.
- An iPhone Home Screen web app gets one icon only; it can't switch between a light and a dark icon.
- Cloudflare treats a worker with a new name as a **new worker**. Secrets don't carry over, and the old worker keeps running until it's deleted.
- Google sign-in only accepts redirect addresses registered in Google Cloud Console.

## Approaches
1. **Rename everything**, including the D1 database and the R2 bucket. Nothing called "kereta" remains. On a live app this means copying data to a new database and bucket. That's the most risk for a name no user ever sees.
2. **Rename what people see, plus the web address (chosen).** The stored-data names stay. Moving to a new address resets sessions and saved preferences anyway, since browsers keep them per site, so the cookie and preference key names can be renamed at no extra cost.
3. **Rename only the screens.** The address stays `kereta.…workers.dev`, so the old name stays in every link people share.

The user said "proceed with rename" after these were laid out. Claude picked 2 because the evidence says the app is live.

## Design
**Code and assets**
- `wrangler.jsonc`: `"name": "lejar"`. `database_name` stays `kereta`, `bucket_name` stays `kereta-receipts`, and the bindings (`DB`, `RECEIPTS`) don't change.
- Visible text in `src/views/Login.tsx`, `src/views/Privacy.tsx` (including the account-deletion mail subject) and `src/views/Layout.tsx` (`<title>` suffix, `apple-mobile-web-app-title`): Kereta → Lejar.
- `public/manifest.webmanifest`: `name` and `short_name` become `Lejar`. Description unchanged.
- Cookies in `src/auth.tsx`: `kereta_session` → `lejar_session`, `kereta_oauth` → `lejar_oauth`.
- Preferences: `kereta-theme` → `lejar-theme`, `kereta-text-size` → `lejar-text-size`, `window.keretaScheme` → `window.lejarScheme`, in `Layout.tsx` and `public/app.js`.
- **Icons** (sources in `.superpowers/names/final-lejar/`):
  - `public/apple-touch-icon.png`: the **dark** stamp icon. The user approved the dark version after asking for a dark iOS icon.
  - `public/icon-192.png` and `public/icon-512.png`: the dark icon. Add `icon-512-maskable.png` (dark, with the stamp scaled to 78%) as a separate `"purpose": "maskable"` entry, and drop `"any maskable"` from the 512 entry.
  - Favicon: the light and dark stamped-"L" PNGs, chosen with `media="(prefers-color-scheme: …)"` on two `<link rel="icon">` tags.
  - Commit the SVG sources under `design/icon/` so the icon can be edited later.
- Tests that assert on the old cookie names, titles or text are updated to match.

**Scripts and CI**
- `scripts/go-live.sh`: the banner and the workers.dev URL pattern (`https://lejar\.…`) change. The D1 and R2 names stay `kereta`.
- `.github/workflows/deploy.yml`: `d1 migrations apply kereta` stays, since that's the database name.

**Docs**
- CLAUDE.md, PRODUCT.md, DESIGN.md (`name:` and prose), GLOSSARY.md and docs/agents/issue-tracker.md: Kereta → Lejar where it names the product. The `.scratch/kereta-phase1/` folder keeps its name, since it's history.
- `.impeccable/design.json` and `design-full.md` are regenerated from DESIGN.md, not hand-edited.

**Cutover (the user does these; they get a checklist or wizard)**
1. Set secrets on the new `lejar` worker: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENROUTER_API_KEY`, `SESSION_SECRET`, and `CONTACT_EMAIL` if it's a secret.
2. In Google Cloud Console, add `https://lejar.<subdomain>.workers.dev/auth/google/callback` as a redirect URI. Keep the old one until the switch is done.
3. Deploy, sign in on the new address, and check that existing vehicles and receipt photos show up.
4. Re-add Lejar to the iPhone Home Screen, then remove the old Kereta icon.
5. Delete the old `kereta` worker and the old redirect URI.

## Left to the builder
- Exact test updates, and whether the cutover checklist is a markdown issue under `.scratch/` or an interactive wizard.
- Copy wording beyond the name swap stays as it is unless a sentence reads wrong with the new name.

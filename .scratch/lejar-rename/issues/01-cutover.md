# 01: Move the live app from Kereta to Lejar

**What to build:** The app runs at `lejar.<subdomain>.workers.dev` with all its existing data, and the old `kereta` worker is gone.

**Blocked by:** the rename branch merged into master.

**Status:** resolved

Run `./scripts/rename-cutover.sh` from a terminal. It walks through every box below in order, reusing the values `go-live.sh` saved in `.dev.vars`.

- [x] Not needed: the app was live, so the cutover wizard ran instead of `./scripts/go-live.sh`.
- [x] Secrets set on the new `lejar` worker: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `OPENROUTER_API_KEY`, `CONTACT_EMAIL`.
- [x] Deployed: `https://lejar.<subdomain>.workers.dev/healthz` returns `ok`.
- [x] `https://lejar.<subdomain>.workers.dev/auth/google/callback` added to the Google OAuth client (old one kept until the end).
- [x] Signed in on the new address; existing vehicles, services and receipt photos are there.
- [x] Google consent screen: app name Lejar, home page and privacy links on the new address.
- [x] iPhone: Lejar added to the Home Screen (dark stamp icon), old Kereta icon removed.
- [x] Old `kereta` worker deleted and its redirect URI removed from Google.

## Answer

Done 2026-11-20 with `./scripts/rename-cutover.sh`. The `lejar` worker was deployed at 07:04 UTC with all five secrets set (checked with `wrangler secret list --name lejar`). `wrangler` reports that the `kereta` worker no longer exists. The owner checked sign-in, data, the Google redirect, the consent screen and the iPhone icon in the wizard. CI then redeployed `master` (run 44693334248, success).

# 01: Move the live app from Kereta to Lejar

**What to build:** The app runs at `lejar.<subdomain>.workers.dev` with all its existing data, and the old `kereta` worker is gone.

**Blocked by:** the rename branch merged into master.

**Status:** ready-for-human

Run `./scripts/rename-cutover.sh` from a terminal. It walks through every box below in order, reusing the values `go-live.sh` saved in `.dev.vars`.

- [ ] If the app was never live, run `./scripts/go-live.sh` instead (it now sets up Lejar) and tick everything else.
- [ ] Secrets set on the new `lejar` worker: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `OPENROUTER_API_KEY`, `CONTACT_EMAIL`.
- [ ] Deployed: `https://lejar.<subdomain>.workers.dev/healthz` returns `ok`.
- [ ] `https://lejar.<subdomain>.workers.dev/auth/google/callback` added to the Google OAuth client (old one kept until the end).
- [ ] Signed in on the new address; existing vehicles, services and receipt photos are there.
- [ ] Google consent screen: app name Lejar, home page and privacy links on the new address.
- [ ] iPhone: Lejar added to the Home Screen (dark stamp icon), old Kereta icon removed.
- [ ] Old `kereta` worker deleted and its redirect URI removed from Google.

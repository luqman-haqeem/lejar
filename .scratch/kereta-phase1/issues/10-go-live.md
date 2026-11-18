# 10: Go live on workers.dev

**What to build:** The app is deployed to `kereta.<subdomain>.workers.dev`, and the owner uses it end to end from their iPhone.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09

**Status:** ready-for-human

- [ ] The owner has created a Google OAuth web client with redirect URIs for localhost:8787 and the workers.dev callback.
- [ ] The owner has run `wrangler login` and added a payment card to the Cloudflare account so R2 is enabled.
- [ ] The production D1 database and the `kereta-receipts` R2 bucket are created, migrations are applied remotely, and the database id is committed.
- [ ] The secrets are set: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `OPENROUTER_API_KEY`. `CONTACT_EMAIL` is set as a var.
- [ ] The app is deployed. `/healthz` returns `ok`, and `/` redirects to sign-in when signed out.
- [ ] The Google consent screen has its homepage and privacy URL set and is published.
- [ ] On the iPhone: sign in, add the app to the Home Screen, add a vehicle, scan a real receipt, check the dashboard, and save a PDF.

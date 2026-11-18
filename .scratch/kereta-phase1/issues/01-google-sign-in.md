# 01: Sign in with Google and land on an empty dashboard

**What to build:** Anyone with a verified Google account can sign in and lands on their own empty dashboard, which invites them to add their first vehicle. They stay signed in for 30 days and can sign out. Every page except sign-in and a health check requires a signed-in user. This ticket also brings up the project itself: a Worker with a database and a test harness.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The sign-in page has one "Sign in with Google" button. It uses the authorization-code flow with PKCE and a `state` check, and requests the `openid email` scopes only.
- [x] A verified Google email creates a user record, keyed by the Google account id. Signing in again with the same account reuses that record and refreshes its email.
- [x] An unverified Google email gets "Not authorised". No user record is created and the person is not signed in.
- [x] A mismatched or missing `state` is rejected, and the person is not signed in.
- [x] Sessions are signed, HttpOnly and Secure, and last 30 days. A forged, tampered or expired session redirects to sign-in.
- [x] Signing out ends the session.
- [x] The dashboard shows an empty state that links to adding a vehicle.
- [x] Google calls go through an injectable fetch, so tests never hit the real Google.
- [x] Login does only light CPU work (no heavy hashing), so it stays within the Workers Free plan's ~10 ms CPU limit.
- [x] Tests and the typecheck pass.

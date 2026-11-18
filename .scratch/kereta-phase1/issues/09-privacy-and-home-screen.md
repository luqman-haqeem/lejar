# 09: Ready for the public and the Home Screen

**What to build:** A public `/privacy` page, which Google requires before sign-in can be opened to everyone. It explains in plain English what's stored (the Google email, vehicles, services and receipt photos), that receipt photos are sent to OpenRouter to be read, that nothing is sold or shared, and how to request deletion through a configured contact email. It's linked from the sign-in page. A web app manifest and icons make "Add to Home Screen" on iPhone look and feel like an app.

**Blocked by:** 01

**Status:** done

- [x] `/privacy` loads without signing in and shows the `CONTACT_EMAIL` value.
- [x] The manifest sets `name` to "Kereta", `display` to standalone and `start_url` to "/". There are 192 px and 512 px icons and an apple-touch-icon, and the iOS meta tags are in the page layout.
- [x] Phase 1 has no service worker (that comes with push in Phase 2).
- [x] Tests and the typecheck pass.

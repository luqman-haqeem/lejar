# 05: Attach a receipt photo to a service

**What to build:** While logging or editing a service, the user can attach a photo of the workshop receipt. The phone shrinks it before upload and it's stored privately in R2. The service page shows the photo. Only the owner can view it, deleting the service deletes the photo, and uploads that never get saved are cleaned up.

**Blocked by:** 03

**Status:** done

- [ ] The browser resizes the photo so its long edge is 1600 px and saves it as JPEG, aiming for about 500 KB or less. Uploads work from the iPhone camera.
- [x] Photos are stored under a per-user key (`receipts/<userId>/<uuid>.jpg`). The bucket is never public, and the service record stores only the key.
- [x] Uploads over 2 MB are rejected with 413 "Photo too large". Uploads that aren't JPEG, PNG or WebP are rejected with 415 "Unsupported image". Nothing is stored in either case.
- [x] The photo route only works for its owner. Anyone else gets 404, and signed-out visitors are sent to sign-in.
- [x] Deleting a service removes its photo from R2.
- [x] Orphan cleanup deletes photos older than 24 hours that no service references. It runs in the background on uploads, not on a cron.
- [x] Tests (using R2 in the test harness) and the typecheck pass.

## Comments

- 2026-11-18 (implementation): The resize box stays unticked until checked on a real iPhone: the Workers test pool has no browser canvas, so `public/app.js` shrinking is untested. If shrinking fails, the original uploads and the server's 2 MB / type checks apply.
- The photo uploads with the service form and is stored before the rest of the form is validated, so it survives a re-render (carried in a hidden `receipt_key`). A key in that field must be the user's own, unused by any other service, or the request is 404.
- Keys keep the stored image's type: `<uuid>.jpg` normally, `.png`/`.webp` if the browser couldn't convert and the original was uploaded.
- Orphan cleanup covers all users (up to 5 listing pages per run), so an abandoned upload is cleared even if that user never uploads again.
- Requests whose Content-Length can't hold an acceptable photo are refused with 413 before the body is read (CPU limit).
- Photos are served with `X-Content-Type-Options: nosniff`.
- For ticket 06: use `photoProblem` (before the scan cap), `putReceipt(bucket, userId, file)`, `cleanupOrphans(bucket, db)` via `inBackground` (`src/background.ts`), and send the stored file's real type in the data URL.

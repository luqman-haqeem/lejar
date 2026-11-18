# 05: Attach a receipt photo to a service

**What to build:** While logging or editing a service, the user can attach a photo of the workshop receipt. The phone shrinks it before upload and it's stored privately in R2. The service page shows the photo. Only the owner can view it, deleting the service deletes the photo, and uploads that never get saved are cleaned up.

**Blocked by:** 03

**Status:** done

- [x] The browser resizes the photo so its long edge is 1600 px and saves it as JPEG, aiming for about 500 KB or less. Uploads work from the iPhone camera.
- [x] Photos are stored under a per-user key (`receipts/<userId>/<uuid>.jpg`). The bucket is never public, and the service record stores only the key.
- [x] Uploads over 2 MB are rejected with 413 "Photo too large". Uploads that aren't JPEG, PNG or WebP are rejected with 415 "Unsupported image". Nothing is stored in either case.
- [x] The photo route only works for its owner. Anyone else gets 404, and signed-out visitors are sent to sign-in.
- [x] Deleting a service removes its photo from R2.
- [x] Orphan cleanup deletes photos older than 24 hours that no service references. It runs in the background on uploads, not on a cron.
- [x] Tests (using R2 in the test harness) and the typecheck pass.

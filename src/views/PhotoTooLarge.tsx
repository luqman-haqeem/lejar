import { MAX_PHOTO_BYTES } from "../receipts";
import { Layout } from "./Layout";

export function PhotoTooLarge() {
  return (
    <Layout title="Photo too large" signedIn>
      <section class="empty">
        <h1>Photo too large</h1>
        <p>
          Receipt photos can be up to {MAX_PHOTO_BYTES / 1024 / 1024} MB. Go back and choose the photo again; the app
          shrinks it before uploading.
        </p>
        <a class="button" href="javascript:history.back()">
          Go back
        </a>
      </section>
    </Layout>
  );
}

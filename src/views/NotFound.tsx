import { Layout } from "./Layout";

export function NotFound() {
  return (
    <Layout title="Not found" signedIn>
      <section class="empty">
        <h1>Not found</h1>
        <p>That page doesn't exist, or it isn't yours.</p>
        <a class="button" href="/">
          Back to dashboard
        </a>
      </section>
    </Layout>
  );
}

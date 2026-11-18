import { Layout } from "./Layout";

export function Login({ error }: { error?: string }) {
  return (
    <Layout title="Kereta">
      <section class="login">
        <h1>Kereta</h1>
        <p>Your vehicle service book: every service, receipt and renewal in one place.</p>
        {error && <p class="error">{error}</p>}
        <a class="button" href="/auth/google">
          Sign in with Google
        </a>
      </section>
    </Layout>
  );
}

import { Layout } from "./Layout";

export function Login({ error, devLogin = false }: { error?: string; /** Offer the local dev sign-in (localhost only). */ devLogin?: boolean }) {
  return (
    <Layout title="Kereta">
      <section class="login">
        <h1>Kereta</h1>
        <p>Your vehicle service book: every service, receipt and renewal in one place.</p>
        {error && <p class="error">{error}</p>}
        <a class="button" href="/auth/google">
          Sign in with Google
        </a>
        {devLogin && (
          <form method="post" action="/auth/dev" class="dev-login">
            <button type="submit" class="secondary">
              Sign in as local dev user
            </button>
            <p class="muted">Local development only. Not available on the live site.</p>
          </form>
        )}
        <p class="footer-links">
          <a href="/privacy">Privacy</a>
        </p>
      </section>
    </Layout>
  );
}

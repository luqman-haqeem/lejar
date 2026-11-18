import type { Child } from "hono/jsx";

export function Layout({ title, signedIn = false, children }: { title: string; signedIn?: boolean; children: Child }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{title === "Kereta" ? title : `${title} · Kereta`}</title>
        <link rel="stylesheet" href="/app.css" />
      </head>
      <body>
        {signedIn && (
          <header class="topbar">
            <a class="brand" href="/">
              Kereta
            </a>
            <form method="post" action="/logout">
              <button type="submit" class="link">
                Sign out
              </button>
            </form>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}

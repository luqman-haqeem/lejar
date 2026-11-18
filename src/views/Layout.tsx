import type { Child } from "hono/jsx";

export function Layout({
  title,
  signedIn = false,
  stylesheet,
  children,
}: {
  title: string;
  signedIn?: boolean;
  /** An extra stylesheet for this page, after app.css. */
  stylesheet?: string;
  children: Child;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{title === "Kereta" ? title : `${title} · Kereta`}</title>
        <meta name="theme-color" content="#0f6b5c" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Kereta" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="stylesheet" href="/app.css" />
        {stylesheet && <link rel="stylesheet" href={stylesheet} />}
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

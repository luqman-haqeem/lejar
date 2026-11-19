import type { Child } from "hono/jsx";
import { HomeIcon, ProfileIcon, ScanIcon } from "./icons";

export type Tab = "home" | "scan" | "profile";

/**
 * Text size and theme are per-device choices (Profile → Appearance), kept in localStorage. Applied in
 * <head> before first paint so pages never flash the wrong theme or size.
 */
const PREFS_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("kereta-theme"),s=localStorage.getItem("kereta-text-size");if(t)d.dataset.theme=t;if(s)d.dataset.textSize=s}catch(e){}`;

function TabBar({ tab }: { tab?: Tab }) {
  const current = (t: Tab) => (tab === t ? "page" : undefined);
  return (
    <nav class="tabbar" aria-label="Main">
      <a href="/" aria-current={current("home")}>
        <HomeIcon />
        <span>Home</span>
      </a>
      <a href="/scan" class="tab-scan" aria-current={current("scan")}>
        <span class="scan-disc">
          <ScanIcon />
        </span>
        <span>Scan receipt</span>
      </a>
      <a href="/profile" aria-current={current("profile")}>
        <ProfileIcon />
        <span>Profile</span>
      </a>
    </nav>
  );
}

export function Layout({
  title,
  signedIn = false,
  tab,
  stylesheet,
  children,
}: {
  title: string;
  signedIn?: boolean;
  /** The tab this page is, if it is one; deeper pages leave it unset. */
  tab?: Tab;
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
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
        <meta name="theme-color" content="#24305e" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1d2650" media="(prefers-color-scheme: dark)" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Kereta" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preload" href="/fonts/barlow-600-latin.woff2" as="font" type="font/woff2" crossorigin="" />
        <link rel="stylesheet" href="/app.css" />
        {stylesheet && <link rel="stylesheet" href={stylesheet} />}
      </head>
      <body class={signedIn ? "app" : undefined}>
        <main>{children}</main>
        {signedIn && <TabBar tab={tab} />}
      </body>
    </html>
  );
}

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { makeUser, sessionHeaders } from "./helpers";

const app = createApp();

describe("the privacy page", () => {
  it("loads without signing in and explains what's stored, OpenRouter, and how to ask for deletion", async () => {
    const res = await app.request("/privacy", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const text of ["Google email", "vehicles", "services", "Receipt photos", "OpenRouter", "never sold or shared"]) {
      expect(html).toContain(text);
    }
    expect(env.CONTACT_EMAIL).toMatch(/@/);
    expect(html).toContain(`href="mailto:${env.CONTACT_EMAIL}`);
  });

  it("is linked from the sign-in page", async () => {
    expect(await (await app.request("/login", {}, env)).text()).toContain('href="/privacy"');
  });
});

describe("adding to the Home Screen", () => {
  it("links the manifest and sets the iOS web-app tags on every page", async () => {
    for (const html of [
      await (await app.request("/login", {}, env)).text(),
      await (await app.request("/", { headers: await sessionHeaders(await makeUser()) }, env)).text(),
    ]) {
      expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"');
      expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png"');
      expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes"');
      expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Kereta"');
      expect(html).toContain('<meta name="theme-color"');
    }
  });

  it("has no service worker in Phase 1", async () => {
    const html = await (await app.request("/login", {}, env)).text();
    expect(html).not.toContain("serviceWorker");
    expect((await env.ASSETS.fetch("https://kereta.test/sw.js")).status).toBe(404);
  });

  it("serves a standalone manifest with 192 px and 512 px icons", async () => {
    const res = await env.ASSETS.fetch("https://kereta.test/manifest.webmanifest");
    expect(res.status).toBe(200);
    const manifest = (await res.json()) as { name: string; display: string; start_url: string; icons: { src: string; sizes: string }[] };
    expect(manifest).toMatchObject({ name: "Kereta", display: "standalone", start_url: "/" });
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of [...manifest.icons.map((i) => i.src), "/apple-touch-icon.png"]) {
      const png = await env.ASSETS.fetch(`https://kereta.test${icon}`);
      expect(png.status, icon).toBe(200);
      expect(new Uint8Array(await png.arrayBuffer()).slice(1, 4)).toEqual(new Uint8Array([0x50, 0x4e, 0x47])); // "PNG"
    }
  });
});

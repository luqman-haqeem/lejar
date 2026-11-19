import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { makeUser, postForm, sessionHeaders } from "./helpers";

const app = createApp();
const get = async (path: string, userId: number) => app.request(path, { headers: await sessionHeaders(userId) }, env);
const page = async (path: string, userId: number) => (await get(path, userId)).text();

async function addCar(userId: number, name = "Myvi") {
  const res = await postForm(app, "/vehicles", userId, { type: "car", name, plate: "WXY 1234" });
  return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\/edit$/)![1]);
}

/** The tab bar's links as [href, current?]. */
const tabs = (html: string) =>
  [...(html.match(/<nav class="tabbar"[^>]*>(.*?)<\/nav>/s)?.[1] ?? "").matchAll(/<a ([^>]*)>/g)].map((m) => [
    m[1].match(/href="([^"]*)"/)![1],
    m[1].includes('aria-current="page"'),
  ]);

describe("bottom tab bar", () => {
  it("links Home, Scan receipt and Profile on signed-in pages, marking the current one", async () => {
    const user = await makeUser();
    expect(tabs(await page("/", user))).toEqual([
      ["/", true],
      ["/scan", false],
      ["/profile", false],
    ]);
    expect(tabs(await page("/profile", user))).toEqual([
      ["/", false],
      ["/scan", false],
      ["/profile", true],
    ]);
  });

  it("marks no tab on a page deeper than a tab", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    expect(tabs(await page(`/vehicles/${car}`, user)).map(([, current]) => current)).toEqual([false, false, false]);
  });

  it("is not on the sign-in page", async () => {
    const html = await (await app.request("/login", {}, env)).text();
    expect(html).not.toContain('class="tabbar"');
  });
});

describe("profile", () => {
  it("needs a session", async () => {
    const res = await app.request("/profile", {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("lists the user's own vehicles with a way to add one", async () => {
    const user = await makeUser();
    const car = await addCar(user, "Myvi");
    await addCar(await makeUser(), "Someone else's Axia");
    const html = await page("/profile", user);
    expect(html).toContain(`href="/vehicles/${car}"`);
    expect(html).toContain(`href="/vehicles/${car}/edit"`);
    expect(html).toContain("Myvi");
    expect(html).not.toContain("Axia");
    expect(html).toContain('href="/vehicles/new"');
  });

  it("links archived vehicles only when there are some", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    expect(await page("/profile", user)).not.toContain('href="/vehicles/archived"');
    await postForm(app, `/vehicles/${car}/archive`, user, {});
    expect(await page("/profile", user)).toContain('href="/vehicles/archived"');
  });

  it("offers text size and theme choices, and signing out", async () => {
    const html = await page("/profile", await makeUser());
    for (const value of ["standard", "large", "larger"]) expect(html).toMatch(new RegExp(`name="text-size" value="${value}"`));
    for (const value of ["system", "light", "dark"]) expect(html).toMatch(new RegExp(`name="theme" value="${value}"`));
    expect(html).toMatch(/<form[^>]*method="post"[^>]*action="\/logout"|<form[^>]*action="\/logout"[^>]*method="post"/);
  });
});

describe("appearance preferences", () => {
  it("are applied before the page paints, on every page", async () => {
    for (const html of [await page("/", await makeUser()), await (await app.request("/login", {}, env)).text()]) {
      const head = html.match(/<head>(.*?)<\/head>/s)![1];
      expect(head).toMatch(/<script>[^<]*localStorage[^<]*<\/script>/);
    }
  });
});

describe("vehicle page schedule", () => {
  it("shows every schedule item plus road tax and insurance, and the dashboard links to it", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const html = await page(`/vehicles/${car}`, user);
    const schedule = html.match(/<section id="schedule"[^>]*>(.*?)<\/section>/s)?.[1] ?? "";
    // The car template has 8 items; the dashboard shows only the top 3.
    expect([...schedule.matchAll(/<li class="due s-\w+">/g)]).toHaveLength(8);
    expect(schedule).toContain('<span class="due-name">Road tax</span>');
    expect(await page("/", user)).toContain(`href="/vehicles/${car}#schedule"`);
  });

  it("puts scanning a receipt first", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const html = await page(`/vehicles/${car}`, user);
    expect(html).toContain(`<a class="button" href="/scan?vehicle=${car}">`);
    expect(html).toContain(`<a class="secondary" href="/services/new?vehicle=${car}">`);
  });
});

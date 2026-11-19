import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { cookieValue } from "./fake-google";

import { itemsOf, makeUser, postForm, sessionHeaders } from "./helpers";

const app = createApp();

describe("empty dashboard", () => {
  it("invites a new user to add their first vehicle", async () => {
    const res = await app.request("/", { headers: await sessionHeaders(await makeUser()) }, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Add your first vehicle");
    expect(html).toContain('href="/vehicles/new"');
  });
});

describe("signing out", () => {
  it("clears the session and returns to sign-in", async () => {
    const headers = await sessionHeaders(await makeUser());
    const res = await app.request("/logout", { method: "POST", headers }, env);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
    const cleared = res.headers.getSetCookie().find((c) => c.startsWith("kereta_session="))!;
    expect(cleared).toContain("Max-Age=0");
    expect(cookieValue(res, "kereta_session")).toBe("");
  });

});

describe("what's due on the dashboard", () => {
  // 18/10/2026, mid-morning in Kuala Lumpur.
  const dueApp = createApp({ now: () => new Date("2026-10-18T02:00:00Z") });
  const post = (path: string, userId: number, fields: Record<string, string>) => postForm(dueApp, path, userId, fields);
  const dashboard = async (userId: number) =>
    (await dueApp.request("/", { headers: await sessionHeaders(userId) }, env)).text();

  async function addCar(userId: number, fields: Record<string, string> = {}) {
    const res = await post("/vehicles", userId, { type: "car", name: "Myvi", ...fields });
    return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\/edit$/)![1]);
  }

  /** Road tax or insurance as [status, text], with any icon markup dropped. */
  const renewal = (html: string, label: string) => {
    const m = html.match(new RegExp(`<li class="renewal s-(\\w+)"><span class="due-name">${label}</span>(.*?)</li>`));
    return m ? [m[1], m[2].replace(/<[^>]*>/g, "")] : null;
  };

  /** Each due row on the page as [status, item name]. */
  const dueRows = (html: string) =>
    [...html.matchAll(/<li class="due s-(\w+)"><span class="due-name">([^<]*)<\/span>/g)].map((m) => [m[1], m[2]]);

  it("flags an item whose date has passed as overdue, and shows the estimated km", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const [engineOil] = await itemsOf(car);
    await post("/services", user, {
      vehicle_id: String(car),
      date: "2026-04-01",
      odometer_km: "50000",
      total: "150",
      "line.0.description": "Engine oil",
      "line.0.item": String(engineOil.id),
    });
    await post(`/vehicles/${car}/readings`, user, { date: "2026-10-01", km: "53660" }); // 20 km/day

    const html = await dashboard(user);
    expect(dueRows(html)[0]).toEqual(["overdue", "Engine oil"]);
    expect(html).toContain("~54,000 km");
  });

  it("links an item with no history straight to setting its baseline", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const [engineOil] = await itemsOf(car);
    const html = await dashboard(user);
    expect(dueRows(html)).toContainEqual(["unknown", "Engine oil"]);
    expect(html).toContain(`href="/vehicles/${car}/edit#item-${engineOil.id}"`);

    const edit = await (await dueApp.request(`/vehicles/${car}/edit`, { headers: await sessionHeaders(user) }, env)).text();
    expect(edit).toContain(`id="item-${engineOil.id}"`);
  });

  it("never leaves an unknown item without a way to fix it", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const items = await itemsOf(car);
    // Engine oil goes by km only but has only a date baseline; Oil filter has a km baseline but there
    // are no odometer readings to compare it with.
    const form: Record<string, string> = { type: "car", name: "Myvi" };
    items.forEach((i, n) => {
      form[`item.${n}.id`] = String(i.id);
      form[`item.${n}.name`] = i.name;
      form[`item.${n}.km`] = String(i.interval_km ?? "");
      form[`item.${n}.months`] = i.name === "Engine oil" ? "" : String(i.interval_months);
    });
    form["item.0.baseline_date"] = "2026-06-01";
    form["item.1.baseline_km"] = "50000";
    expect((await post(`/vehicles/${car}`, user, form)).status).toBe(302);

    const html = await dashboard(user);
    const row = (name: string) => html.match(new RegExp(`<li class="due s-\\w+"><span class="due-name">${name}</span>(.*?)</li>`))?.[1];
    expect(row("Engine oil")).toContain(`href="/vehicles/${car}/edit#item-${items[0].id}"`);
    expect(row("Engine oil")).toContain("Set last done km");
    expect(row("Oil filter")).toContain(`href="/vehicles/${car}#odometer"`);
    expect(row("Oil filter")).toContain("at 60,000 km");
  });

  it("puts overdue items above due-soon, unknown and OK ones", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const form: Record<string, string> = { type: "car", name: "Myvi" };
    const baselines: Record<string, string> = {
      "Engine oil": "2026-09-01", // due 01/03/2027: ok
      "Oil filter": "2026-04-10", // due 10/10/2026: overdue
      "Air filter": "2025-10-25", // due 25/10/2026: soon
    };
    (await itemsOf(car)).forEach((i, n) => {
      form[`item.${n}.id`] = String(i.id);
      form[`item.${n}.name`] = i.name;
      form[`item.${n}.months`] = String(i.interval_months);
      form[`item.${n}.baseline_date`] = baselines[i.name] ?? "";
    });
    expect((await post(`/vehicles/${car}`, user, form)).status).toBe(302);

    const rows = dueRows(await dashboard(user));
    expect(rows.slice(0, 3)).toEqual([
      ["overdue", "Oil filter"],
      ["soon", "Air filter"],
      ["unknown", "Cabin filter"],
    ]);
  });

  it("counts down road tax and insurance", async () => {
    const user = await makeUser();
    await addCar(user, { roadtax_expiry: "2026-11-01", insurance_expiry: "2026-10-18" });
    const html = await dashboard(user);
    expect(renewal(html, "Road tax")).toEqual(["soon", "in 14 days"]);
    expect(renewal(html, "Insurance")).toEqual(["overdue", "Expired 18/10/2026"]);
  });

  it("says when road tax or insurance hasn't been set", async () => {
    const user = await makeUser();
    await addCar(user);
    const html = await dashboard(user);
    expect(renewal(html, "Road tax")).toEqual(["unknown", "Not set"]);
    expect(renewal(html, "Insurance")).toEqual(["unknown", "Not set"]);
  });

  it("prompts for an odometer reading when the last one is over 30 days old", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    await post(`/vehicles/${car}/readings`, user, { date: "2026-09-08", km: "40000" }); // 40 days ago
    expect(await dashboard(user)).toContain(`href="/vehicles/${car}#odometer"`);

    await post(`/vehicles/${car}/readings`, user, { date: "2026-10-10", km: "40500" });
    expect(await dashboard(user)).not.toContain("Update odometer");
  });

  it("never shows another user's vehicles", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    await addCar(alice, { name: "Alice's Axia" });
    await addCar(bob, { name: "Bob's Bezza" });
    const html = await dashboard(bob);
    expect(html).toContain("Bob&#39;s Bezza");
    expect(html).not.toContain("Alice&#39;s Axia");
  });
});

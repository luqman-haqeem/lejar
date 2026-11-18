import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getVehicle, listVehicles } from "../src/db";
import { createApp } from "../src/index";
import { itemsOf, makeUser, postForm, sessionHeaders } from "./helpers";

// A fixed "today", so renewal dates render the same way whenever the tests run.
const app = createApp({ now: () => new Date("2026-11-18T02:00:00Z") });

const post = (path: string, userId: number, fields: Record<string, string>) => postForm(app, path, userId, fields);

async function addVehicle(userId: number, fields: Record<string, string> = {}): Promise<number> {
  const res = await post("/vehicles", userId, { type: "car", name: "Myvi", plate: "wxy 1234", ...fields });
  const id = res.headers.get("location")?.match(/^\/vehicles\/(\d+)\/edit$/)?.[1];
  if (!id) throw new Error(`vehicle not created: ${res.status}`);
  return Number(id);
}

const schedule = async (vehicleId: number) =>
  (await itemsOf(vehicleId)).map((i) => [i.name, i.interval_km, i.interval_months]);

describe("adding a vehicle", () => {
  it("creates a car with its details and opens its schedule for editing", async () => {
    const user = await makeUser();
    const res = await post("/vehicles", user, {
      type: "car",
      name: "Myvi",
      plate: " wxy  1234 ",
      make: "Perodua",
      model: "Myvi 1.5 AV",
      year: "2019",
      roadtax_expiry: "2027-03-05",
      insurance_expiry: "05/03/2027",
      insurer: "Etiqa",
    });

    expect(res.status).toBe(302);
    const id = Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\/edit$/)![1]);
    expect(await getVehicle(env.DB, user, id)).toMatchObject({
      type: "car",
      name: "Myvi",
      plate: "WXY 1234",
      make: "Perodua",
      model: "Myvi 1.5 AV",
      year: 2019,
      roadtax_expiry: "2027-03-05",
      insurance_expiry: "2027-03-05",
      insurer: "Etiqa",
      archived: 0,
    });
  });

  it("starts a car on the default car schedule", async () => {
    const id = await addVehicle(await makeUser(), { type: "car" });
    expect(await schedule(id)).toEqual([
      ["Engine oil", 10000, 6],
      ["Oil filter", 10000, 6],
      ["Air filter", 20000, 12],
      ["Cabin filter", 20000, 12],
      ["ATF/CVT fluid", 40000, 24],
      ["Spark plugs", 40000, 24],
      ["Brake fluid", null, 24],
      ["Coolant", 40000, 24],
    ]);
  });

  it("starts a motorbike on the default motorbike schedule", async () => {
    const id = await addVehicle(await makeUser(), { type: "motorbike", name: "Y15" });
    expect(await schedule(id)).toEqual([
      ["Engine oil", 3000, 3],
      ["Oil filter", 6000, 6],
      ["Spark plug", 10000, 12],
      ["Drive chain/belt", 1000, 1],
      ["Brake fluid", null, 24],
    ]);
  });
});

describe("refusing a bad vehicle", () => {
  it("keeps what was typed, says what's wrong, and creates nothing", async () => {
    const user = await makeUser();
    const res = await post("/vehicles", user, { type: "car", name: "", plate: "ABC 1", roadtax_expiry: "31/02/2027" });

    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Give the vehicle a name.");
    expect(html).toContain("Road tax expiry isn&#39;t a valid date.");
    expect(html).toContain('value="ABC 1"');
    expect(await listVehicles(env.DB, user)).toEqual([]);
  });

  it("shows each error under its field and links to it from the summary", async () => {
    const user = await makeUser();
    const html = await (await post("/vehicles", user, { type: "car", name: "" })).text();

    expect(html).toContain('<a href="#f-name">Give the vehicle a name.</a>');
    expect(html).toMatch(/<input name="name" id="f-name"[^>]*aria-describedby="f-name-error"/);
    expect(html).toContain('<span class="field-error" id="f-name-error">Give the vehicle a name.</span>');
  });
});

/** The edit form's fields for the vehicle as it is now, the way the browser would post them back. */
async function currentForm(vehicleId: number): Promise<Record<string, string>> {
  const fields: Record<string, string> = { type: "car", name: "Myvi", plate: "WXY 1234" };
  (await itemsOf(vehicleId)).forEach((i, n) => {
    fields[`item.${n}.id`] = String(i.id);
    fields[`item.${n}.name`] = i.name;
    fields[`item.${n}.km`] = i.interval_km === null ? "" : String(i.interval_km);
    fields[`item.${n}.months`] = i.interval_months === null ? "" : String(i.interval_months);
  });
  return fields;
}

describe("editing the schedule", () => {
  it("saves a changed interval, a new item and a removed item", async () => {
    const user = await makeUser();
    const id = await addVehicle(user);
    const form = await currentForm(id);
    form["item.0.km"] = "7,500"; // Engine oil
    form["item.6.remove"] = "1"; // Brake fluid
    form["item.8.name"] = "Tyre rotation"; // the blank row at the end
    form["item.8.km"] = "10000";

    const res = await post(`/vehicles/${id}`, user, form);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`/vehicles/${id}/edit?saved=1`);
    expect(await schedule(id)).toEqual([
      ["Engine oil", 7500, 6],
      ["Oil filter", 10000, 6],
      ["Air filter", 20000, 12],
      ["Cabin filter", 20000, 12],
      ["ATF/CVT fluid", 40000, 24],
      ["Spark plugs", 40000, 24],
      ["Coolant", 40000, 24],
      ["Tyre rotation", 10000, null],
    ]);
  });

  it("saves a last-done baseline as a date and km, or either alone", async () => {
    const user = await makeUser();
    const id = await addVehicle(user);
    const form = await currentForm(id);
    form["item.0.baseline_date"] = "2026-01-10";
    form["item.0.baseline_km"] = "50000";
    form["item.1.baseline_date"] = "10/01/2026";
    form["item.2.baseline_km"] = "48,000";

    expect((await post(`/vehicles/${id}`, user, form)).status).toBe(302);
    const baselines = (await itemsOf(id)).slice(0, 4).map((i) => [i.baseline_date, i.baseline_km]);
    expect(baselines).toEqual([
      ["2026-01-10", 50000],
      ["2026-01-10", null],
      [null, 48000],
      [null, null],
    ]);
  });

  it("saves edited vehicle details", async () => {
    const user = await makeUser();
    const id = await addVehicle(user);
    const form = { ...(await currentForm(id)), name: "Wife's Myvi", insurer: "Takaful", insurance_expiry: "2027-06-30" };

    expect((await post(`/vehicles/${id}`, user, form)).status).toBe(302);
    expect(await getVehicle(env.DB, user, id)).toMatchObject({
      name: "Wife's Myvi",
      insurer: "Takaful",
      insurance_expiry: "2027-06-30",
    });
  });

  it("refuses an item with no interval, a future baseline or a garbage km, and changes nothing", async () => {
    const user = await makeUser();
    const id = await addVehicle(user);
    const before = await itemsOf(id);
    const form = await currentForm(id);
    form["item.0.km"] = "";
    form["item.0.months"] = "";
    form["item.1.baseline_date"] = "2099-01-01";
    form["item.2.baseline_km"] = "lots";
    form.name = "Renamed";

    const res = await post(`/vehicles/${id}`, user, form);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Engine oil: set a km or a month interval.");
    expect(html).toContain("Oil filter: last done date can&#39;t be in the future.");
    expect(html).toContain("Air filter: last done km must be a whole number.");
    expect(html).toContain('value="lots"');
    expect(await itemsOf(id)).toEqual(before);
    expect((await getVehicle(env.DB, user, id))?.name).toBe("Myvi");
  });

  it("shows the schedule on the edit page", async () => {
    const user = await makeUser();
    const id = await addVehicle(user);
    const res = await app.request(`/vehicles/${id}/edit`, { headers: await sessionHeaders(user) }, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('value="ATF/CVT fluid"');
    expect(html).toContain('value="40000"');
  });
});

describe("someone else's vehicle", () => {
  it("is 404 to open, edit or archive by URL, and stays unchanged", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const id = await addVehicle(alice);
    const before = { vehicle: await getVehicle(env.DB, alice, id), items: await itemsOf(id) };
    const hijack = { ...(await currentForm(id)), name: "Stolen", "item.0.km": "1" };

    expect((await app.request(`/vehicles/${id}/edit`, { headers: await sessionHeaders(bob) }, env)).status).toBe(404);
    expect((await post(`/vehicles/${id}`, bob, hijack)).status).toBe(404);
    expect((await post(`/vehicles/${id}/archive`, bob, {})).status).toBe(404);

    expect(await getVehicle(env.DB, alice, id)).toEqual(before.vehicle);
    expect(await itemsOf(id)).toEqual(before.items);
    expect(await getVehicle(env.DB, bob, id)).toBeNull();
  });

  it("can't have its schedule items taken over through your own vehicle's form", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const alices = await addVehicle(alice);
    const bobs = await addVehicle(bob);
    const aliceItems = await itemsOf(alices);
    const form = await currentForm(bobs);
    form["item.0.id"] = String(aliceItems[0].id);
    form["item.0.name"] = "Taken over";

    expect((await post(`/vehicles/${bobs}`, bob, form)).status).toBe(302);
    expect(await itemsOf(alices)).toEqual(aliceItems);
    expect((await itemsOf(bobs)).map((i) => i.name)).toContain("Taken over");
  });

  it("is 404 for an id that doesn't exist", async () => {
    const res = await app.request("/vehicles/999999/edit", { headers: await sessionHeaders(await makeUser()) }, env);
    expect(res.status).toBe(404);
  });
});

describe("signed out", () => {
  it("can't add a vehicle", async () => {
    const res = await app.request("/vehicles", { method: "POST", body: new URLSearchParams({ name: "x" }) }, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });
});

describe("the dashboard", () => {
  const dashboard = async (userId: number) =>
    (await app.request("/", { headers: await sessionHeaders(userId) }, env)).text();

  it("shows each vehicle with its plate and renewal dates as DD/MM/YYYY", async () => {
    const user = await makeUser();
    const id = await addVehicle(user, {
      name: "Myvi",
      plate: "WXY 1234",
      roadtax_expiry: "2027-03-05",
      insurance_expiry: "2027-04-01",
      insurer: "Etiqa",
    });
    await addVehicle(user, { type: "motorbike", name: "Y15", plate: "VAB 99" });

    const html = await dashboard(user);
    expect(html).toContain("Myvi");
    expect(html).toContain("WXY 1234");
    expect(html).toContain("05/03/2027");
    expect(html).toContain("01/04/2027");
    expect(html).toContain("Etiqa");
    expect(html).toContain("Y15");
    expect(html).toContain(`href="/vehicles/${id}"`);
    expect(html).toContain('href="/vehicles/new"');
    expect(html).not.toContain("Add your first vehicle");
  });

  it("drops a vehicle once it's archived", async () => {
    const user = await makeUser();
    const kept = await addVehicle(user, { name: "Kept car" });
    const gone = await addVehicle(user, { name: "Sold car" });

    const res = await post(`/vehicles/${gone}/archive`, user, {});
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");

    const html = await dashboard(user);
    expect(html).toContain("Kept car");
    expect(html).not.toContain("Sold car");
    expect((await listVehicles(env.DB, user)).map((v) => v.id)).toEqual([kept]);
  });

  it("never shows another user's vehicles", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    await addVehicle(alice, { name: "Alice's Axia" });

    expect(await dashboard(bob)).not.toContain("Alice&#39;s Axia");
    expect(await dashboard(bob)).toContain("Add your first vehicle");
    expect(await listVehicles(env.DB, bob)).toEqual([]);
  });
});

describe("review follow-ups", () => {
  it("gives each of one user's vehicles its own schedule", async () => {
    const user = await makeUser();
    const car = await addVehicle(user, { type: "car" });
    const bike = await addVehicle(user, { type: "motorbike", name: "Y15" });
    expect(await itemsOf(car)).toHaveLength(8);
    expect(await itemsOf(bike)).toHaveLength(5);
  });

  it("keeps the vehicle type it was created with", async () => {
    const user = await makeUser();
    const id = await addVehicle(user, { type: "car" });
    const res = await post(`/vehicles/${id}`, user, { ...(await currentForm(id)), type: "motorbike" });
    expect(res.status).toBe(302);
    expect((await getVehicle(env.DB, user, id))?.type).toBe("car");
  });

  it("refuses a schedule with more than 50 items", async () => {
    const user = await makeUser();
    const id = await addVehicle(user);
    const form = await currentForm(id);
    for (let n = 8; n < 60; n++) {
      form[`item.${n}.name`] = `Extra ${n}`;
      form[`item.${n}.months`] = "12";
    }
    const res = await post(`/vehicles/${id}`, user, form);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("A schedule can have at most 50 items.");
    expect(await itemsOf(id)).toHaveLength(8);
  });
});

describe("undoing an archive", () => {
  it("lists archived vehicles and restores one to the dashboard", async () => {
    const user = await makeUser();
    const sold = await addVehicle(user, { name: "Sold Saga" });
    await addVehicle(user, { name: "Daily Myvi" });
    await post(`/vehicles/${sold}/archive`, user, {});

    const dashboard = await (await app.request("/", { headers: await sessionHeaders(user) }, env)).text();
    expect(dashboard).toContain('href="/vehicles/archived"');
    const list = await app.request("/vehicles/archived", { headers: await sessionHeaders(user) }, env);
    expect(list.status).toBe(200);
    const html = await list.text();
    expect(html).toContain("Sold Saga");
    expect(html).not.toContain("Daily Myvi");
    expect(html).toContain(`action="/vehicles/${sold}/restore"`);

    const res = await post(`/vehicles/${sold}/restore`, user, {});
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    expect((await listVehicles(env.DB, user)).map((v) => v.name)).toEqual(["Daily Myvi", "Sold Saga"]);
  });

  it("offers Restore on an archived vehicle's own page", async () => {
    const user = await makeUser();
    const id = await addVehicle(user);
    await post(`/vehicles/${id}/archive`, user, {});
    const html = await (await app.request(`/vehicles/${id}/edit`, { headers: await sessionHeaders(user) }, env)).text();
    expect(html).toContain(`action="/vehicles/${id}/restore"`);
  });

  it("doesn't link to an empty archive", async () => {
    const user = await makeUser();
    await addVehicle(user);
    const dashboard = await (await app.request("/", { headers: await sessionHeaders(user) }, env)).text();
    expect(dashboard).not.toContain('href="/vehicles/archived"');
  });

  it("is 404 for someone else's vehicle, and their archive isn't listed", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const id = await addVehicle(alice, { name: "Alice's Axia" });
    await post(`/vehicles/${id}/archive`, alice, {});

    expect((await post(`/vehicles/${id}/restore`, bob, {})).status).toBe(404);
    expect((await getVehicle(env.DB, alice, id))?.archived).toBe(1);
    const bobs = await (await app.request("/vehicles/archived", { headers: await sessionHeaders(bob) }, env)).text();
    expect(bobs).not.toContain("Alice&#39;s Axia");
  });
});

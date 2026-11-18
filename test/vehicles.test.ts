import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getVehicle, listItems, listVehicles } from "../src/db";
import { createApp } from "../src/index";
import { makeUser, sessionHeaders } from "./helpers";

const app = createApp();

async function post(path: string, userId: number, fields: Record<string, string>) {
  return app.request(
    path,
    { method: "POST", headers: await sessionHeaders(userId), body: new URLSearchParams(fields) },
    env,
  );
}

async function addVehicle(userId: number, fields: Record<string, string> = {}): Promise<number> {
  const res = await post("/vehicles", userId, { type: "car", name: "Myvi", plate: "wxy 1234", ...fields });
  const id = res.headers.get("location")?.match(/^\/vehicles\/(\d+)\/edit$/)?.[1];
  if (!id) throw new Error(`vehicle not created: ${res.status}`);
  return Number(id);
}

const schedule = async (vehicleId: number) =>
  (await listItems(env.DB, vehicleId)).map((i) => [i.name, i.interval_km, i.interval_months]);

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
});

/** The edit form's fields for the vehicle as it is now, the way the browser would post them back. */
async function currentForm(vehicleId: number): Promise<Record<string, string>> {
  const fields: Record<string, string> = { type: "car", name: "Myvi", plate: "WXY 1234" };
  (await listItems(env.DB, vehicleId)).forEach((i, n) => {
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
    const baselines = (await listItems(env.DB, id)).slice(0, 4).map((i) => [i.baseline_date, i.baseline_km]);
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
    const before = await listItems(env.DB, id);
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
    expect(await listItems(env.DB, id)).toEqual(before);
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
    const before = { vehicle: await getVehicle(env.DB, alice, id), items: await listItems(env.DB, id) };
    const hijack = { ...(await currentForm(id)), name: "Stolen", "item.0.km": "1" };

    expect((await app.request(`/vehicles/${id}/edit`, { headers: await sessionHeaders(bob) }, env)).status).toBe(404);
    expect((await post(`/vehicles/${id}`, bob, hijack)).status).toBe(404);
    expect((await post(`/vehicles/${id}/archive`, bob, {})).status).toBe(404);

    expect(await getVehicle(env.DB, alice, id)).toEqual(before.vehicle);
    expect(await listItems(env.DB, id)).toEqual(before.items);
    expect(await getVehicle(env.DB, bob, id)).toBeNull();
  });

  it("can't have its schedule items taken over through your own vehicle's form", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const alices = await addVehicle(alice);
    const bobs = await addVehicle(bob);
    const aliceItems = await listItems(env.DB, alices);
    const form = await currentForm(bobs);
    form["item.0.id"] = String(aliceItems[0].id);
    form["item.0.name"] = "Taken over";

    expect((await post(`/vehicles/${bobs}`, bob, form)).status).toBe(302);
    expect(await listItems(env.DB, alices)).toEqual(aliceItems);
    expect((await listItems(env.DB, bobs)).map((i) => i.name)).toContain("Taken over");
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
    expect(html).toContain(`href="/vehicles/${id}/edit"`);
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

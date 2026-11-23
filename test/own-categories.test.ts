import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getService, listServices } from "../src/db";
import { createApp } from "../src/index";
import { makeUser, postForm, sessionHeaders } from "./helpers";

const app = createApp({ now: () => new Date("2026-11-18T02:00:00Z") });
const post = (path: string, userId: number, fields: Record<string, string>) => postForm(app, path, userId, fields);
const get = async (path: string, userId: number) => app.request(path, { headers: await sessionHeaders(userId) }, env);

const BUILT_IN = ["Engine", "Filters", "Brakes", "Tyres", "Battery", "Wipers", "Suspension", "Electrical", "Body", "Other"];

async function addCar(userId: number, name = "Myvi"): Promise<number> {
  const res = await post("/vehicles", userId, { type: "car", name });
  return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\?added=1$/)![1]);
}

const visit = { date: "2026-10-02", odometer_km: "84210", workshop: "Ah Seng", total: "" };

/** The value and text of each option on a line's Category picker. */
async function categoryChoices(userId: number, vehicleId: number): Promise<[string, string][]> {
  const html = await (await get(`/services/new?vehicle=${vehicleId}`, userId)).text();
  const select = html.match(/<select name="line\.0\.category"[^>]*>(.*?)<\/select>/)![1];
  return [...select.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)</g)].map((m) => [m[1], m[2]]);
}

/** Logs a one-line service whose line gets a new own category typed on the picker. */
function logWithNewCategory(userId: number, vehicleId: number, name: string, description = "Dashcam fitting") {
  return post("/services", userId, {
    vehicle_id: String(vehicleId),
    ...visit,
    "line.0.description": description,
    "line.0.cost": "350",
    "line.0.category": "__new__",
    "line.0.new_category": name,
  });
}

/** The ids of the owner's own categories listed on the profile page, by name. */
async function profileCategories(userId: number): Promise<Map<string, { id: number; lines: string }>> {
  const html = await (await get("/profile", userId)).text();
  const found = new Map<string, { id: number; lines: string }>();
  for (const m of html.matchAll(/<li class="category-row" id="category-(\d+)">.*?<input[^>]*name="name"[^>]*value="([^"]*)".*?<small>([^<]*)<\/small>/gs)) {
    found.set(m[2], { id: Number(m[1]), lines: m[3] });
  }
  return found;
}

describe("an owner's own category", () => {
  it("is created from New category… on a line's picker and set on that line", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    expect((await logWithNewCategory(user, car, "Dashcam")).status).toBe(302);
    const [{ id }] = await listServices(env.DB, user, car);
    expect((await getService(env.DB, user, id))!.lines.map((l) => l.category)).toEqual(["Dashcam"]);
  });

  it("is offered on every line, on all the owner's vehicles, after the built-in ones", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const bike = await addCar(user, "Kriss");
    await logWithNewCategory(user, car, "Dashcam");
    await logWithNewCategory(user, car, "Accessories", "Phone holder");
    expect(await categoryChoices(user, bike)).toEqual([
      ["", "No category"],
      ...BUILT_IN.map((c) => [c, c]),
      ["Accessories", "Accessories"],
      ["Dashcam", "Dashcam"],
      ["__new__", "New category…"],
    ]);
  });

  it.each([
    ["", "Dashcam fitting: enter a name for the category."],
    ["brakes", "Dashcam fitting: there's already a category called Brakes."],
    ["DASHCAM", "Dashcam fitting: there's already a category called Dashcam."],
    // The picker's own value for New category…
    ["__new__", "Dashcam fitting: choose another name for the category."],
  ])("named %j is refused with a field error, keeping what was typed and saving nothing", async (name, message) => {
    const user = await makeUser();
    const car = await addCar(user);
    await logWithNewCategory(user, car, "Dashcam");
    const res = await logWithNewCategory(user, car, name);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(`<span class="field-error" id="f-line.0.new_category-error">${message.replace("'", "&#39;")}</span>`);
    expect(html).toContain(`name="line.0.new_category" id="f-line.0.new_category" type="text" value="${name}"`);
    expect(html).toMatch(/<option value="__new__" selected="">New category…<\/option>/);
    expect(await listServices(env.DB, user, car)).toHaveLength(1);
    expect([...(await profileCategories(user)).keys()]).toEqual(["Dashcam"]);
  });

  it("named the same on two lines is created once and set on both", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const res = await post("/services", user, {
      vehicle_id: String(car),
      ...visit,
      "line.0.description": "Dashcam",
      "line.0.category": "__new__",
      "line.0.new_category": "Dashcam",
      "line.1.description": "Hardwire kit",
      "line.1.category": "__new__",
      "line.1.new_category": "dashcam",
    });
    expect(res.status).toBe(302);
    const [{ id }] = await listServices(env.DB, user, car);
    expect((await getService(env.DB, user, id))!.lines.map((l) => l.category)).toEqual(["Dashcam", "Dashcam"]);
    expect([...(await profileCategories(user)).keys()]).toEqual(["Dashcam"]);
  });

  it("is listed on the profile page with how many lines use it", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const bike = await addCar(user, "Kriss");
    await logWithNewCategory(user, car, "Dashcam");
    await post("/services", user, { vehicle_id: String(bike), ...visit, "line.0.description": "Dashcam for the bike", "line.0.category": "Dashcam" });
    await logWithNewCategory(user, car, "Accessories", "Phone holder");
    await post("/services", user, { vehicle_id: String(car), ...visit, "line.0.description": "Seat covers", "line.0.category": "__new__", "line.0.new_category": "Interior" });
    // Interior's only line moves to Body, leaving it unused.
    const [interior] = await listServices(env.DB, user, car);
    await post(`/services/${interior.id}`, user, { ...visit, "line.0.description": "Seat covers", "line.0.category": "Body" });
    const listed = await profileCategories(user);
    expect([...listed].map(([name, { lines }]) => [name, lines])).toEqual([
      ["Accessories", "1 line"],
      ["Dashcam", "2 lines"],
      ["Interior", "No lines"],
    ]);
  });

  /** A car with a Dashcam line and an Accessories line; returns the user, car and service id. */
  async function carWithTwoOwn() {
    const user = await makeUser();
    const car = await addCar(user);
    await logWithNewCategory(user, car, "Dashcam");
    await logWithNewCategory(user, car, "Accessories", "Phone holder");
    const dashcam = (await profileCategories(user)).get("Dashcam")!.id;
    const lineCategories = async () =>
      Promise.all((await listServices(env.DB, user, car)).map(async (s) => (await getService(env.DB, user, s.id))!.lines[0].category));
    return { user, car, dashcam, lineCategories };
  }

  it("renamed changes it on every line that uses it", async () => {
    const { user, dashcam, lineCategories } = await carWithTwoOwn();
    const res = await post(`/categories/${dashcam}`, user, { name: "Dash camera" });
    expect(res.status).toBe(302);
    expect((await lineCategories()).sort()).toEqual(["Accessories", "Dash camera"]);
    expect([...(await profileCategories(user)).keys()]).toEqual(["Accessories", "Dash camera"]);
  });

  it("can be renamed to a different case of its own name", async () => {
    const { user, dashcam, lineCategories } = await carWithTwoOwn();
    expect((await post(`/categories/${dashcam}`, user, { name: "DashCam" })).status).toBe(302);
    expect((await lineCategories()).sort()).toEqual(["Accessories", "DashCam"]);
  });

  it.each([
    ["", "Dashcam: enter a name for the category."],
    ["accessories", "Dashcam: there&#39;s already a category called Accessories."],
    ["Tyres", "Dashcam: there&#39;s already a category called Tyres."],
  ])("renamed to %j shows an error and changes nothing", async (name, message) => {
    const { user, dashcam, lineCategories } = await carWithTwoOwn();
    const res = await post(`/categories/${dashcam}`, user, { name });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain(`<span class="field-error" id="f-category.${dashcam}-error">${message}</span>`);
    expect(html).toContain(`id="f-category.${dashcam}" type="text" value="${name}"`);
    expect((await lineCategories()).sort()).toEqual(["Accessories", "Dashcam"]);
    expect([...(await profileCategories(user)).keys()]).toEqual(["Accessories", "Dashcam"]);
  });

  it("no line uses is deleted", async () => {
    const { user, car, dashcam } = await carWithTwoOwn();
    const [newest] = await listServices(env.DB, user, car);
    // Move the Dashcam line (the older service) off it first.
    const older = (await listServices(env.DB, user, car)).find((s) => s.id !== newest.id)!;
    await post(`/services/${older.id}`, user, { ...visit, "line.0.description": "Dashcam fitting", "line.0.category": "" });
    const res = await post(`/categories/${dashcam}/delete`, user, {});
    expect(res.status).toBe(302);
    expect([...(await profileCategories(user)).keys()]).toEqual(["Accessories"]);
    expect((await categoryChoices(user, car)).map(([v]) => v)).not.toContain("Dashcam");
  });

  it("that lines still use isn't deleted, with an error saying how many", async () => {
    const { user, car, dashcam, lineCategories } = await carWithTwoOwn();
    await post("/services", user, { vehicle_id: String(car), ...visit, "line.0.description": "SD card", "line.0.category": "Dashcam" });
    const res = await post(`/categories/${dashcam}/delete`, user, {});
    expect(res.status).toBe(409);
    expect(await res.text()).toContain(
      "Dashcam: 2 lines use it. Move them to another category, or none, before deleting it.",
    );
    expect([...(await profileCategories(user)).keys()]).toEqual(["Accessories", "Dashcam"]);
    expect((await lineCategories()).filter((c) => c === "Dashcam")).toHaveLength(2);
  });

  it("built-in categories aren't listed to rename or delete, and can't be", async () => {
    const user = await makeUser();
    expect(await (await get("/profile", user)).text()).not.toContain('class="category-row"');
    expect((await post("/categories/Engine", user, { name: "Motor" })).status).toBe(404);
    expect((await post("/categories/Engine/delete", user, {})).status).toBe(404);
  });

  it("belongs to its owner: another user never sees, uses, renames or deletes it", async () => {
    const { user: alice, car: aliceCar, dashcam, lineCategories } = await carWithTwoOwn();
    const bob = await makeUser("bob@example.com");
    const bobCar = await addCar(bob);
    expect((await categoryChoices(bob, bobCar)).map(([v]) => v)).not.toContain("Dashcam");
    expect(await profileCategories(bob)).toEqual(new Map());

    // Bob can't pick Alice's category by name, but can make his own Dashcam.
    const pick = await post("/services", bob, { vehicle_id: String(bobCar), ...visit, "line.0.description": "Dashcam", "line.0.category": "Dashcam" });
    expect(pick.status).toBe(400);
    expect(await pick.text()).toContain("Dashcam: choose a category from the list.");
    expect((await logWithNewCategory(bob, bobCar, "Dashcam")).status).toBe(302);

    expect((await post(`/categories/${dashcam}`, bob, { name: "Mine" })).status).toBe(404);
    expect((await post(`/categories/${dashcam}/delete`, bob, {})).status).toBe(404);
    expect([...(await profileCategories(alice)).keys()]).toEqual(["Accessories", "Dashcam"]);

    // Renaming Bob's Dashcam leaves Alice's lines alone, and Alice's rename leaves Bob's.
    const bobDashcam = (await profileCategories(bob)).get("Dashcam")!.id;
    expect((await post(`/categories/${bobDashcam}`, bob, { name: "Camera" })).status).toBe(302);
    expect((await lineCategories()).sort()).toEqual(["Accessories", "Dashcam"]);
    expect((await post(`/categories/${dashcam}`, alice, { name: "Cam" })).status).toBe(302);
    const [bobService] = await listServices(env.DB, bob, bobCar);
    expect((await getService(env.DB, bob, bobService.id))!.lines[0].category).toBe("Camera");
    expect(aliceCar).not.toBe(bobCar);
  });

  it("filters the vehicle history, after the built-in ones, and shows on the print history", async () => {
    const { user, car } = await carWithTwoOwn();
    await post("/services", user, { vehicle_id: String(car), ...visit, "line.0.description": "Brake pads", "line.0.category": "Brakes" });
    const page = await (await get(`/vehicles/${car}`, user)).text();
    const offered = [...page.matchAll(/href="\/vehicles\/\d+\?category=([^"#]+)#history"/g)].map((m) => decodeURIComponent(m[1]));
    expect(offered).toEqual(["Brakes", "Accessories", "Dashcam"]);

    const filtered = await (await get(`/vehicles/${car}?category=Dashcam`, user)).text();
    expect(filtered).toContain(`<a href="/vehicles/${car}?category=Dashcam#history" aria-current="page">Dashcam</a>`);
    expect(filtered).toContain("Dashcam fitting");
    expect(filtered).not.toContain("Phone holder");

    const print = await (await get(`/vehicles/${car}/print`, user)).text();
    expect(print).toMatch(/<td>Dashcam fitting<span class="tag category">Dashcam<\/span>/);
  });
});

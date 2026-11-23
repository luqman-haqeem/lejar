import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getService, listServices } from "../src/db";
import { createApp } from "../src/index";
import { itemsOf, makeUser, postForm, sessionHeaders } from "./helpers";

const app = createApp({ now: () => new Date("2026-11-18T02:00:00Z") });
const post = (path: string, userId: number, fields: Record<string, string>) => postForm(app, path, userId, fields);
const get = async (path: string, userId: number) => app.request(path, { headers: await sessionHeaders(userId) }, env);

async function addVehicle(userId: number, type = "car"): Promise<number> {
  const res = await post("/vehicles", userId, { type, name: "Myvi" });
  return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\?added=1$/)![1]);
}

const visit = (vehicleId: number, date = "2026-10-02", km = "84210") => ({
  vehicle_id: String(vehicleId),
  date,
  odometer_km: km,
  workshop: "Tayar Jaya",
  total: "",
});

/** Logs a service and returns its id. */
async function logService(user: number, fields: Record<string, string>): Promise<number> {
  const res = await post("/services", user, fields);
  expect(res.status).toBe(302);
  const id = Number(new URL(res.headers.get("location")!, "http://x").searchParams.get("stamped"));
  return id || (await listServices(env.DB, user, Number(fields.vehicle_id)))[0].id;
}

const categoriesOf = async (user: number, id: number) =>
  (await getService(env.DB, user, id))!.lines.map((l) => [l.description, l.category]);

describe("category on a service line", () => {
  it("is saved with the line and shown on the service view, a line without one showing nothing extra", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const id = await logService(user, {
      ...visit(car),
      "line.0.description": "Bosch wiper blades",
      "line.0.cost": "45",
      "line.0.category": "Wipers",
      "line.1.description": "Labour",
      "line.1.cost": "20",
    });

    expect(await categoriesOf(user, id)).toEqual([
      ["Bosch wiper blades", "Wipers"],
      ["Labour", null],
    ]);
    const html = await (await get(`/services/${id}`, user)).text();
    expect(html.match(/class="tag category"/g)).toHaveLength(1);
    expect(html).toContain('<span class="tag category">Wipers</span>');
  });

  it("shows selected when editing, and can be changed or cleared", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const id = await logService(user, {
      ...visit(car),
      "line.0.description": "Bosch wiper blades",
      "line.0.category": "Wipers",
      "line.1.description": "Fuse",
      "line.1.category": "Electrical",
    });

    const form = await (await get(`/services/${id}/edit`, user)).text();
    expect(form).toContain('<option value="Wipers" selected="">Wipers</option>');

    const res = await post(`/services/${id}`, user, {
      ...visit(car),
      "line.0.description": "Bosch wiper blades",
      "line.0.category": "Body",
      "line.1.description": "Fuse",
      "line.1.category": "",
    });
    expect(res.status).toBe(302);
    expect(await categoriesOf(user, id)).toEqual([
      ["Bosch wiper blades", "Body"],
      ["Fuse", null],
    ]);
  });

  it("rejects a value that isn't in the list, saving nothing", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const res = await post("/services", user, {
      ...visit(car),
      "line.0.description": "Dashcam",
      "line.0.category": "Gadgets",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Dashcam: choose a category from the list.");
    expect(await listServices(env.DB, user, car)).toEqual([]);
  });

  it("is absent on a line saved before categories, which still shows and edits", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const id = await logService(user, { ...visit(car), "line.0.description": "Wiper blades" });
    // As the migration leaves an old row.
    await env.DB.prepare("UPDATE service_lines SET category = NULL WHERE service_id = ?").bind(id).run();

    expect((await get(`/services/${id}`, user)).status).toBe(200);
    const form = await (await get(`/services/${id}/edit`, user)).text();
    expect(form).toMatch(/name="line\.0\.category"[^>]*><option value="">No category<\/option><option value="Engine">/);
  });
});

describe("the category a reminder item gives a line", () => {
  it("is the item's category when none is chosen, unless the owner picked another", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const item = Object.fromEntries((await itemsOf(car)).map((i) => [i.name, String(i.id)]));
    const id = await logService(user, {
      ...visit(car),
      "line.0.item": item["Engine oil"],
      "line.1.item": item["Air filter"],
      "line.2.item": item["Brake fluid"],
      "line.3.item": item["Coolant"],
      "line.3.category": "Other",
    });
    expect(await categoriesOf(user, id)).toEqual([
      ["Engine oil", "Engine"],
      ["Air filter", "Filters"],
      ["Brake fluid", "Brakes"],
      ["Coolant", "Other"],
    ]);
  });

  it("is nothing for an item the owner added or renamed", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const [first] = await itemsOf(car);
    await env.DB.prepare("UPDATE service_items SET name = 'Gearbox flush' WHERE id = ?").bind(first.id).run();
    const id = await logService(user, { ...visit(car), "line.0.item": String(first.id) });
    expect(await categoriesOf(user, id)).toEqual([["Gearbox flush", null]]);
  });

  it("covers every built-in schedule item on cars and motorbikes", async () => {
    for (const type of ["car", "motorbike"]) {
      const user = await makeUser();
      const vehicle = await addVehicle(user, type);
      const items = await itemsOf(vehicle);
      const fields: Record<string, string> = { ...visit(vehicle) };
      items.forEach((i, n) => (fields[`line.${n}.item`] = String(i.id)));
      const id = await logService(user, fields);
      expect((await categoriesOf(user, id)).filter(([, c]) => c === null)).toEqual([]);
    }
  });
});

describe("filtering the vehicle history by category", () => {
  it("offers only the categories the vehicle's lines use", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    await logService(user, { ...visit(car), "line.0.description": "Tyres x4", "line.0.category": "Tyres" });
    await logService(user, { ...visit(car, "2026-10-20", "85000"), "line.0.description": "Wipers", "line.0.category": "Wipers" });

    const html = await (await get(`/vehicles/${car}`, user)).text();
    const offered = [...html.matchAll(/href="\/vehicles\/\d+\?category=([^"#]+)#history"/g)].map((m) => m[1]);
    expect(offered).toEqual(["Tyres", "Wipers"]);
    expect(html).not.toContain('class="lines category-lines"');
  });

  it("lists that category's lines newest first, with the visit and part details, each linking to its service", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const older = await logService(user, {
      ...visit(car, "2025-03-01", "60000"),
      "line.0.description": "Bridgestone Ecopia x2",
      "line.0.cost": "420",
      "line.0.brand": "Bridgestone",
      "line.0.spec": "185/65 R15",
      "line.0.position": "Rear",
      "line.0.category": "Tyres",
      "line.1.description": "Alignment",
      "line.1.category": "Tyres",
      "line.2.description": "Wiper blades",
      "line.2.category": "Wipers",
    });
    const newer = await logService(user, {
      ...visit(car, "2026-10-02", "84210"),
      "line.0.description": "Michelin Primacy 4 x2",
      "line.0.cost": "640",
      "line.0.category": "Tyres",
      "line.1.description": "Labour",
    });

    const html = await (await get(`/vehicles/${car}?category=Tyres`, user)).text();
    const list = html.match(/<ul class="lines category-lines">([\s\S]*?)<\/ul>/)![1];
    const rows = [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, "|").replace(/\|+/g, "|"));
    expect(rows).toEqual([
      "|Michelin Primacy 4 x2|02/10/2026 · 84,210 km · Tayar Jaya|RM 640.00|",
      "|Bridgestone Ecopia x2|Bridgestone · 185/65 R15 · Rear|01/03/2025 · 60,000 km · Tayar Jaya|RM 420.00|",
      "|Alignment|01/03/2025 · 60,000 km · Tayar Jaya|",
    ]);
    expect(list.match(new RegExp(`href="/services/${newer}"`, "g"))).toHaveLength(1);
    expect(list.match(new RegExp(`href="/services/${older}"`, "g"))).toHaveLength(2);
    expect(html).toContain(`<a href="/vehicles/${car}?category=Tyres#history" aria-current="page">Tyres</a>`);
    expect(html).toContain(`href="/vehicles/${car}#history"`);
  });

  it("shows the normal history for a category the vehicle doesn't use, and for an empty history", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    let html = await (await get(`/vehicles/${car}?category=Tyres`, user)).text();
    expect(html).toContain("First stamp goes here");
    expect(html).not.toContain("?category=");

    await logService(user, { ...visit(car), "line.0.description": "Wipers", "line.0.category": "Wipers" });
    html = await (await get(`/vehicles/${car}?category=Tyres`, user)).text();
    expect(html).not.toContain('class="lines category-lines"');
    expect(html).toContain('class="stamps"');
  });

  it("never shows another owner's lines", async () => {
    const owner = await makeUser();
    const car = await addVehicle(owner);
    await logService(owner, { ...visit(car), "line.0.description": "Tyres x4", "line.0.category": "Tyres" });
    const stranger = await makeUser("stranger@example.com");
    expect((await get(`/vehicles/${car}?category=Tyres`, stranger)).status).toBe(404);
  });
});

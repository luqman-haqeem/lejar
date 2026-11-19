import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getService, listServices } from "../src/db";
import { createApp } from "../src/index";
import { makeUser, postForm, sessionHeaders } from "./helpers";

const app = createApp({ now: () => new Date("2026-11-18T02:00:00Z") });
const post = (path: string, userId: number, fields: Record<string, string>) => postForm(app, path, userId, fields);
const get = async (path: string, userId: number) => app.request(path, { headers: await sessionHeaders(userId) }, env);

async function addVehicle(userId: number, type = "car"): Promise<number> {
  const res = await post("/vehicles", userId, { type, name: "Myvi" });
  return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\?added=1$/)![1]);
}

const visit = (vehicleId: number) => ({
  vehicle_id: String(vehicleId),
  date: "2026-10-02",
  odometer_km: "84210",
  workshop: "Tayar Jaya",
  total: "",
});

/** Logs a visit with tyres (full part details), a battery whose warranty has run out, and labour. */
async function logTyresAndBattery(user: number, car: number): Promise<number> {
  const res = await post("/services", user, {
    ...visit(car),
    "line.0.description": "Michelin Primacy 4 x2",
    "line.0.cost": "640",
    "line.0.brand": "Michelin",
    "line.0.spec": "2055516 91v",
    "line.0.position": "Front",
    "line.0.warranty_until": "2028-03-02",
    "line.1.description": "Battery",
    "line.1.cost": "280",
    "line.1.brand": "Amaron",
    "line.1.spec": "NS60",
    "line.1.warranty_until": "2026-05-14",
    "line.2.description": "Labour",
    "line.2.cost": "35",
  });
  expect(res.status).toBe(302);
  const [s] = await listServices(env.DB, user, car);
  return s.id;
}

describe("part details on a service line", () => {
  it("are saved with the line, the spec written the standard way", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const id = await logTyresAndBattery(user, car);

    const service = await getService(env.DB, user, id);
    expect(
      service!.lines.map((l) => [l.description, l.part_brand, l.part_spec, l.part_position, l.warranty_until]),
    ).toEqual([
      ["Michelin Primacy 4 x2", "Michelin", "205/55 R16 91V", "Front", "2028-03-02"],
      ["Battery", "Amaron", "NS60", null, "2026-05-14"],
      ["Labour", null, null, null, null],
    ]);
  });

  it("show as a line under the part on the service and print views, leaving out what's empty", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const id = await logTyresAndBattery(user, car);

    for (const path of [`/services/${id}`, `/vehicles/${car}/print`]) {
      const html = await (await get(path, user)).text();
      expect(html).toContain("Michelin · 205/55 R16 91V · Front · Warranty until 02/03/2028");
      expect(html).toContain("Amaron · NS60 · Warranty expired 14/05/2026");
      expect(html.match(/class="part-details"/g)).toHaveLength(2);
    }
  });

  it("show as a summary on the edit form, with the fields to change them", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const id = await logTyresAndBattery(user, car);

    const html = await (await get(`/services/${id}/edit`, user)).text();
    expect(html).toContain("Michelin · 205/55 R16 91V · Front · Warranty until 02/03/2028");
    expect(html).toMatch(/name="line\.0\.spec"[^>]*value="205\/55 R16 91V"/);
    expect(html).toContain('<option value="Front" selected="">Front</option>');
    expect(html).toMatch(/name="line\.1\.warranty_until"[^>]*value="2026-05-14"/);
    expect(html).toContain("+ Part details"); // the labour line has none
  });

  it("are cleared when edited away", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);
    const id = await logTyresAndBattery(user, car);

    const res = await post(`/services/${id}`, user, {
      ...visit(car),
      "line.0.description": "Michelin Primacy 4 x2",
      "line.0.cost": "640",
    });
    expect(res.status).toBe(302);
    const [line] = (await getService(env.DB, user, id))!.lines;
    expect([line.part_brand, line.part_spec, line.part_position, line.warranty_until]).toEqual([null, null, null, null]);
  });

  it("refuses a warranty date that isn't a date and a position that isn't on the list, keeping what was typed", async () => {
    const user = await makeUser();
    const car = await addVehicle(user);

    const res = await post("/services", user, {
      ...visit(car),
      "line.0.description": "Tyres",
      "line.0.brand": "Michelin",
      "line.0.position": "Middle",
      "line.0.warranty_until": "2028-13-40",
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Tyres: warranty until isn&#39;t a valid date.");
    expect(html).toContain("Tyres: choose a position from the list.");
    expect(html).toMatch(/name="line\.0\.brand"[^>]*value="Michelin"/);
    expect(await listServices(env.DB, user, car)).toEqual([]);
  });

  it("offers motorbikes only All, Front and Rear", async () => {
    const user = await makeUser();
    const bike = await addVehicle(user, "motorbike");

    const form = await (await get(`/services/new?vehicle=${bike}`, user)).text();
    expect(form).toContain('<option value="Rear">Rear</option>');
    expect(form).not.toContain("Front left");

    const res = await post("/services", user, {
      ...visit(bike),
      "line.0.description": "Tyre",
      "line.0.position": "Rear left",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Tyre: choose a position from the list.");
  });
});

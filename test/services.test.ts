import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getService, lastDoneByItem, listReadings, listServices } from "../src/db";
import { createApp } from "../src/index";
import { itemsOf, makeUser, postForm, sessionHeaders } from "./helpers";

const app = createApp();
const post = (path: string, userId: number, fields: Record<string, string>) => postForm(app, path, userId, fields);
const get = async (path: string, userId: number) => app.request(path, { headers: await sessionHeaders(userId) }, env);

async function addCar(userId: number, name = "Myvi"): Promise<number> {
  const res = await post("/vehicles", userId, { type: "car", name });
  return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\?added=1$/)![1]);
}

/** Logs a service through the form and returns the response. */
function logService(userId: number, vehicleId: number, fields: Record<string, string>) {
  return post("/services", userId, { vehicle_id: String(vehicleId), ...fields });
}

async function logged(userId: number, vehicleId: number, fields: Record<string, string>): Promise<void> {
  const res = await logService(userId, vehicleId, fields);
  if (res.status !== 302) throw new Error(`service not saved: ${res.status} ${await res.text()}`);
}

describe("logging a service", () => {
  it("lets each line reset a reminder, with no reminder as a named choice", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const html = await (await get(`/services/new?vehicle=${car}`, user)).text();
    expect(html).toContain("<span>Resets reminder</span>");
    expect(html).toContain('<option value="">No reminder</option>');
    expect(html).not.toContain("Schedule item");
    expect(html).not.toMatch(/name="line\.0\.item"><option value="">—<\/option>/);
  });

  it("saves the visit, its lines and an odometer reading, then opens the vehicle's history", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const [engineOil] = await itemsOf(car);

    const res = await logService(user, car, {
      date: "2026-03-14",
      odometer_km: "52,310",
      workshop: "Bengkel Ah Seng",
      total: "RM 1,234.5",
      notes: "Asked to check aircond",
      "line.0.description": "Engine oil 5W-30",
      "line.0.cost": "180",
      "line.0.item": String(engineOil.id),
      "line.1.description": "Labour",
      "line.1.cost": "",
      "line.1.item": "",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(new RegExp(`^/vehicles/${car}\\?stamped=\\d+$`));
    const [summary] = await listServices(env.DB, user, car);
    const service = await getService(env.DB, user, summary.id);
    expect(service).toMatchObject({
      vehicle_id: car,
      date: "2026-03-14",
      odometer_km: 52310,
      workshop: "Bengkel Ah Seng",
      total_sen: 123450,
      notes: "Asked to check aircond",
    });
    expect(service!.lines.map((l) => [l.description, l.cost_sen, l.service_item_id])).toEqual([
      ["Engine oil 5W-30", 18000, engineOil.id],
      ["Labour", null, null],
    ]);
    expect((await listReadings(env.DB, user, car)).map((r) => [r.date, r.km, r.source])).toEqual([
      ["2026-03-14", 52310, "service"],
    ]);
  });

  it("totals the line costs when the total is left blank", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    await logged(user, car, {
      date: "2026-03-14",
      odometer_km: "50000",
      "line.0.description": "Oil",
      "line.0.cost": "120.50",
      "line.1.description": "Filter",
      "line.1.cost": "RM 25",
    });
    expect((await listServices(env.DB, user, car))[0].total_sen).toBe(14550);
  });

  it("accepts an old paper record from years back", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    await logged(user, car, { date: "01/05/2019", odometer_km: "12000", total: "85" });
    expect((await listServices(env.DB, user, car))[0]).toMatchObject({ date: "2019-05-01", total_sen: 8500 });
  });

  it("refuses bad amounts, a future date and a missing odometer, keeping what was typed", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const res = await logService(user, car, {
      date: "2099-01-01",
      odometer_km: "",
      workshop: "Ah Seng",
      total: "-5",
      "line.0.description": "Oil",
      "line.0.cost": "abc",
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("The service date can&#39;t be in the future.");
    expect(html).toContain("Enter the odometer reading.");
    expect(html).toContain("Total must be an amount like 85 or RM 1,234.50.");
    expect(html).toContain("Oil: cost must be an amount like 85 or RM 1,234.50.");
    expect(html).toContain('value="Ah Seng"');
    expect(html).toContain('value="abc"');
    expect(await listServices(env.DB, user, car)).toEqual([]);
  });
});

describe("odometer readings that don't fit", () => {
  async function carWithReadings() {
    const user = await makeUser();
    const car = await addCar(user);
    await logged(user, car, { date: "2026-01-01", odometer_km: "40000", total: "100" });
    await logged(user, car, { date: "2026-06-01", odometer_km: "49000", total: "100" });
    return { user, car };
  }

  it("accepts a backdated reading that sits between its neighbours", async () => {
    const { user, car } = await carWithReadings();
    expect((await logService(user, car, { date: "2026-03-01", odometer_km: "45000", total: "1" })).status).toBe(302);
  });

  it("refuses a reading higher than a later one, keeps the form, and saves nothing", async () => {
    const { user, car } = await carWithReadings();
    const res = await logService(user, car, {
      date: "2026-03-01",
      odometer_km: "50000",
      workshop: "Ah Seng",
      total: "95",
      "line.0.description": "Oil",
    });
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Odometer 50,000 km conflicts with 01/06/2026 reading of 49,000 km");
    expect(html).toContain('value="Ah Seng"');
    expect(html).toContain('value="95"');
    expect(html).toContain('value="Oil"');
    expect(await listServices(env.DB, user, car)).toHaveLength(2);
    expect(await listReadings(env.DB, user, car)).toHaveLength(2);
  });

  it("refuses a reading lower than an earlier one", async () => {
    const { user, car } = await carWithReadings();
    const res = await logService(user, car, { date: "2026-07-01", odometer_km: "39000", total: "1" });
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("Odometer 39,000 km conflicts with 01/06/2026 reading of 49,000 km");
  });

  it("checks a manual reading the same way", async () => {
    const { user, car } = await carWithReadings();
    const bad = await post(`/vehicles/${car}/readings`, user, { date: "2026-07-01", km: "48000" });
    expect(bad.status).toBe(422);
    expect(await bad.text()).toContain("Odometer 48,000 km conflicts with 01/06/2026 reading of 49,000 km");

    const good = await post(`/vehicles/${car}/readings`, user, { date: "2026-07-01", km: "50,500" });
    expect(good.status).toBe(302);
    expect(good.headers.get("location")).toBe(`/vehicles/${car}`);
    expect((await listReadings(env.DB, user, car)).at(-1)).toMatchObject({ date: "2026-07-01", km: 50500, source: "manual" });
  });

  it("refuses a same-day reading that's over 1,000 km away from another that day", async () => {
    const { user, car } = await carWithReadings();
    const typo = await post(`/vehicles/${car}/readings`, user, { date: "2026-06-01", km: "490000" });
    expect(typo.status).toBe(422);
    expect(await typo.text()).toContain("Odometer 490,000 km conflicts with 01/06/2026 reading of 49,000 km");

    const sameDayTrip = await post(`/vehicles/${car}/readings`, user, { date: "2026-06-01", km: "49900" });
    expect(sameDayTrip.status).toBe(302);
    expect((await post(`/vehicles/${car}/readings`, user, { date: "2026-06-01", km: "50001" })).status).toBe(422);
  });

  it("doesn't count a service's own reading against it when editing", async () => {
    const { user, car } = await carWithReadings();
    const [latest] = await listServices(env.DB, user, car);
    const res = await post(`/services/${latest.id}`, user, { date: "2026-06-01", odometer_km: "49500", total: "100" });
    expect(res.status).toBe(302);
    expect((await listReadings(env.DB, user, car)).map((r) => r.km)).toEqual([40000, 49500]);
  });
});

describe("entering a backlog", () => {
  it("'Save & add another' opens a fresh form for the same vehicle and workshop", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const res = await logService(user, car, {
      date: "2019-05-01",
      odometer_km: "12000",
      workshop: "Bengkel Ah Seng & Sons",
      total: "85",
      action: "save_add",
    });
    expect(res.status).toBe(302);
    const next = new URL(res.headers.get("location")!, "https://kereta.test");
    expect(next.pathname).toBe("/services/new");
    expect(next.searchParams.get("vehicle")).toBe(String(car));
    expect(next.searchParams.get("workshop")).toBe("Bengkel Ah Seng & Sons");

    const form = await (await get(`${next.pathname}${next.search}`, user)).text();
    expect(form).toContain('value="Bengkel Ah Seng &amp; Sons"');
    expect(form).toContain(`name="vehicle_id" value="${car}"`);
    expect(form).toMatch(/name="date"[^>]*value=""/);
    expect(await listServices(env.DB, user, car)).toHaveLength(1);
  });
});

describe("the vehicle's history", () => {
  it("lists services newest first with totals per year", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    await logged(user, car, { date: "2025-02-10", odometer_km: "30000", workshop: "Old Shop", total: "200" });
    await logged(user, car, { date: "2026-08-20", odometer_km: "45000", workshop: "Newest Shop", total: "1,000.50" });
    await logged(user, car, { date: "2026-01-05", odometer_km: "38000", workshop: "Middle Shop", total: "34" });

    const res = await get(`/vehicles/${car}`, user);
    expect(res.status).toBe(200);
    const html = await res.text();
    const order = ["Newest Shop", "Middle Shop", "Old Shop"].map((w) => html.indexOf(w));
    expect(order.every((pos, i) => pos > 0 && (i === 0 || pos > order[i - 1]))).toBe(true);
    expect(html).toContain("20/08/2026");
    expect(html).toContain("45,000 km");
    expect(html).toMatch(/2026<\/dt><dd>RM 1,034.50</);
    expect(html).toMatch(/2025<\/dt><dd>RM 200.00</);
  });

  it("opens from the dashboard", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const html = await (await get("/", user)).text();
    expect(html).toContain(`href="/vehicles/${car}"`);
  });
});

describe("a logged service", () => {
  async function serviceWithLines() {
    const user = await makeUser();
    const car = await addCar(user);
    const items = await itemsOf(car);
    await logged(user, car, {
      date: "2026-03-14",
      odometer_km: "52000",
      workshop: "Ah Seng",
      total: "200",
      "line.0.description": "Engine oil",
      "line.0.cost": "150",
      "line.0.item": String(items[0].id),
      "line.1.description": "Labour",
      "line.1.cost": "50",
    });
    const [{ id }] = await listServices(env.DB, user, car);
    return { user, car, id, items };
  }

  it("shows its details and lines", async () => {
    const { user, id } = await serviceWithLines();
    const res = await get(`/services/${id}`, user);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("14/03/2026");
    expect(html).toContain("52,000 km");
    expect(html).toContain("RM 200.00");
    expect(html).toContain("Labour");
    expect(html).toContain("RM 150.00");
  });

  it("can be edited, replacing its lines and moving its reading", async () => {
    const { user, car, id, items } = await serviceWithLines();
    const editForm = await (await get(`/services/${id}/edit`, user)).text();
    expect(editForm).toContain('value="Engine oil"');
    expect(editForm).toContain('value="150.00"');

    const res = await post(`/services/${id}`, user, {
      date: "2026-03-15",
      odometer_km: "52100",
      workshop: "Ah Seng",
      total: "",
      "line.0.description": "",
      "line.0.cost": "160",
      "line.0.item": String(items[1].id),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`/services/${id}`);
    const service = await getService(env.DB, user, id);
    expect(service).toMatchObject({ date: "2026-03-15", odometer_km: 52100, total_sen: 16000 });
    expect(service!.lines.map((l) => [l.description, l.cost_sen, l.service_item_id])).toEqual([
      ["Oil filter", 16000, items[1].id],
    ]);
    expect((await listReadings(env.DB, user, car)).map((r) => [r.date, r.km])).toEqual([["2026-03-15", 52100]]);
  });

  it("can be deleted, taking its lines and reading with it", async () => {
    const { user, car, id } = await serviceWithLines();
    const res = await post(`/services/${id}/delete`, user, {});
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`/vehicles/${car}`);
    expect(await getService(env.DB, user, id)).toBeNull();
    expect(await listReadings(env.DB, user, car)).toEqual([]);
    const orphanLines = await env.DB.prepare("SELECT count(*) AS n FROM service_lines WHERE service_id = ?")
      .bind(id)
      .first<{ n: number }>();
    expect(orphanLines?.n).toBe(0);
  });

  it("keeps its line when the linked item is removed from the schedule", async () => {
    const { user, car, id, items } = await serviceWithLines();
    const form: Record<string, string> = { type: "car", name: "Myvi" };
    items.slice(1).forEach((i, n) => {
      form[`item.${n}.id`] = String(i.id);
      form[`item.${n}.name`] = i.name;
      form[`item.${n}.months`] = String(i.interval_months);
    });
    expect((await post(`/vehicles/${car}`, user, form)).status).toBe(302);
    const service = await getService(env.DB, user, id);
    expect(service!.lines.map((l) => [l.description, l.service_item_id])).toEqual([
      ["Engine oil", null],
      ["Labour", null],
    ]);
  });
});

describe("someone else's vehicle and services", () => {
  it("are 404 to view, edit, delete, log against or add readings to, and nothing changes", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const car = await addCar(alice);
    await logged(alice, car, { date: "2026-03-14", odometer_km: "52000", total: "200", "line.0.description": "Oil" });
    const [{ id }] = await listServices(env.DB, alice, car);
    const before = { service: await getService(env.DB, alice, id), readings: await listReadings(env.DB, alice, car) };
    const edit = { date: "2026-03-14", odometer_km: "1", total: "1" };

    expect((await get(`/services/${id}`, bob)).status).toBe(404);
    expect((await get(`/services/${id}/edit`, bob)).status).toBe(404);
    expect((await post(`/services/${id}`, bob, edit)).status).toBe(404);
    expect((await post(`/services/${id}/delete`, bob, {})).status).toBe(404);
    expect((await get(`/vehicles/${car}`, bob)).status).toBe(404);
    expect((await get(`/services/new?vehicle=${car}`, bob)).status).toBe(404);
    expect((await logService(bob, car, { date: "2026-04-01", odometer_km: "60000", total: "1" })).status).toBe(404);
    expect((await post(`/vehicles/${car}/readings`, bob, { date: "2026-04-01", km: "60000" })).status).toBe(404);

    expect(await getService(env.DB, alice, id)).toEqual(before.service);
    expect(await listServices(env.DB, alice, car)).toHaveLength(1);
    expect(await listReadings(env.DB, alice, car)).toEqual(before.readings);
  });

  it("is 404 to tag on your own service, and nothing is saved", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const alicesItem = (await itemsOf(await addCar(alice)))[0];
    const bobsCar = await addCar(bob);
    const line = { "line.0.description": "Oil", "line.0.item": String(alicesItem.id) };

    const res = await logService(bob, bobsCar, { date: "2026-03-14", odometer_km: "1000", total: "1", ...line });
    expect(res.status).toBe(404);
    expect(await listServices(env.DB, bob, bobsCar)).toEqual([]);
    expect(await listReadings(env.DB, bob, bobsCar)).toEqual([]);

    await logged(bob, bobsCar, { date: "2026-03-14", odometer_km: "1000", total: "1", "line.0.description": "Oil" });
    const [{ id }] = await listServices(env.DB, bob, bobsCar);
    const before = await getService(env.DB, bob, id);
    expect((await post(`/services/${id}`, bob, { date: "2026-03-14", odometer_km: "1000", total: "9", ...line })).status).toBe(404);
    expect(await getService(env.DB, bob, id)).toEqual(before);
  });
});

describe("fixing a mistyped reading", () => {
  it("lets the owner delete a manual reading that blocks later entries", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    await post(`/vehicles/${car}/readings`, user, { date: "2026-06-01", km: "490000" });
    expect((await logService(user, car, { date: "2026-07-01", odometer_km: "50000", total: "1" })).status).toBe(422);

    const [typo] = await listReadings(env.DB, user, car);
    expect(await (await get(`/vehicles/${car}`, user)).text()).toContain("490,000 km");
    const res = await post(`/readings/${typo.id}/delete`, user, {});
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`/vehicles/${car}`);
    expect(await listReadings(env.DB, user, car)).toEqual([]);
    expect((await logService(user, car, { date: "2026-07-01", odometer_km: "50000", total: "1" })).status).toBe(302);
  });

  it("won't delete a service's reading (edit the service instead) or someone else's", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const car = await addCar(alice);
    await logged(alice, car, { date: "2026-03-01", odometer_km: "40000", total: "1" });
    await post(`/vehicles/${car}/readings`, alice, { date: "2026-04-01", km: "41000" });
    const [fromService, manual] = await listReadings(env.DB, alice, car);

    expect((await post(`/readings/${fromService.id}/delete`, alice, {})).status).toBe(404);
    expect((await post(`/readings/${manual.id}/delete`, bob, {})).status).toBe(404);
    expect(await listReadings(env.DB, alice, car)).toHaveLength(2);
  });
});

describe("when each schedule item was last done", () => {
  it("is the latest service with a line linked to it, whatever order they were entered in", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const [engineOil, oilFilter] = await itemsOf(car);
    const oilChange = (date: string, km: string, ...items: number[]) =>
      logged(user, car, {
        date,
        odometer_km: km,
        total: "1",
        ...Object.fromEntries(items.flatMap((id, n) => [[`line.${n}.item`, String(id)]])),
      });
    await oilChange("2026-06-01", "50000", engineOil.id, oilFilter.id);
    await oilChange("2025-12-01", "40000", engineOil.id); // backlog entered later
    await oilChange("2026-09-01", "55000", engineOil.id);

    const last = await lastDoneByItem(env.DB, user, car);
    expect(last.get(engineOil.id)).toEqual({ date: "2026-09-01", km: 55000 });
    expect(last.get(oilFilter.id)).toEqual({ date: "2026-06-01", km: 50000 });
    expect(last.size).toBe(2);
    expect((await lastDoneByItem(env.DB, await makeUser(), car)).size).toBe(0);
  });
});

describe("the odometer hint on the service form", () => {
  /** The hint text under the Odometer field, or null when there is none. */
  const hintIn = (html: string) => html.match(/<p class="field-hint" id="odometer-hint"[^>]*>([^<]*)<\/p>/)?.[1] ?? null;
  const newForm = async (user: number, car: number) => (await get(`/services/new?vehicle=${car}`, user)).text();

  it("shows the latest reading and its date on a new form", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    await logged(user, car, { date: "2026-01-01", odometer_km: "40000", total: "1" });
    await logged(user, car, { date: "2026-06-01", odometer_km: "52000", total: "1" });
    expect(hintIn(await newForm(user, car))).toBe("Last: 52,000 km · 01/06/2026");
  });

  /** A vehicle with readings on 1 Jan (40,000), 1 Mar (45,200 manual) and 1 Jun 2026 (52,000). */
  async function carWithReadings(user: number) {
    const car = await addCar(user);
    await logged(user, car, { date: "2026-01-01", odometer_km: "40000", total: "1" });
    await post(`/vehicles/${car}/readings`, user, { date: "2026-03-01", km: "45200" });
    await logged(user, car, { date: "2026-06-01", odometer_km: "52000", total: "1" });
    return car;
  }
  const editForm = async (user: number, car: number, date: string, km: string) => {
    await logged(user, car, { date, odometer_km: km, total: "1" });
    const service = (await listServices(env.DB, user, car)).find((s) => s.date === date && s.odometer_km === Number(km))!;
    return (await get(`/services/${service.id}/edit`, user)).text();
  };

  it("shows the readings either side of an edited Service's date", async () => {
    const user = await makeUser();
    const car = await carWithReadings(user);
    expect(hintIn(await editForm(user, car, "2026-04-15", "48000"))).toBe("Between 45,200 and 52,000 km");
  });

  it("shows the upper limit for an edited Service older than every other reading", async () => {
    const user = await makeUser();
    const car = await carWithReadings(user);
    expect(hintIn(await editForm(user, car, "2025-06-01", "30000"))).toBe("Under 40,000 km");
  });

  it("shows a manual reading on the same day as the edited Service, the highest if several", async () => {
    const user = await makeUser();
    const car = await carWithReadings(user);
    await post(`/vehicles/${car}/readings`, user, { date: "2026-03-01", km: "45500" });
    expect(hintIn(await editForm(user, car, "2026-03-01", "45300"))).toBe("Same day: 45,500 km");
  });

  it("leaves out the edited Service's own reading", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const html = await editForm(user, car, "2026-03-01", "45000");
    expect(html).not.toContain("odometer-hint");
  });

  it("re-shows the hint for the posted date after a failed save", async () => {
    const user = await makeUser();
    const car = await carWithReadings(user);
    const res = await logService(user, car, { date: "2025-12-01", odometer_km: "41000", total: "1" });
    expect(res.status).toBe(422);
    expect(hintIn(await res.text())).toBe("Under 40,000 km");
  });

  it("uses only this vehicle's readings", async () => {
    const user = await makeUser();
    const car = await carWithReadings(user);
    const other = await addCar(user, "Axia");
    await post(`/vehicles/${other}/readings`, user, { date: "2026-07-01", km: "90000" });
    expect(hintIn(await newForm(user, car))).toBe("Last: 52,000 km · 01/06/2026");
    expect(hintIn(await newForm(user, other))).toBe("Last: 90,000 km · 01/07/2026");
  });

  it("is plain text linked to the Odometer field, never an estimate or a copy button", async () => {
    const user = await makeUser();
    const car = await carWithReadings(user);
    const html = await newForm(user, car);
    expect(html).toMatch(/<input name="odometer_km" id="f-odometer_km"[^>]*aria-describedby="odometer-hint"/);
    expect(html).not.toMatch(/<button[^>]*odometer|estimat/i);
  });

  it("carries the hint for every date range, agreeing with the rendered wording", async () => {
    const user = await makeUser();
    const car = await carWithReadings(user);
    const html = await editForm(user, car, "2026-04-15", "48000");
    const json = html.match(/data-odometer-hints="([^"]*)"/)![1].replaceAll("&quot;", '"').replaceAll("&amp;", "&");
    const lookup = JSON.parse(json) as { before: string; dates: [string, string, string][] };
    // The edited Service's own reading (15 Apr) is left out of the lookup too.
    expect(lookup).toEqual({
      before: "Under 40,000 km",
      dates: [
        ["2026-01-01", "Same day: 40,000 km", "Between 40,000 and 45,200 km"],
        ["2026-03-01", "Same day: 45,200 km", "Between 45,200 and 52,000 km"],
        ["2026-06-01", "Same day: 52,000 km", "Last: 52,000 km · 01/06/2026"],
      ],
    });
    expect(lookup.dates[1][2]).toBe(hintIn(html));
  });

  it("matches the scanned date on a scanned receipt's form", async () => {
    const user = await makeUser();
    const car = await carWithReadings(user);
    const aiFetch = (async () =>
      Response.json({ choices: [{ message: { content: JSON.stringify({ date: "2026-02-10", odometer_km: 42000, total: 1, lines: [] }) } }] })) as unknown as typeof fetch;
    const scanApp = createApp({ now: () => new Date("2026-11-18T02:00:00Z"), aiFetch });
    const form = new FormData();
    form.append("vehicle", String(car));
    form.append("photo", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 0xff, 0xd9])], "r.jpg", { type: "image/jpeg" }));
    const encoded = new Request("https://lejar.test", { method: "POST", body: form });
    const body = await encoded.arrayBuffer();
    const headers = { ...(await sessionHeaders(user)), "content-type": encoded.headers.get("content-type")!, "content-length": String(body.byteLength) };
    const res = await scanApp.request("/scan", { method: "POST", headers, body }, env);
    expect(res.status).toBe(200);
    expect(hintIn(await res.text())).toBe("Between 40,000 and 45,200 km");
  });

  it("shows no hint for a vehicle with no readings", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const html = await newForm(user, car);
    expect(html).not.toContain("odometer-hint");
  });
});

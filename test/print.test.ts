import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { itemsOf, makeUser, postForm, sessionHeaders } from "./helpers";

const app = createApp({ now: () => new Date("2026-11-18T02:00:00Z") });
const post = (path: string, userId: number, fields: Record<string, string>) => postForm(app, path, userId, fields);
const get = async (path: string, userId: number) => app.request(path, { headers: await sessionHeaders(userId) }, env);

async function addCar(userId: number): Promise<number> {
  const res = await post("/vehicles", userId, {
    type: "car",
    name: "Myvi",
    plate: "WXY 1234",
    make: "Perodua",
    model: "Myvi 1.5 AV",
    year: "2019",
  });
  return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\?added=1$/)![1]);
}

async function carWithHistory() {
  const user = await makeUser();
  const car = await addCar(user);
  await post("/services", user, {
    vehicle_id: String(car),
    date: "2025-03-10",
    odometer_km: "30000",
    workshop: "Bengkel Ah Seng",
    total: "200",
    notes: "Owner mentioned aircond smell",
    "line.0.description": "Minyak hitam 4L",
    "line.0.cost": "150",
    "line.1.description": "Labour",
    "line.1.cost": "50",
  });
  await post("/services", user, {
    vehicle_id: String(car),
    date: "2026-09-02",
    odometer_km: "52310",
    workshop: "Perodua Service Centre",
    total: "1,034.50",
    "line.0.description": "Brake pads",
  });
  return { user, car };
}

describe("the printable history", () => {
  it("has the vehicle header, the date it was generated, and every service with its lines", async () => {
    const { user, car } = await carWithHistory();
    const res = await get(`/vehicles/${car}/print`, user);
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const text of ["Myvi", "WXY 1234", "Perodua Myvi 1.5 AV 2019", "Generated 18/11/2026"]) expect(html).toContain(text);
    for (const text of ["Bengkel Ah Seng", "Perodua Service Centre", "Minyak hitam 4L", "Labour", "Brake pads"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("10/03/2025");
    expect(html).toContain("52,310 km");
    expect(html).toContain("RM 150.00");
    expect(html).toMatch(/Grand total[^]*?RM 1,234.50/);
  });

  it("lists services oldest first, as a service book reads", async () => {
    const { user, car } = await carWithHistory();
    const html = await (await get(`/vehicles/${car}/print`, user)).text();
    expect(html.indexOf("Bengkel Ah Seng")).toBeLessThan(html.indexOf("Perodua Service Centre"));
  });

  it("has a Print / Save as PDF button that the print stylesheet hides, with no app navigation", async () => {
    const { user, car } = await carWithHistory();
    const html = await (await get(`/vehicles/${car}/print`, user)).text();
    expect(html).toContain('href="/print.css"');
    expect(html).toMatch(/<button[^>]*class="[^"]*no-print[^"]*"[^>]*data-print[^>]*>Print \/ Save as PDF<\/button>/);
    expect(html).not.toContain('action="/logout"');
  });

  it("never shows a baseline", async () => {
    const { user, car } = await carWithHistory();
    const form: Record<string, string> = { type: "car", name: "Myvi", plate: "WXY 1234" };
    (await itemsOf(car)).forEach((i, n) => {
      form[`item.${n}.id`] = String(i.id);
      form[`item.${n}.name`] = i.name;
      form[`item.${n}.months`] = String(i.interval_months);
      form[`item.${n}.baseline_date`] = "2025-11-01";
      form[`item.${n}.baseline_km`] = "41234";
    });
    expect((await post(`/vehicles/${car}`, user, form)).status).toBe(302);
    const html = await (await get(`/vehicles/${car}/print`, user)).text();
    expect(html).not.toContain("01/11/2025");
    expect(html).not.toContain("2025-11-01");
    expect(html).not.toContain("41,234");
  });

  it("leaves out private notes", async () => {
    const { user, car } = await carWithHistory();
    expect(await (await get(`/vehicles/${car}/print`, user)).text()).not.toContain("aircond smell");
  });

  it("is linked from the vehicle's page", async () => {
    const { user, car } = await carWithHistory();
    expect(await (await get(`/vehicles/${car}`, user)).text()).toContain(`href="/vehicles/${car}/print"`);
  });

  it("is 404 for another user", async () => {
    const { car } = await carWithHistory();
    expect((await get(`/vehicles/${car}/print`, await makeUser())).status).toBe(404);
  });
});

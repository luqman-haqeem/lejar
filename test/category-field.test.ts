import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getService, listServices } from "../src/db";
import { createApp } from "../src/index";
import { makeUser, postForm, sessionHeaders } from "./helpers";

const app = createApp({ now: () => new Date("2026-11-18T02:00:00Z") });
const post = (path: string, userId: number, fields: Record<string, string>) => postForm(app, path, userId, fields);
const get = async (path: string, userId: number) => app.request(path, { headers: await sessionHeaders(userId) }, env);

async function addCar(userId: number): Promise<number> {
  const res = await post("/vehicles", userId, { type: "car", name: "Myvi" });
  return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\?added=1$/)![1]);
}

const visit = { date: "2026-10-02", odometer_km: "84210", workshop: "Ah Seng", total: "" };

describe("a category on a service line", () => {
  it("is an optional choice from the built-in list (or a new one) on each line, beside Resets reminder", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const html = await (await get(`/services/new?vehicle=${car}`, user)).text();
    const select = html.match(/<select name="line\.0\.category"[^>]*>(.*?)<\/select>/)?.[1];
    expect(select).toBeDefined();
    expect([...select!.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)</g)].map((m) => [m[1], m[2]])).toEqual([
      ["", "No category"],
      ...["Engine", "Filters", "Brakes", "Tyres", "Battery", "Wipers", "Suspension", "Electrical", "Body", "Other"].map((c) => [c, c]),
      ["__new__", "New category…"],
    ]);
    expect(html).toMatch(/<span>Category<\/span>[\s\S]*?line\.0\.category[\s\S]*?<span>Resets reminder<\/span>/);
  });

  /** Logs wiper blades on No reminder with a category, and labour with none; returns the service id. */
  async function logWipersAndLabour(user: number, car: number): Promise<number> {
    const res = await post("/services", user, {
      vehicle_id: String(car),
      ...visit,
      "line.0.description": "Wiper blades (DIY)",
      "line.0.cost": "45",
      "line.0.item": "",
      "line.0.category": "Wipers",
      "line.1.description": "Labour",
      "line.1.cost": "20",
      "line.1.category": "",
    });
    expect(res.status).toBe(302);
    return (await listServices(env.DB, user, car))[0].id;
  }

  it("is saved with the line, even one that resets no reminder", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const id = await logWipersAndLabour(user, car);
    const service = await getService(env.DB, user, id);
    expect(service!.lines.map((l) => [l.description, l.service_item_id, l.category])).toEqual([
      ["Wiper blades (DIY)", null, "Wipers"],
      ["Labour", null, null],
    ]);
  });

  it("shows on the service view, and a line without one shows nothing extra", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const html = await (await get(`/services/${await logWipersAndLabour(user, car)}`, user)).text();
    expect(html).toContain('Wiper blades (DIY)<span class="tag category">Wipers</span>');
    const labour = html.match(/<li><span>Labour(.*?)<\/span>/)![1];
    expect(labour).toBe("");
  });

  it("is selected when editing, and can be changed or cleared", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const id = await logWipersAndLabour(user, car);
    const form = await (await get(`/services/${id}/edit`, user)).text();
    expect(form).toMatch(/name="line\.0\.category"[^>]*>.*?<option value="Wipers" selected="">/);

    const edit = (line0: string, line1: string) =>
      post(`/services/${id}`, user, {
        ...visit,
        "line.0.description": "Wiper blades (DIY)",
        "line.0.category": line0,
        "line.1.description": "Labour",
        "line.1.category": line1,
      });
    expect((await edit("", "Other")).status).toBe(302);
    expect((await getService(env.DB, user, id))!.lines.map((l) => l.category)).toEqual([null, "Other"]);
  });

  it("refuses a category that isn't on the list, keeping the form and saving nothing", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const res = await post("/services", user, {
      vehicle_id: String(car),
      ...visit,
      "line.0.description": "Wiper blades",
      "line.0.category": "Spaceship",
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Wiper blades: choose a category from the list.");
    expect(html).toMatch(/<label class="field invalid"><span>Category<\/span><select name="line\.0\.category" id="f-line\.0\.category"/);
    expect(await listServices(env.DB, user, car)).toEqual([]);
  });

  it("is absent on a line saved before categories, which still shows and edits", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    // A line from before categories: posted with no category field at all.
    await post("/services", user, { vehicle_id: String(car), ...visit, "line.0.description": "Engine oil", "line.0.cost": "120" });
    const [{ id }] = await listServices(env.DB, user, car);
    expect((await getService(env.DB, user, id))!.lines[0].category).toBeNull();
    const view = await (await get(`/services/${id}`, user)).text();
    expect(view).not.toContain('class="tag category"');
    const form = await (await get(`/services/${id}/edit`, user)).text();
    expect(form).toMatch(/name="line\.0\.category"[^>]*><option value="">No category<\/option>/);
    expect(form).not.toMatch(/name="line\.0\.category"[^>]*>.*?selected=""/);
  });
});

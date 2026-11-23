import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getService, listServices } from "../src/db";
import { createApp } from "../src/index";
import { itemsOf, makeUser, sessionHeaders } from "./helpers";

const NOW = () => new Date("2026-11-18T02:00:00Z");
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 0xff, 0xd9]);
const photo = (bytes: Uint8Array = JPEG, type = "image/jpeg") => new File([bytes], "receipt.jpg", { type });

/** An app whose OpenRouter replies with `content` (or fails with `status`), counting calls. */
function appReplying(content: string, status = 200) {
  const calls: Request[] = [];
  const aiFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new Request(input, init));
    return status === 200
      ? Response.json({ choices: [{ message: { content } }] })
      : new Response("error", { status });
  }) as typeof fetch;
  return { app: createApp({ now: NOW, aiFetch }), calls };
}

const READ = JSON.stringify({
  date: "2026-09-02",
  odometer_km: 52310,
  workshop: null,
  total: 245,
  lines: [
    { description: "Minyak hitam 4L", cost: 180 },
    { description: "Penapis minyak", cost: 30 },
    { description: "Wiper blade", cost: null },
  ],
});

type App = ReturnType<typeof createApp>;

async function addCar(app: App, userId: number, name = "Myvi"): Promise<number> {
  const res = await app.request(
    "/vehicles",
    { method: "POST", headers: await sessionHeaders(userId), body: new URLSearchParams({ type: "car", name }) },
    env,
  );
  return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\?added=1$/)![1]);
}

async function scan(app: App, userId: number, fields: Record<string, string | File>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const encoded = new Request("https://kereta.test", { method: "POST", body: form });
  const body = await encoded.arrayBuffer();
  const headers = {
    ...(await sessionHeaders(userId)),
    "content-type": encoded.headers.get("content-type")!,
    "content-length": String(body.byteLength),
  };
  return app.request("/scan", { method: "POST", headers, body }, env);
}

const storedKeys = async (userId: number) =>
  (await env.RECEIPTS.list({ prefix: `receipts/${userId}/` })).objects.map((o) => o.key);

/** The value of the input named `name` in the HTML, if any. */
const inputValue = (html: string, name: string) =>
  html.match(new RegExp(`<input[^>]*name="${name.replace(/\./g, "\\.")}"[^>]*value="([^"]*)"`))?.[1] ??
  html.match(new RegExp(`<input[^>]*value="([^"]*)"[^>]*name="${name.replace(/\./g, "\\.")}"`))?.[1];

describe("the scan page", () => {
  it("lets the user pick a vehicle and take or choose a photo", async () => {
    const { app } = appReplying(READ);
    const user = await makeUser();
    const car = await addCar(app, user, "Myvi");
    await addCar(app, user, "Wife's Axia");
    const html = await (await app.request(`/scan?vehicle=${car}`, { headers: await sessionHeaders(user) }, env)).text();
    expect(html).toContain('action="/scan"');
    expect(html).toContain('enctype="multipart/form-data"');
    expect(html).toMatch(/<input[^>]*type="file"[^>]*name="photo"[^>]*accept="image\/\*"/);
    expect(html).toMatch(new RegExp(`<option value="${car}" selected="">Myvi`));
    expect(html).toContain("Wife&#39;s Axia");
  });

  it("is linked from the dashboard", async () => {
    const { app } = appReplying(READ);
    const user = await makeUser();
    await addCar(app, user);
    const html = await (await app.request("/", { headers: await sessionHeaders(user) }, env)).text();
    expect(html).toContain('href="/scan"');
  });

  it("sends a user with no vehicles to add one first", async () => {
    const { app } = appReplying(READ);
    const res = await app.request("/scan", { headers: await sessionHeaders(await makeUser()) }, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/vehicles/new?from=scan");
  });
});

describe("scanning a receipt", () => {
  it("opens the service form prefilled, with the photo attached and nothing saved yet", async () => {
    const { app, calls } = appReplying(READ);
    const user = await makeUser();
    const car = await addCar(app, user);
    const items = await itemsOf(car);
    const res = await scan(app, user, { vehicle: String(car), photo: photo() });

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    const html = await res.text();
    const [key] = await storedKeys(user);
    expect(inputValue(html, "receipt_key")).toBe(key);
    expect(inputValue(html, "vehicle_id")).toBe(String(car));
    expect(inputValue(html, "date")).toBe("2026-09-02");
    expect(inputValue(html, "odometer_km")).toBe("52310");
    expect(inputValue(html, "total")).toBe("245.00");
    expect(inputValue(html, "line.0.description")).toBe("Minyak hitam 4L");
    expect(inputValue(html, "line.0.cost")).toBe("180.00");
    expect(html).toMatch(new RegExp(`name="line\\.0\\.item"[^]*?<option value="${items[0].id}" selected=""`));
    expect(html).toMatch(new RegExp(`name="line\\.1\\.item"[^]*?<option value="${items[1].id}" selected=""`));
    expect(await listServices(env.DB, user, car)).toEqual([]);
  });

  it("prefills part details it read, leaving out a position the vehicle doesn't have", async () => {
    const reply = JSON.stringify({
      date: "2026-09-02",
      odometer_km: "52310",
      workshop: "Tayar Jaya",
      total: "640",
      lines: [
        { description: "Tyre x2", cost: "640", brand: "Michelin", spec: "205/55R16", position: "Front", warranty_until: "", warranty_months: "12" },
        { description: "Labour", cost: "", brand: "", spec: "", position: "", warranty_until: "", warranty_months: "" },
      ],
    });
    const { app } = appReplying(reply);
    const user = await makeUser();
    const car = await addCar(app, user);
    const html = await (await scan(app, user, { vehicle: String(car), photo: photo() })).text();
    expect(inputValue(html, "line.0.brand")).toBe("Michelin");
    expect(inputValue(html, "line.0.spec")).toBe("205/55 R16");
    expect(inputValue(html, "line.0.warranty_until")).toBe("2027-09-02");
    expect(html).toMatch(/name="line\.0\.position"[\s\S]*?<option value="Front" selected=""/);
    expect(html).toContain("Michelin · 205/55 R16 · Front · Warranty until 02/09/2027");
    expect(inputValue(html, "line.1.brand")).toBe("");
    expect(html).not.toMatch(/class="field unread"><span>(Brand|Spec|Warranty until)/);

    const bikeRes = await app.request(
      "/vehicles",
      { method: "POST", headers: await sessionHeaders(user), body: new URLSearchParams({ type: "motorbike", name: "EX5" }) },
      env,
    );
    const bike = Number(bikeRes.headers.get("location")!.match(/^\/vehicles\/(\d+)/)![1]);
    const leftRight = reply.replace('"Front"', '"Front left"');
    const { app: app2 } = appReplying(leftRight);
    const bikeHtml = await (await scan(app2, user, { vehicle: String(bike), photo: photo() })).text();
    expect(bikeHtml).not.toMatch(/<option value="[^"]*" selected="">(Front left|Front)</);
  });

  it("highlights what the AI couldn't read", async () => {
    const { app } = appReplying(READ);
    const user = await makeUser();
    const car = await addCar(app, user);
    const html = await (await scan(app, user, { vehicle: String(car), photo: photo() })).text();
    expect(html).toMatch(/<label class="field unread"><span>Workshop<\/span>/);
    expect(html).toMatch(/<label class="field unread"><span>Cost \(RM\)<\/span><input name="line\.2\.cost"/);
    expect(html).toMatch(/<label class="field"><span>Odometer \(km\)<\/span>/);
  });

  it("saves the prefilled form, receipt and all, once the user presses Save", async () => {
    const { app } = appReplying(READ);
    const user = await makeUser();
    const car = await addCar(app, user);
    await scan(app, user, { vehicle: String(car), photo: photo() });
    const [key] = await storedKeys(user);

    const res = await app.request(
      "/services",
      {
        method: "POST",
        headers: await sessionHeaders(user),
        body: new URLSearchParams({ vehicle_id: String(car), receipt_key: key, date: "2026-09-02", odometer_km: "52310", total: "245" }),
      },
      env,
    );
    expect(res.status).toBe(302);
    const [{ id }] = await listServices(env.DB, user, car);
    expect((await getService(env.DB, user, id))?.receipt_key).toBe(key);
  });

  it("lets the user remove a line the scan got wrong, keeping the total it read", async () => {
    const { app } = appReplying(READ);
    const user = await makeUser();
    const car = await addCar(app, user);
    const html = await (await scan(app, user, { vehicle: String(car), photo: photo() })).text();
    for (const n of [0, 1, 2]) expect(html).toContain(`name="line.${n}.remove"`);
    expect(html).not.toContain('name="line.3.remove"');

    const res = await app.request(
      "/services",
      {
        method: "POST",
        headers: await sessionHeaders(user),
        body: new URLSearchParams({
          vehicle_id: String(car),
          date: "2026-09-02",
          odometer_km: "52310",
          total: "245.00",
          "line.0.description": "Minyak hitam 4L",
          "line.0.cost": "180.00",
          "line.1.description": "Penapis minyak",
          "line.1.cost": "30.00",
          "line.1.remove": "1",
          "line.2.description": "Wiper blade",
          "line.2.cost": "",
        }),
      },
      env,
    );
    expect(res.status).toBe(302);
    const [{ id }] = await listServices(env.DB, user, car);
    const service = await getService(env.DB, user, id);
    expect(service!.lines.map((l) => l.description)).toEqual(["Minyak hitam 4L", "Wiper blade"]);
    expect(service!.total_sen).toBe(24500);
  });

  it("still opens the form with the photo when the AI fails", async () => {
    for (const { app } of [appReplying("", 500), appReplying("I cannot read this receipt.")]) {
      const user = await makeUser();
      const car = await addCar(app, user);
      const res = await scan(app, user, { vehicle: String(car), photo: photo() });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Couldn&#39;t read receipt — fill in manually");
      expect(inputValue(html, "receipt_key")).toBe((await storedKeys(user))[0]);
      expect(inputValue(html, "date")).toBe("");
    }
  });

  it("refuses an oversized or non-image upload without storing it or calling the AI", async () => {
    const { app, calls } = appReplying(READ);
    const user = await makeUser();
    const car = await addCar(app, user);
    const big = await scan(app, user, { vehicle: String(car), photo: photo(new Uint8Array(2 * 1024 * 1024 + 1)) });
    expect(big.status).toBe(413);
    expect(await big.text()).toContain("Photo too large");
    const pdf = await scan(app, user, { vehicle: String(car), photo: photo(new Uint8Array([1]), "application/pdf") });
    expect(pdf.status).toBe(415);
    expect(await pdf.text()).toContain("Unsupported image");
    const none = await scan(app, user, { vehicle: String(car) });
    expect(none.status).toBe(400);
    expect(calls).toHaveLength(0);
    expect(await storedKeys(user)).toEqual([]);
  });

  it("is 404 against someone else's vehicle, storing nothing and not calling the AI", async () => {
    const { app, calls } = appReplying(READ);
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const car = await addCar(app, alice);
    expect((await scan(app, bob, { vehicle: String(car), photo: photo() })).status).toBe(404);
    expect((await app.request(`/scan?vehicle=${car}`, { headers: await sessionHeaders(bob) }, env)).status).toBe(404);
    expect(calls).toHaveLength(0);
    expect(await storedKeys(bob)).toEqual([]);
  });
});

/** The selected option's value in the select named `name`, or "" when none is marked selected. */
const selectedValue = (html: string, name: string) => {
  const select = html.match(new RegExp(`<select[^>]*name="${name.replace(/\./g, "\\.")}"[^>]*>(.*?)</select>`, "s"))?.[1];
  return select?.match(/<option value="([^"]*)" selected="">/)?.[1] ?? "";
};

describe("categories on a scanned receipt", () => {
  it("are suggested per line, following the suggested reminder's category, for the owner to review", async () => {
    const { app } = appReplying(
      JSON.stringify({
        date: "2026-09-02",
        odometer_km: 52310,
        workshop: null,
        total: 900,
        lines: [
          { description: "Minyak hitam 4L", cost: 180 },
          { description: "Penapis minyak", cost: 30 },
          { description: "Tayar Michelin x2", cost: 600 },
          { description: "Wiper blade", cost: 45 },
          { description: "Upah", cost: 45 },
        ],
      }),
    );
    const user = await makeUser();
    const car = await addCar(app, user);
    const html = await (await scan(app, user, { vehicle: String(car), photo: photo() })).text();
    expect([0, 1, 2, 3, 4].map((n) => selectedValue(html, `line.${n}.category`))).toEqual([
      "Engine",
      "Filters",
      "Tyres",
      "Wipers",
      "",
    ]);
  });

  it("never suggest the owner's own categories, though the form offers them", async () => {
    const { app } = appReplying(
      JSON.stringify({ date: "2026-09-02", odometer_km: 52310, workshop: null, total: 350, lines: [{ description: "Dashcam", cost: 350 }] }),
    );
    const user = await makeUser();
    const car = await addCar(app, user);
    const headers = await sessionHeaders(user);
    const own = new URLSearchParams({
      vehicle_id: String(car),
      date: "2026-08-01",
      odometer_km: "50000",
      "line.0.description": "Dashcam fitting",
      "line.0.category": "__new__",
      "line.0.new_category": "Dashcam",
    });
    expect((await app.request("/services", { method: "POST", headers, body: own }, env)).status).toBe(302);
    const html = await (await scan(app, user, { vehicle: String(car), photo: photo() })).text();
    expect(html).toContain('<option value="Dashcam">Dashcam</option>');
    expect(selectedValue(html, "line.0.category")).toBe("");
  });
});

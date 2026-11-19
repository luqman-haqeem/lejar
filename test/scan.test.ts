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

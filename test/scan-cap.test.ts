import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { scansLeft, takeScan } from "../src/db";
import { createApp } from "../src/index";
import { makeUser, sessionHeaders } from "./helpers";

// Each test uses its own far-future day so the all-users total isn't shared between tests.
let day = 0;
const freshDay = () => `2031-01-${String(++day).padStart(2, "0")}`;

describe("counting scans", () => {
  it("allows 20 scans per user per day, then refuses", async () => {
    const user = await makeUser();
    const today = freshDay();
    for (let i = 0; i < 20; i++) expect(await takeScan(env.DB, user, today, 20, 300)).toBe(true);
    expect(await takeScan(env.DB, user, today, 20, 300)).toBe(false);
    expect(await scansLeft(env.DB, user, today, 20, 300)).toBe(0);
  });

  it("resets the next day and doesn't limit other users", async () => {
    const user = await makeUser();
    const today = freshDay();
    for (let i = 0; i < 3; i++) await takeScan(env.DB, user, today, 3, 300);
    expect(await takeScan(env.DB, user, today, 3, 300)).toBe(false);
    expect(await takeScan(env.DB, user, freshDay(), 3, 300)).toBe(true);
    expect(await takeScan(env.DB, await makeUser(), today, 3, 300)).toBe(true);
  });

  it("stops everyone once the overall daily limit is reached", async () => {
    const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
    const today = freshDay();
    expect(await takeScan(env.DB, a, today, 20, 2)).toBe(true);
    expect(await takeScan(env.DB, b, today, 20, 2)).toBe(true);
    expect(await takeScan(env.DB, c, today, 20, 2)).toBe(false);
    expect(await takeScan(env.DB, a, today, 20, 2)).toBe(false);
    expect(await scansLeft(env.DB, c, today, 20, 2)).toBe(0);
  });

  it("can't be overrun by scans fired at the same moment", async () => {
    const user = await makeUser();
    const today = freshDay();
    const results = await Promise.all(Array.from({ length: 30 }, () => takeScan(env.DB, user, today, 20, 300)));
    expect(results.filter(Boolean)).toHaveLength(20);
    expect(await scansLeft(env.DB, user, today, 20, 300)).toBe(0);
  });

  it("reports how many are left", async () => {
    const user = await makeUser();
    const today = freshDay();
    expect(await scansLeft(env.DB, user, today, 20, 300)).toBe(20);
    await takeScan(env.DB, user, today, 20, 300);
    expect(await scansLeft(env.DB, user, today, 20, 300)).toBe(19);
    expect(await scansLeft(env.DB, user, today, 20, 1)).toBe(0);
  });
});

describe("the scan limit in the app", () => {
  // 03/02/2031 in Kuala Lumpur, a day no other test scans on. Per-user cap 2 (set below).
  const now = () => new Date("2031-02-03T02:00:00Z");
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const reply = JSON.stringify({ date: "2031-02-01", odometer_km: "1000", workshop: "", total: "10", lines: [] });

  function setup() {
    const calls: Request[] = [];
    const aiFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Request(input, init));
      return Response.json({ choices: [{ message: { content: reply } }] });
    }) as typeof fetch;
    const app = createApp({ now, aiFetch });
    const capped = { ...env, SCAN_CAP_PER_USER: "2", SCAN_CAP_GLOBAL: "300" };
    return { app, calls, capped };
  }

  async function addCar(app: ReturnType<typeof createApp>, capped: Cloudflare.Env, userId: number) {
    const res = await app.request(
      "/vehicles",
      { method: "POST", headers: await sessionHeaders(userId), body: new URLSearchParams({ type: "car", name: "Myvi" }) },
      capped,
    );
    return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\/edit$/)![1]);
  }

  async function scan(app: ReturnType<typeof createApp>, capped: Cloudflare.Env, userId: number, car: number, file: File) {
    const form = new FormData();
    form.append("vehicle", String(car));
    form.append("photo", file);
    const encoded = new Request("https://kereta.test", { method: "POST", body: form });
    const body = await encoded.arrayBuffer();
    const headers = {
      ...(await sessionHeaders(userId)),
      "content-type": encoded.headers.get("content-type")!,
      "content-length": String(body.byteLength),
    };
    return app.request("/scan", { method: "POST", headers, body }, capped);
  }

  const stored = async (userId: number) => (await env.RECEIPTS.list({ prefix: `receipts/${userId}/` })).objects.length;
  const scanPage = async (app: ReturnType<typeof createApp>, capped: Cloudflare.Env, userId: number) =>
    (await app.request("/scan", { headers: await sessionHeaders(userId) }, capped)).text();

  it("shows scans left, then points to manual entry with 429 once they're used up", async () => {
    const { app, calls, capped } = setup();
    const user = await makeUser();
    const car = await addCar(app, capped, user);
    const photo = () => new File([JPEG], "r.jpg", { type: "image/jpeg" });

    expect(await scanPage(app, capped, user)).toContain("2 scans left today");
    expect((await scan(app, capped, user, car, photo())).status).toBe(200);
    expect(await scanPage(app, capped, user)).toContain("1 scan left today");
    expect((await scan(app, capped, user, car, photo())).status).toBe(200);

    const over = await scan(app, capped, user, car, photo());
    expect(over.status).toBe(429);
    const html = await over.text();
    expect(html).toContain("Daily scan limit reached — you can still log manually");
    expect(html).toContain(`href="/services/new?vehicle=${car}"`);
    expect(calls).toHaveLength(2);
    expect(await stored(user)).toBe(2);

    const page = await scanPage(app, capped, user);
    expect(page).toContain("Daily scan limit reached — you can still log manually");
    expect(page).not.toContain('name="photo"');
  });

  it("doesn't count uploads rejected for size or type", async () => {
    const { app, calls, capped } = setup();
    const user = await makeUser();
    const car = await addCar(app, capped, user);
    const pdf = new File([new Uint8Array([1])], "r.pdf", { type: "application/pdf" });
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "r.jpg", { type: "image/jpeg" });
    expect((await scan(app, capped, user, car, pdf)).status).toBe(415);
    expect((await scan(app, capped, user, car, big)).status).toBe(413);
    expect(await scanPage(app, capped, user)).toContain("2 scans left today");
    expect(calls).toHaveLength(0);
  });

  it("gives the scan back, and says so, when the photo can't be stored", async () => {
    const broken = {
      ...env,
      SCAN_CAP_PER_USER: "1",
      SCAN_CAP_GLOBAL: "300",
      RECEIPTS: { ...env.RECEIPTS, put: async () => { throw new Error("R2 down"); } } as unknown as R2Bucket,
    };
    const app = createApp({ now, aiFetch: (async () => { throw new Error("not called"); }) as typeof fetch });
    const user = await makeUser();
    const car = await addCar(app, broken, user);
    const res = await scan(app, broken, user, car, new File([JPEG], "r.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("Couldn&#39;t store the photo just now");
    expect(await scanPage(app, broken, user)).toContain("1 scan left today");
  });

  it("still says what was wrong with an upload when no scans are left", async () => {
    const { app, capped } = setup();
    const user = await makeUser();
    const car = await addCar(app, capped, user);
    const jpeg = () => new File([JPEG], "r.jpg", { type: "image/jpeg" });
    await scan(app, capped, user, car, jpeg());
    await scan(app, capped, user, car, jpeg());
    const pdf = await scan(app, capped, user, car, new File([new Uint8Array([1])], "r.pdf", { type: "application/pdf" }));
    expect(pdf.status).toBe(415);
    expect(await pdf.text()).toContain("Unsupported image");
  });

  it("counts a scan even when the AI fails", async () => {
    const capped = { ...env, SCAN_CAP_PER_USER: "2", SCAN_CAP_GLOBAL: "300" };
    const failing = (async () => new Response("down", { status: 502 })) as typeof fetch;
    const app = createApp({ now, aiFetch: failing });
    const user = await makeUser();
    const car = await addCar(app, capped, user);
    expect((await scan(app, capped, user, car, new File([JPEG], "r.jpg", { type: "image/jpeg" }))).status).toBe(200);
    expect(await scanPage(app, capped, user)).toContain("1 scan left today");
  });
});

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getService, listServices } from "../src/db";
import { createApp } from "../src/index";
import { cleanupOrphans } from "../src/receipts";
import { makeUser, sessionHeaders } from "./helpers";

const app = createApp({ now: () => new Date("2026-11-18T02:00:00Z") });

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
const photo = (bytes: Uint8Array = JPEG, type = "image/jpeg", name = "receipt.jpg") => new File([bytes], name, { type });

async function addCar(userId: number): Promise<number> {
  const res = await app.request(
    "/vehicles",
    { method: "POST", headers: await sessionHeaders(userId), body: new URLSearchParams({ type: "car", name: "Myvi" }) },
    env,
  );
  return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\/edit$/)![1]);
}

/** Posts a multipart service form, like the browser does once a photo is attached. */
async function postMultipart(path: string, userId: number, fields: Record<string, string | File>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return app.request(path, { method: "POST", headers: await sessionHeaders(userId), body: form }, env);
}

const visit = { date: "2026-03-14", odometer_km: "52000", total: "150" };

async function storedKeys(userId: number): Promise<string[]> {
  return (await env.RECEIPTS.list({ prefix: `receipts/${userId}/` })).objects.map((o) => o.key);
}

describe("attaching a receipt photo", () => {
  it("stores the photo privately under the user's prefix and shows it on the service page", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const res = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, photo: photo() });
    expect(res.status).toBe(302);

    const [{ id }] = await listServices(env.DB, user, car);
    const key = (await getService(env.DB, user, id))!.receipt_key!;
    expect(key).toMatch(new RegExp(`^receipts/${user}/[0-9a-f-]{36}\\.jpg$`));
    expect(await storedKeys(user)).toEqual([key]);

    const page = await (await app.request(`/services/${id}`, { headers: await sessionHeaders(user) }, env)).text();
    expect(page).toContain(`src="/${key}"`);

    const image = await app.request(`/${key}`, { headers: await sessionHeaders(user) }, env);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/jpeg");
    expect(image.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(JPEG);
  });

  it("only shows the photo to its owner", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const car = await addCar(alice);
    await postMultipart("/services", alice, { vehicle_id: String(car), ...visit, photo: photo() });
    const [key] = await storedKeys(alice);

    expect((await app.request(`/${key}`, { headers: await sessionHeaders(bob) }, env)).status).toBe(404);
    const signedOut = await app.request(`/${key}`, {}, env);
    expect(signedOut.status).toBe(302);
    expect(signedOut.headers.get("location")).toBe("/login");
    expect((await app.request(`/receipts/${alice}/missing.jpg`, { headers: await sessionHeaders(alice) }, env)).status).toBe(404);
  });
});

describe("refusing an upload", () => {
  it("rejects a photo over 2 MB with 413, storing nothing and keeping the form", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const big = photo(new Uint8Array(2 * 1024 * 1024 + 1));
    const res = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, workshop: "Ah Seng", photo: big });
    expect(res.status).toBe(413);
    const html = await res.text();
    expect(html).toContain("Photo too large");
    expect(html).toContain('value="Ah Seng"');
    expect(await storedKeys(user)).toEqual([]);
    expect(await listServices(env.DB, user, car)).toEqual([]);
  });

  it("rejects a file that isn't JPEG, PNG or WebP with 415", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const pdf = photo(new Uint8Array([0x25, 0x50, 0x44, 0x46]), "application/pdf", "receipt.pdf");
    const res = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, photo: pdf });
    expect(res.status).toBe(415);
    expect(await res.text()).toContain("Unsupported image");
    expect(await storedKeys(user)).toEqual([]);
  });
});

describe("keeping the photo through a failed save", () => {
  it("holds on to an uploaded photo while the user fixes the form", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const first = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, odometer_km: "", photo: photo() });
    expect(first.status).toBe(400);
    const [key] = await storedKeys(user);
    const html = await first.text();
    expect(html).toContain(`name="receipt_key" value="${key}"`);
    expect(html).toContain(`src="/${key}"`);

    const second = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, receipt_key: key });
    expect(second.status).toBe(302);
    const [{ id }] = await listServices(env.DB, user, car);
    expect((await getService(env.DB, user, id))!.receipt_key).toBe(key);
  });

  it("is 404 to attach someone else's photo or one another service already uses", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const alicesCar = await addCar(alice);
    await postMultipart("/services", alice, { vehicle_id: String(alicesCar), ...visit, photo: photo() });
    const [alicesKey] = await storedKeys(alice);
    const bobsCar = await addCar(bob);

    const stolen = await postMultipart("/services", bob, { vehicle_id: String(bobsCar), ...visit, receipt_key: alicesKey });
    expect(stolen.status).toBe(404);
    const shared = await postMultipart("/services", alice, { vehicle_id: String(alicesCar), ...visit, odometer_km: "53000", receipt_key: alicesKey });
    expect(shared.status).toBe(404);
    expect(await listServices(env.DB, bob, bobsCar)).toEqual([]);
    expect(await listServices(env.DB, alice, alicesCar)).toHaveLength(1);
  });
});

describe("changing or removing a service's photo", () => {
  async function serviceWithPhoto() {
    const user = await makeUser();
    const car = await addCar(user);
    await postMultipart("/services", user, { vehicle_id: String(car), ...visit, photo: photo() });
    const [{ id }] = await listServices(env.DB, user, car);
    const key = (await getService(env.DB, user, id))!.receipt_key!;
    return { user, car, id, key };
  }

  it("keeps the photo when the service is edited without touching it", async () => {
    const { user, id, key } = await serviceWithPhoto();
    const edit = await (await app.request(`/services/${id}/edit`, { headers: await sessionHeaders(user) }, env)).text();
    expect(edit).toContain(`name="receipt_key" value="${key}"`);
    expect((await postMultipart(`/services/${id}`, user, { ...visit, total: "160", receipt_key: key })).status).toBe(302);
    expect((await getService(env.DB, user, id))!.receipt_key).toBe(key);
    expect(await storedKeys(user)).toEqual([key]);
  });

  it("replaces the photo and deletes the old one", async () => {
    const { user, id, key } = await serviceWithPhoto();
    const png = photo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png", "r.png");
    expect((await postMultipart(`/services/${id}`, user, { ...visit, receipt_key: key, photo: png })).status).toBe(302);
    const newKey = (await getService(env.DB, user, id))!.receipt_key!;
    expect(newKey).toMatch(/\.png$/);
    expect(await storedKeys(user)).toEqual([newKey]);
  });

  it("removes the photo when asked", async () => {
    const { user, id, key } = await serviceWithPhoto();
    expect((await postMultipart(`/services/${id}`, user, { ...visit, receipt_key: key, remove_photo: "1" })).status).toBe(302);
    expect((await getService(env.DB, user, id))!.receipt_key).toBeNull();
    expect(await storedKeys(user)).toEqual([]);
  });

  it("deletes the photo with the service", async () => {
    const { user, car, id } = await serviceWithPhoto();
    const res = await app.request(`/services/${id}/delete`, { method: "POST", headers: await sessionHeaders(user) }, env);
    expect(res.status).toBe(302);
    expect(await listServices(env.DB, user, car)).toEqual([]);
    expect(await storedKeys(user)).toEqual([]);
  });
});

describe("cleaning up unsaved uploads", () => {
  it("deletes photos over 24 hours old that no service uses, and keeps the rest", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    await postMultipart("/services", user, { vehicle_id: String(car), ...visit, photo: photo() });
    const [saved] = await storedKeys(user);
    await postMultipart("/services", user, { vehicle_id: String(car), ...visit, odometer_km: "", photo: photo() });
    const orphan = (await storedKeys(user)).find((k) => k !== saved)!;

    expect(await cleanupOrphans(env.RECEIPTS, env.DB, user, Date.now() + 23 * 3600_000)).toBe(0);
    expect(await cleanupOrphans(env.RECEIPTS, env.DB, user, Date.now() + 25 * 3600_000)).toBe(1);
    expect(await storedKeys(user)).toEqual([saved]);
    expect(orphan).not.toBe(saved);
  });
});

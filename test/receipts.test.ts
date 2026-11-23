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
  return Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\?added=1$/)![1]);
}

/** Posts a multipart service form, like the browser does once a photo is attached. */
async function postMultipart(path: string, userId: number, fields: Record<string, string | File>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  // Serialise it the way a browser sends it, Content-Length included.
  const encoded = new Request("https://kereta.test", { method: "POST", body: form });
  const body = await encoded.arrayBuffer();
  const headers = {
    ...(await sessionHeaders(userId)),
    "content-type": encoded.headers.get("content-type")!,
    "content-length": String(body.byteLength),
  };
  return app.request(path, { method: "POST", headers, body }, env);
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
    expect(image.headers.get("x-content-type-options")).toBe("nosniff");
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

  it("refuses a huge upload before reading it", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const huge = photo(new Uint8Array(5 * 1024 * 1024));
    const res = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, photo: huge });
    expect(res.status).toBe(413);
    const html = await res.text();
    expect(html).toContain("Photo too large");
    expect(html).not.toContain('name="odometer_km"'); // refused before the form was even read
    expect(await storedKeys(user)).toEqual([]);
  });

  it("shows a photo problem alongside the form's other errors", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const pdf = photo(new Uint8Array([1]), "application/pdf", "r.pdf");
    const res = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, total: "abc", photo: pdf });
    expect(res.status).toBe(415);
    const html = await res.text();
    expect(html).toContain("Unsupported image");
    expect(html).toContain("Total must be an amount like 85 or RM 1,234.50.");
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
    const first = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, total: "abc", photo: photo() });
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

  it("holds on to the photo through the no-km warning, then saves it on the second press", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const first = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, odometer_km: "", photo: photo() });
    expect(first.status).toBe(200);
    const [key] = await storedKeys(user);
    const html = await first.text();
    expect(html).toContain(`name="receipt_key" value="${key}"`);
    expect(html).toContain('name="no_km" value="1"');
    expect(await listServices(env.DB, user, car)).toEqual([]);

    const second = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, odometer_km: "", no_km: "1", receipt_key: key });
    expect(second.status).toBe(302);
    const [{ id }] = await listServices(env.DB, user, car);
    expect(await getService(env.DB, user, id)).toMatchObject({ receipt_key: key, odometer_km: null });
  });

  it("never lets a photo end up on two services", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const alicesCar = await addCar(alice);
    await postMultipart("/services", alice, { vehicle_id: String(alicesCar), ...visit, photo: photo() });
    const [alicesKey] = await storedKeys(alice);
    const bobsCar = await addCar(bob);

    const stolen = await postMultipart("/services", bob, { vehicle_id: String(bobsCar), ...visit, receipt_key: alicesKey });
    expect(stolen.status).toBe(404);
    // Alice's own photo, already on a saved visit, opens that visit instead of saving a second one.
    const shared = await postMultipart("/services", alice, { vehicle_id: String(alicesCar), ...visit, odometer_km: "53000", receipt_key: alicesKey });
    const [saved] = await listServices(env.DB, alice, alicesCar);
    expect(shared.status).toBe(302);
    expect(shared.headers.get("location")).toBe(`/vehicles/${alicesCar}?stamped=${saved.id}`);
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

    expect(orphan).not.toBe(saved);

    expect(await cleanupOrphans(env.RECEIPTS, env.DB, Date.now() + 23 * 3600_000)).toBe(0);
    expect(await storedKeys(user)).toHaveLength(2);
    expect(await cleanupOrphans(env.RECEIPTS, env.DB, Date.now() + 25 * 3600_000)).toBeGreaterThanOrEqual(1);
    expect(await storedKeys(user)).toEqual([saved]);
  });

  it("also clears another user's abandoned upload, even if they never upload again", async () => {
    const quitter = await makeUser("quitter@example.com");
    const quittersCar = await addCar(quitter);
    await postMultipart("/services", quitter, { vehicle_id: String(quittersCar), ...visit, odometer_km: "", photo: photo() });
    expect(await storedKeys(quitter)).toHaveLength(1);

    await cleanupOrphans(env.RECEIPTS, env.DB, Date.now() + 25 * 3600_000);
    expect(await storedKeys(quitter)).toEqual([]);
  });
});

describe("sending a scanned form twice", () => {
  // A second tap on Save while the first is still on its way posts the same receipt again.
  it("lands on the visit the first submit saved, without saving it twice", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    // The scan flow: the photo is stored first and the form carries its key.
    const scanned = await postMultipart("/services", user, { vehicle_id: String(car), ...visit, total: "abc", photo: photo() });
    const [key] = await storedKeys(user);
    expect(scanned.status).toBe(400);

    const form = { vehicle_id: String(car), ...visit, receipt_key: key };
    const first = await postMultipart("/services", user, form);
    const again = await postMultipart("/services", user, form);

    expect(first.status).toBe(302);
    expect(again.status).toBe(302);
    expect(again.headers.get("location")).toBe(first.headers.get("location"));
    expect(await listServices(env.DB, user, car)).toHaveLength(1);
  });
});

describe("the service form", () => {
  it("guards against being sent twice (public/app.js handles data-busy)", async () => {
    const user = await makeUser();
    const car = await addCar(user);
    const res = await app.request(`/services/new?vehicle=${car}`, { headers: await sessionHeaders(user) }, env);
    expect(await res.text()).toMatch(/<form[^>]*action="\/services"[^>]*data-busy="Saving…"/);
  });
});

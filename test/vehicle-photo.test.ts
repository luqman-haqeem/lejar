import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getVehicle } from "../src/db";
import { createApp } from "../src/index";
import { cleanupOrphans } from "../src/receipts";
import { makeUser, sessionHeaders } from "./helpers";

const app = createApp({ now: () => new Date("2026-11-18T02:00:00Z") });

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
const photo = (bytes: Uint8Array = JPEG, type = "image/jpeg") => new File([bytes], "car.jpg", { type });
const get = async (path: string, userId: number) => app.request(path, { headers: await sessionHeaders(userId) }, env);

/** Posts a multipart form the way a browser does once a photo is attached. */
async function postMultipart(path: string, userId: number, fields: Record<string, string | File>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const encoded = new Request("https://kereta.test", { method: "POST", body: form });
  const body = await encoded.arrayBuffer();
  const headers = {
    ...(await sessionHeaders(userId)),
    "content-type": encoded.headers.get("content-type")!,
    "content-length": String(body.byteLength),
  };
  return app.request(path, { method: "POST", headers, body }, env);
}

const storedPhotos = async (userId: number) =>
  (await env.RECEIPTS.list({ prefix: `vehicle-photos/${userId}/` })).objects.map((o) => o.key);

async function addCarWithPhoto(userId: number): Promise<{ car: number; key: string }> {
  const res = await postMultipart("/vehicles", userId, { type: "car", name: "Myvi", plate: "WXY 1234", photo: photo() });
  expect(res.status).toBe(302);
  const car = Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)\?added=1$/)![1]);
  return { car, key: (await getVehicle(env.DB, userId, car))!.photo_key! };
}

describe("a vehicle photo", () => {
  it("is stored privately when the vehicle is added and shown on its cover, Home and the print view", async () => {
    const user = await makeUser();
    const { car, key } = await addCarWithPhoto(user);

    expect(key).toMatch(new RegExp(`^vehicle-photos/${user}/[0-9a-f-]{36}\\.jpg$`));
    expect(await storedPhotos(user)).toEqual([key]);
    for (const path of ["/", `/vehicles/${car}`, `/vehicles/${car}/print`]) {
      expect(await (await get(path, user)).text()).toContain(`src="/${key}"`);
    }

    const image = await get(`/${key}`, user);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/jpeg");
  });

  it("is served only to its owner", async () => {
    const owner = await makeUser();
    const { key } = await addCarWithPhoto(owner);
    const stranger = await makeUser("stranger@example.com");
    expect((await get(`/${key}`, stranger)).status).toBe(404);
  });

  it("leaves the cover as it was when there's no photo", async () => {
    const user = await makeUser();
    const res = await postMultipart("/vehicles", user, { type: "car", name: "Myvi" });
    const car = Number(res.headers.get("location")!.match(/^\/vehicles\/(\d+)/)![1]);
    expect((await getVehicle(env.DB, user, car))!.photo_key).toBeNull();
    for (const path of ["/", `/vehicles/${car}`, `/vehicles/${car}/print`]) {
      expect(await (await get(path, user)).text()).not.toContain("vehicle-photo");
    }
  });

  it("can be replaced or removed from the edit form, deleting the old one", async () => {
    const user = await makeUser();
    const { car, key } = await addCarWithPhoto(user);
    const edit = await (await get(`/vehicles/${car}/edit`, user)).text();
    expect(edit).toContain('enctype="multipart/form-data"');
    expect(edit).toContain(`src="/${key}"`);

    expect((await postMultipart(`/vehicles/${car}`, user, { name: "Myvi", photo: photo() })).status).toBe(302);
    const replaced = (await getVehicle(env.DB, user, car))!.photo_key!;
    expect(replaced).not.toBe(key);
    expect(await storedPhotos(user)).toEqual([replaced]);

    expect((await postMultipart(`/vehicles/${car}`, user, { name: "Myvi" })).status).toBe(302);
    expect((await getVehicle(env.DB, user, car))!.photo_key).toBe(replaced); // untouched without a choice

    expect((await postMultipart(`/vehicles/${car}`, user, { name: "Myvi", remove_photo: "1" })).status).toBe(302);
    expect((await getVehicle(env.DB, user, car))!.photo_key).toBeNull();
    expect(await storedPhotos(user)).toEqual([]);
  });

  it("refuses a file that's too big or isn't an image, storing nothing", async () => {
    const user = await makeUser();
    const big = await postMultipart("/vehicles", user, {
      type: "car",
      name: "Myvi",
      photo: photo(new Uint8Array(2 * 1024 * 1024 + 1)),
    });
    expect(big.status).toBe(413);
    const pdf = await postMultipart("/vehicles", user, { type: "car", name: "Myvi", photo: photo(JPEG, "application/pdf") });
    expect(pdf.status).toBe(415);
    expect(await pdf.text()).toContain("Unsupported image");
    expect(await storedPhotos(user)).toEqual([]);
  });

  it("isn't stored when the rest of the form has errors", async () => {
    const user = await makeUser();
    const res = await postMultipart("/vehicles", user, { type: "car", name: "", photo: photo() });
    expect(res.status).toBe(400);
    expect(await storedPhotos(user)).toEqual([]);
  });

  it("is kept by the orphan cleanup while a vehicle uses it, and cleared when none does", async () => {
    const user = await makeUser();
    const { key } = await addCarWithPhoto(user);
    const stray = `vehicle-photos/${user}/${crypto.randomUUID()}.jpg`;
    await env.RECEIPTS.put(stray, JPEG);

    await cleanupOrphans(env.RECEIPTS, env.DB, Date.now() + 25 * 3600_000);
    expect(await storedPhotos(user)).toEqual([key]);
  });
});

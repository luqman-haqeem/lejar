import type { Context } from "hono";
import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { idOf, notFound } from "./http";
import {
  createService,
  deleteService,
  getService,
  getVehicle,
  listItems,
  listOwnCategoryNames,
  receiptKeyInUse,
  serviceWithReceipt,
  type ServiceInput,
  updateService,
  type Vehicle,
} from "./db";
import type { Body } from "./form";
import { checkOdometer, hintReadings } from "./odometer";
import { inBackground } from "./background";
import {
  cleanupOrphans,
  deletePhoto,
  isOwnKey,
  photoProblem,
  putReceipt,
  receiptExists,
  uploadTooLarge,
} from "./receipts";
import { blankServiceForm, kmUnconfirmed, parseServiceForm, readServiceForm, serviceFormValuesOf } from "./service-form";
import { PhotoTooLarge } from "./views/PhotoTooLarge";
import { ServiceForm, type ServiceFormMode } from "./views/ServiceForm";
import { ServiceView } from "./views/ServiceView";


/** The user's service from the :id param, with its vehicle; null if it isn't theirs. */
async function ownedService(c: Context<AppEnv>) {
  const userId = c.get("userId");
  const service = await getService(c.env.DB, userId, Number(c.req.param("id")));
  const vehicle = service && (await getVehicle(c.env.DB, userId, service.vehicle_id));
  return service && vehicle ? { service, vehicle } : null;
}

type PhotoOutcome =
  | { kind: "ok"; key: string | null }
  | { kind: "not-found" }
  | { kind: "problem"; problem: { message: string; status: 400 | 413 | 415 }; key: string | null };

/**
 * Works out which receipt photo the submitted form ends up with. The hidden `receipt_key` field is
 * the photo already attached (an earlier upload, or the service's current photo when editing);
 * `remove_photo` drops it; a new `photo` file replaces it and is stored straight away, so it
 * survives a re-render if the rest of the form has errors.
 */
async function resolvePhoto(c: Context<AppEnv>, body: Body, currentKey: string | null): Promise<PhotoOutcome> {
  const userId = c.get("userId");
  const posted = typeof body.receipt_key === "string" ? body.receipt_key.trim() : "";
  let key: string | null = posted === "" ? null : posted;
  const isCurrent = key !== null && key === currentKey;

  // A key that isn't this service's photo must be the user's own unsaved upload: not anyone else's
  // photo and not one another service already uses.
  if (key !== null && !isCurrent && (!isOwnKey(key, userId) || (await receiptKeyInUse(c.env.DB, key)))) {
    return { kind: "not-found" };
  }
  if (body.remove_photo === "1") key = null;

  const file = body.photo instanceof File && body.photo.size > 0 ? body.photo : null;
  if (file) {
    const problem = photoProblem(file);
    if (problem) return { kind: "problem", problem, key };
    key = await putReceipt(c.env.RECEIPTS, userId, file);
    await inBackground(c, cleanupOrphans(c.env.RECEIPTS, c.env.DB));
  } else if (key !== null && !isCurrent && !(await receiptExists(c.env.RECEIPTS, key))) {
    const problem = { message: "The attached photo has expired. Please attach it again.", status: 400 } as const;
    return { kind: "problem", problem, key: null };
  }
  return { kind: "ok", key };
}

/**
 * Validates a posted service form, stores any new photo, and checks the odometer against the
 * vehicle's other readings. A line tagged with another vehicle's schedule item, or a photo key that
 * isn't the user's, is a 404. Otherwise it re-renders the form keeping what was typed (and the photo)
 * with 413/415 for a bad photo, 400 for other errors, 422 for an odometer conflict, or 200 "warned"
 * for a blank km the owner hasn't confirmed, or calls `save`.
 */
async function submitService(
  c: Context<AppEnv>,
  body: Body,
  vehicle: Vehicle,
  mode: ServiceFormMode,
  currentKey: string | null,
  save: (s: ServiceInput) => Promise<Response>,
): Promise<Response> {
  const [items, own] = await Promise.all([
    listItems(c.env.DB, c.get("userId"), vehicle.id),
    listOwnCategoryNames(c.env.DB, c.get("userId")),
  ]);
  const values = readServiceForm(body);
  // Tagging a line with a schedule item that isn't this vehicle's is treated like any other id that
  // isn't the user's: 404, nothing saved.
  const itemIds = new Set(items.map((i) => String(i.id)));
  if (values.lines.some((l) => l.item !== "" && !itemIds.has(l.item))) return notFound(c);

  const photo = await resolvePhoto(c, body, currentKey);
  if (photo.kind === "not-found") return notFound(c);
  const editing = mode.kind === "edit" ? mode.serviceId : null;
  // A blank km not yet confirmed comes back "warned": the next press of the same button saves without it.
  const warnNoKm = kmUnconfirmed(values.service);
  const render = async (errors: Record<string, string>, status: 200 | 400 | 413 | 415 | 422) =>
    c.html(
      <ServiceForm
        vehicle={vehicle}
        items={items}
        ownCategories={own}
        values={warnNoKm ? { ...values, service: { ...values.service, no_km: "1" } } : values}
        warnNoKm={warnNoKm ? (body.action === "save_add" ? "save_add" : "save") : undefined}
        mode={mode}
        errors={errors}
        receiptKey={photo.key}
        today={c.get("today")}
        readings={await hintReadings(c.env.DB, c.get("userId"), vehicle.id, editing)}
      />,
      status,
    );

  const parsed = parseServiceForm(values, items, c.get("today"), vehicle.type, own);
  if (photo.kind === "problem") {
    return render({ photo: photo.problem.message, ...(parsed.ok ? {} : parsed.errors) }, photo.problem.status);
  }
  if (!parsed.ok) return render(parsed.errors, Object.keys(parsed.errors).length > 0 ? 400 : 200);
  const { date, odometer_km } = parsed.value;
  const conflict =
    odometer_km !== null && (await checkOdometer(c.env.DB, c.get("userId"), vehicle.id, date, odometer_km, editing));
  if (conflict) return render({ odometer_km: conflict }, 422);
  return save({ ...parsed.value, receipt_key: photo.key });
}

/** A form post too big to hold an acceptable photo is refused before it's read. */
const tooLarge = (c: Context<AppEnv>) => c.html(<PhotoTooLarge />, 413);

export function serviceRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/services/new", async (c) => {
    const vehicleId = idOf(c.req.query("vehicle"));
    const vehicle = vehicleId === null ? null : await getVehicle(c.env.DB, c.get("userId"), vehicleId);
    if (!vehicle) return notFound(c);
    return c.html(
      <ServiceForm
        today={c.get("today")}
        vehicle={vehicle}
        items={await listItems(c.env.DB, c.get("userId"), vehicle.id)}
        ownCategories={await listOwnCategoryNames(c.env.DB, c.get("userId"))}
        values={blankServiceForm(c.req.query("workshop") ?? "")}
        mode={{ kind: "new" }}
        saved={c.req.query("saved") === "1"}
        readings={await hintReadings(c.env.DB, c.get("userId"), vehicle.id)}
      />,
    );
  });

  routes.post("/services", async (c) => {
    if (uploadTooLarge(c.req.raw)) return tooLarge(c);
    const userId = c.get("userId");
    const body = await c.req.parseBody();
    const vehicleId = idOf(body.vehicle_id);
    const vehicle = vehicleId === null ? null : await getVehicle(c.env.DB, userId, vehicleId);
    if (!vehicle) return notFound(c);

    // The same new-visit form sent again (a second tap on Save while the first was on its way) still
    // carries the receipt the first submit saved: show that visit rather than refusing the photo.
    const postedKey = typeof body.receipt_key === "string" ? body.receipt_key.trim() : "";
    if (postedKey !== "" && isOwnKey(postedKey, userId)) {
      const saved = await serviceWithReceipt(c.env.DB, userId, postedKey);
      if (saved) return c.redirect(`/vehicles/${saved.vehicle_id}?stamped=${saved.id}`, 302);
    }

    return submitService(c, body, vehicle, { kind: "new" }, null, async (s) => {
      const id = await createService(c.env.DB, userId, vehicle.id, s);
      if (id === null) return notFound(c);
      // Back to the vehicle, where the new visit lands as the highlighted stamp.
      if (body.action !== "save_add") return c.redirect(`/vehicles/${vehicle.id}?stamped=${id}`, 302);
      const next = new URLSearchParams({ vehicle: String(vehicle.id), workshop: s.workshop, saved: "1" });
      return c.redirect(`/services/new?${next}`, 302);
    });
  });

  routes.get("/services/:id{[0-9]+}", async (c) => {
    const owned = await ownedService(c);
    if (!owned) return notFound(c);
    const items = await listItems(c.env.DB, c.get("userId"), owned.vehicle.id);
    return c.html(<ServiceView vehicle={owned.vehicle} service={owned.service} items={items} today={c.get("today")} />);
  });

  routes.get("/services/:id{[0-9]+}/edit", async (c) => {
    const owned = await ownedService(c);
    if (!owned) return notFound(c);
    return c.html(
      <ServiceForm
        today={c.get("today")}
        vehicle={owned.vehicle}
        items={await listItems(c.env.DB, c.get("userId"), owned.vehicle.id)}
        ownCategories={await listOwnCategoryNames(c.env.DB, c.get("userId"))}
        values={serviceFormValuesOf(owned.service)}
        mode={{ kind: "edit", serviceId: owned.service.id }}
        receiptKey={owned.service.receipt_key}
        readings={await hintReadings(c.env.DB, c.get("userId"), owned.vehicle.id, owned.service.id)}
      />,
    );
  });

  routes.post("/services/:id{[0-9]+}", async (c) => {
    if (uploadTooLarge(c.req.raw)) return tooLarge(c);
    const owned = await ownedService(c);
    if (!owned) return notFound(c);
    const { id, receipt_key: oldKey } = owned.service;
    const mode = { kind: "edit", serviceId: id } as const;
    return submitService(c, await c.req.parseBody(), owned.vehicle, mode, oldKey, async (s) => {
      if (!(await updateService(c.env.DB, c.get("userId"), id, s))) return notFound(c);
      if (oldKey !== s.receipt_key) await deletePhoto(c.env.RECEIPTS, oldKey);
      return c.redirect(`/services/${id}`, 302);
    });
  });

  routes.post("/services/:id{[0-9]+}/delete", async (c) => {
    const deleted = await deleteService(c.env.DB, c.get("userId"), Number(c.req.param("id")));
    if (!deleted) return notFound(c);
    await deletePhoto(c.env.RECEIPTS, deleted.receiptKey);
    return c.redirect(`/vehicles/${deleted.vehicleId}`, 302);
  });

  return routes;
}

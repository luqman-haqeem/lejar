import type { Context } from "hono";
import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import {
  createService,
  deleteService,
  getService,
  getVehicle,
  listItems,
  type ServiceInput,
  updateService,
  type Vehicle,
} from "./db";
import type { Body } from "./form";
import { checkOdometer } from "./odometer";
import { blankServiceForm, parseServiceForm, readServiceForm, serviceFormValuesOf } from "./service-form";
import { NotFound } from "./views/NotFound";
import { ServiceForm, type ServiceFormMode } from "./views/ServiceForm";
import { ServiceView } from "./views/ServiceView";

const notFound = (c: Context<AppEnv>) => c.html(<NotFound />, 404);
const idOf = (s: unknown) => (typeof s === "string" && /^\d+$/.test(s) ? Number(s) : null);

/** The user's service from the :id param, with its vehicle; null if it isn't theirs. */
async function ownedService(c: Context<AppEnv>) {
  const userId = c.get("userId");
  const service = await getService(c.env.DB, userId, Number(c.req.param("id")));
  const vehicle = service && (await getVehicle(c.env.DB, userId, service.vehicle_id));
  return service && vehicle ? { service, vehicle } : null;
}

/**
 * Validates a posted service form and checks its odometer against the vehicle's other readings.
 * A line tagged with another vehicle's schedule item is a 404.
 * Re-renders the form (400 invalid, 422 odometer conflict) keeping what was typed, or calls `save`.
 */
async function submitService(
  c: Context<AppEnv>,
  body: Body,
  vehicle: Vehicle,
  mode: ServiceFormMode,
  save: (s: ServiceInput) => Promise<Response>,
): Promise<Response> {
  const items = await listItems(c.env.DB, c.get("userId"), vehicle.id);
  const values = readServiceForm(body);
  // Tagging a line with a schedule item that isn't this vehicle's is treated like any other id that
  // isn't the user's: 404, nothing saved.
  const itemIds = new Set(items.map((i) => String(i.id)));
  if (values.lines.some((l) => l.item !== "" && !itemIds.has(l.item))) return notFound(c);
  const render = (errors: Record<string, string>, status: 400 | 422) =>
    c.html(<ServiceForm vehicle={vehicle} items={items} values={values} mode={mode} errors={errors} />, status);

  const parsed = parseServiceForm(values, items, c.get("today"));
  if (!parsed.ok) return render(parsed.errors, 400);
  const { date, odometer_km } = parsed.value;
  const editing = mode.kind === "edit" ? mode.serviceId : null;
  const conflict = await checkOdometer(c.env.DB, c.get("userId"), vehicle.id, date, odometer_km, editing);
  if (conflict) return render({ odometer_km: conflict }, 422);
  return save(parsed.value);
}

export function serviceRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/services/new", async (c) => {
    const vehicleId = idOf(c.req.query("vehicle"));
    const vehicle = vehicleId === null ? null : await getVehicle(c.env.DB, c.get("userId"), vehicleId);
    if (!vehicle) return notFound(c);
    return c.html(
      <ServiceForm
        vehicle={vehicle}
        items={await listItems(c.env.DB, c.get("userId"), vehicle.id)}
        values={blankServiceForm(c.req.query("workshop") ?? "")}
        mode={{ kind: "new" }}
        saved={c.req.query("saved") === "1"}
      />,
    );
  });

  routes.post("/services", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.parseBody();
    const vehicleId = idOf(body.vehicle_id);
    const vehicle = vehicleId === null ? null : await getVehicle(c.env.DB, userId, vehicleId);
    if (!vehicle) return notFound(c);

    return submitService(c, body, vehicle, { kind: "new" }, async (s) => {
      if ((await createService(c.env.DB, userId, vehicle.id, s)) === null) return notFound(c);
      if (body.action !== "save_add") return c.redirect(`/vehicles/${vehicle.id}`, 302);
      const next = new URLSearchParams({ vehicle: String(vehicle.id), workshop: s.workshop, saved: "1" });
      return c.redirect(`/services/new?${next}`, 302);
    });
  });

  routes.get("/services/:id{[0-9]+}", async (c) => {
    const owned = await ownedService(c);
    if (!owned) return notFound(c);
    const items = await listItems(c.env.DB, c.get("userId"), owned.vehicle.id);
    return c.html(<ServiceView vehicle={owned.vehicle} service={owned.service} items={items} />);
  });

  routes.get("/services/:id{[0-9]+}/edit", async (c) => {
    const owned = await ownedService(c);
    if (!owned) return notFound(c);
    return c.html(
      <ServiceForm
        vehicle={owned.vehicle}
        items={await listItems(c.env.DB, c.get("userId"), owned.vehicle.id)}
        values={serviceFormValuesOf(owned.service)}
        mode={{ kind: "edit", serviceId: owned.service.id }}
      />,
    );
  });

  routes.post("/services/:id{[0-9]+}", async (c) => {
    const owned = await ownedService(c);
    if (!owned) return notFound(c);
    const id = owned.service.id;
    return submitService(c, await c.req.parseBody(), owned.vehicle, { kind: "edit", serviceId: id }, async (s) => {
      if (!(await updateService(c.env.DB, c.get("userId"), id, s))) return notFound(c);
      return c.redirect(`/services/${id}`, 302);
    });
  });

  routes.post("/services/:id{[0-9]+}/delete", async (c) => {
    const deleted = await deleteService(c.env.DB, c.get("userId"), Number(c.req.param("id")));
    if (!deleted) return notFound(c);
    // Ticket 05 removes deleted.receiptKey from R2 here.
    return c.redirect(`/vehicles/${deleted.vehicleId}`, 302);
  });

  return routes;
}

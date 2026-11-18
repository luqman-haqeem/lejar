import type { Context } from "hono";
import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { createService, deleteService, getService, getVehicle, listItems, updateService } from "./db";
import { checkOdometer } from "./odometer";
import { parseServiceForm, readServiceForm, serviceFormValuesOf } from "./service-form";
import { NotFound } from "./views/NotFound";
import { ServiceForm } from "./views/ServiceForm";
import { ServiceView } from "./views/ServiceView";

const notFound = (c: Context<AppEnv>) => c.html(<NotFound />, 404);
const idOf = (s: string | undefined) => (s && /^\d+$/.test(s) ? Number(s) : null);

export function serviceRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/services/new", async (c) => {
    const vehicleId = idOf(c.req.query("vehicle"));
    const vehicle = vehicleId === null ? null : await getVehicle(c.env.DB, c.get("userId"), vehicleId);
    if (!vehicle) return notFound(c);

    const values = readServiceForm({ workshop: c.req.query("workshop") ?? "" });
    return c.html(
      <ServiceForm
        vehicle={vehicle}
        items={await listItems(c.env.DB, vehicle.id)}
        values={values}
        mode={{ kind: "new" }}
        saved={c.req.query("saved") === "1"}
      />,
    );
  });

  routes.post("/services", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.parseBody();
    const vehicleId = idOf(typeof body.vehicle_id === "string" ? body.vehicle_id : undefined);
    const vehicle = vehicleId === null ? null : await getVehicle(c.env.DB, userId, vehicleId);
    if (!vehicle) return notFound(c);

    const items = await listItems(c.env.DB, vehicle.id);
    const values = readServiceForm(body);
    const render = (errors: Record<string, string>, status: 400 | 422) =>
      c.html(<ServiceForm vehicle={vehicle} items={items} values={values} mode={{ kind: "new" }} errors={errors} />, status);

    const parsed = parseServiceForm(values, items);
    if (!parsed.ok) return render(parsed.errors, 400);
    const conflict = await checkOdometer(c.env.DB, vehicle.id, parsed.value.date, parsed.value.odometer_km);
    if (conflict) return render({ odometer_km: conflict }, 422);

    if ((await createService(c.env.DB, userId, vehicle.id, parsed.value)) === null) return notFound(c);
    if (body.action === "save_add") {
      const next = new URLSearchParams({ vehicle: String(vehicle.id), workshop: parsed.value.workshop, saved: "1" });
      return c.redirect(`/services/new?${next}`, 302);
    }
    return c.redirect(`/vehicles/${vehicle.id}`, 302);
  });

  routes.get("/services/:id{[0-9]+}", async (c) => {
    const userId = c.get("userId");
    const service = await getService(c.env.DB, userId, Number(c.req.param("id")));
    const vehicle = service && (await getVehicle(c.env.DB, userId, service.vehicle_id));
    if (!service || !vehicle) return notFound(c);
    return c.html(<ServiceView vehicle={vehicle} service={service} items={await listItems(c.env.DB, vehicle.id)} />);
  });

  routes.get("/services/:id{[0-9]+}/edit", async (c) => {
    const userId = c.get("userId");
    const service = await getService(c.env.DB, userId, Number(c.req.param("id")));
    const vehicle = service && (await getVehicle(c.env.DB, userId, service.vehicle_id));
    if (!service || !vehicle) return notFound(c);
    return c.html(
      <ServiceForm
        vehicle={vehicle}
        items={await listItems(c.env.DB, vehicle.id)}
        values={serviceFormValuesOf(service)}
        mode={{ kind: "edit", serviceId: service.id }}
      />,
    );
  });

  routes.post("/services/:id{[0-9]+}", async (c) => {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    const service = await getService(c.env.DB, userId, id);
    const vehicle = service && (await getVehicle(c.env.DB, userId, service.vehicle_id));
    if (!service || !vehicle) return notFound(c);

    const items = await listItems(c.env.DB, vehicle.id);
    const values = readServiceForm(await c.req.parseBody());
    const render = (errors: Record<string, string>, status: 400 | 422) =>
      c.html(
        <ServiceForm vehicle={vehicle} items={items} values={values} mode={{ kind: "edit", serviceId: id }} errors={errors} />,
        status,
      );

    const parsed = parseServiceForm(values, items);
    if (!parsed.ok) return render(parsed.errors, 400);
    const conflict = await checkOdometer(c.env.DB, vehicle.id, parsed.value.date, parsed.value.odometer_km, id);
    if (conflict) return render({ odometer_km: conflict }, 422);

    if (!(await updateService(c.env.DB, userId, id, parsed.value))) return notFound(c);
    return c.redirect(`/services/${id}`, 302);
  });

  routes.post("/services/:id{[0-9]+}/delete", async (c) => {
    const deleted = await deleteService(c.env.DB, c.get("userId"), Number(c.req.param("id")));
    if (!deleted) return notFound(c);
    // Ticket 05 removes deleted.receiptKey from R2 here.
    return c.redirect(`/vehicles/${deleted.vehicleId}`, 302);
  });

  return routes;
}

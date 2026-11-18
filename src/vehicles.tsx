import type { Context } from "hono";
import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import {
  addReading,
  createVehicle,
  deleteManualReading,
  getVehicle,
  listArchivedVehicles,
  listItems,
  listReadings,
  listServices,
  setArchived,
  updateVehicle,
  type Vehicle,
  yearTotals,
} from "./db";
import { type FormErrors, parseCount, readFields } from "./form";
import { parseDateInput } from "./lib/dates";
import { checkOdometer } from "./odometer";
import { formValuesOf, parseDetails, parseItems, readDetails, readItems } from "./vehicle-form";
import { NotFound } from "./views/NotFound";
import { ArchivedVehicles } from "./views/ArchivedVehicles";
import { EditVehicle, NewVehicle } from "./views/VehicleForm";
import { type ReadingValues, VehicleHistory } from "./views/VehicleHistory";

const notFound = (c: Context<AppEnv>) => c.html(<NotFound />, 404);

async function history(c: Context<AppEnv>, vehicle: Vehicle, reading: ReadingValues, errors: FormErrors = {}) {
  const userId = c.get("userId");
  const [services, totals, readings] = await Promise.all([
    listServices(c.env.DB, userId, vehicle.id),
    yearTotals(c.env.DB, userId, vehicle.id),
    listReadings(c.env.DB, userId, vehicle.id),
  ]);
  const manualReadings = readings.filter((r) => r.source === "manual").reverse();
  return (
    <VehicleHistory
      vehicle={vehicle}
      services={services}
      totals={totals}
      manualReadings={manualReadings}
      reading={reading}
      errors={errors}
    />
  );
}

export function vehicleRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/vehicles/new", (c) => c.html(<NewVehicle values={readDetails({})} />));

  routes.post("/vehicles", async (c) => {
    const values = readDetails(await c.req.parseBody());
    const details = parseDetails(values, c.get("today"));
    if (!details.ok) return c.html(<NewVehicle values={values} errors={details.errors} />, 400);

    const id = await createVehicle(c.env.DB, c.get("userId"), details.value);
    return c.redirect(`/vehicles/${id}/edit`, 302);
  });

  routes.get("/vehicles/:id{[0-9]+}", async (c) => {
    const vehicle = await getVehicle(c.env.DB, c.get("userId"), Number(c.req.param("id")));
    if (!vehicle) return notFound(c);
    return c.html(await history(c, vehicle, { date: c.get("today"), km: "" }));
  });

  routes.post("/vehicles/:id{[0-9]+}/readings", async (c) => {
    const vehicle = await getVehicle(c.env.DB, c.get("userId"), Number(c.req.param("id")));
    if (!vehicle) return notFound(c);

    const values = readFields(await c.req.parseBody(), ["date", "km"], ["date"]);
    const errors: FormErrors = {};
    const date = parseDateInput(values.date);
    if (date === null) errors.date = "Enter the date of the reading.";
    else if (date > c.get("today")) errors.date = "The reading date can't be in the future.";
    const km = parseCount(values.km, 0, 10_000_000);
    if (km == null) errors.km = "Enter the odometer reading in whole km.";
    if (Object.keys(errors).length > 0) return c.html(await history(c, vehicle, values, errors), 400);

    const conflict = await checkOdometer(c.env.DB, c.get("userId"), vehicle.id, date!, km!);
    if (conflict) return c.html(await history(c, vehicle, values, { km: conflict }), 422);

    await addReading(c.env.DB, c.get("userId"), vehicle.id, date!, km!);
    return c.redirect(`/vehicles/${vehicle.id}`, 302);
  });

  routes.post("/readings/:id{[0-9]+}/delete", async (c) => {
    const vehicleId = await deleteManualReading(c.env.DB, c.get("userId"), Number(c.req.param("id")));
    if (vehicleId === null) return notFound(c);
    return c.redirect(`/vehicles/${vehicleId}`, 302);
  });

  routes.get("/vehicles/:id{[0-9]+}/edit", async (c) => {
    const id = Number(c.req.param("id"));
    const vehicle = await getVehicle(c.env.DB, c.get("userId"), id);
    if (!vehicle) return notFound(c);

    const values = formValuesOf(vehicle, await listItems(c.env.DB, c.get("userId"), id));
    return c.html(
      <EditVehicle id={id} values={values} archived={vehicle.archived === 1} saved={c.req.query("saved") === "1"} />,
    );
  });

  routes.post("/vehicles/:id{[0-9]+}", async (c) => {
    const id = Number(c.req.param("id"));
    const userId = c.get("userId");
    const vehicle = await getVehicle(c.env.DB, userId, id);
    if (!vehicle) return notFound(c);

    const body = await c.req.parseBody();
    // The type is fixed at creation: the schedule was seeded for it, and due-soon thresholds depend on it.
    const values = { details: { ...readDetails(body), type: vehicle.type }, items: readItems(body) };
    const details = parseDetails(values.details, c.get("today"));
    const items = parseItems(values.items, c.get("today"));
    if (!details.ok || !items.ok) {
      const errors = { ...(details.ok ? {} : details.errors), ...(items.ok ? {} : items.errors) };
      return c.html(<EditVehicle id={id} values={values} archived={vehicle.archived === 1} errors={errors} />, 400);
    }

    if (!(await updateVehicle(c.env.DB, userId, id, details.value, items.value))) return notFound(c);
    return c.redirect(`/vehicles/${id}/edit?saved=1`, 302);
  });

  routes.post("/vehicles/:id{[0-9]+}/archive", async (c) => {
    if (!(await setArchived(c.env.DB, c.get("userId"), Number(c.req.param("id")), true))) return notFound(c);
    return c.redirect("/", 302);
  });

  routes.post("/vehicles/:id{[0-9]+}/restore", async (c) => {
    if (!(await setArchived(c.env.DB, c.get("userId"), Number(c.req.param("id")), false))) return notFound(c);
    return c.redirect("/", 302);
  });

  routes.get("/vehicles/archived", async (c) =>
    c.html(<ArchivedVehicles vehicles={await listArchivedVehicles(c.env.DB, c.get("userId"))} />),
  );

  return routes;
}

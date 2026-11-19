import type { Context } from "hono";
import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { vehicleDue } from "./dashboard";
import { notFound } from "./http";
import {
  addReading,
  createVehicle,
  deleteManualReading,
  getVehicle,
  listArchivedVehicles,
  listItems,
  listServices,
  setArchived,
  updateVehicle,
  vehicleDueData,
  type Vehicle,
  yearTotals,
} from "./db";
import { type FormErrors, parseCount, readFields } from "./form";
import { parseDateInput } from "./lib/dates";
import { checkOdometer } from "./odometer";
import { formValuesOf, parseDetails, parseItems, readDetails, readItems } from "./vehicle-form";
import { ArchivedVehicles } from "./views/ArchivedVehicles";
import { EditVehicle, isAddFrom, NewVehicle } from "./views/VehicleForm";
import { type ReadingValues, VehicleHistory } from "./views/VehicleHistory";


async function history(
  c: Context<AppEnv>,
  vehicle: Vehicle,
  reading: ReadingValues,
  errors: FormErrors = {},
  stamped: number | null = null,
  added = false,
) {
  const userId = c.get("userId");
  const [services, totals, { items, lastDone, readings }] = await Promise.all([
    listServices(c.env.DB, userId, vehicle.id),
    yearTotals(c.env.DB, userId, vehicle.id),
    vehicleDueData(c.env.DB, userId, vehicle.id),
  ]);
  const due = vehicleDue({ vehicle, items, lastDone, readings }, c.get("today"));
  const manualReadings = readings.filter((r) => r.source === "manual").reverse();
  return (
    <VehicleHistory
      vehicle={vehicle}
      due={due}
      services={services}
      totals={totals}
      manualReadings={manualReadings}
      reading={reading}
      errors={errors}
      stamped={stamped}
      added={added}
    />
  );
}

export function vehicleRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/vehicles/new", (c) => {
    const from = c.req.query("from");
    return c.html(<NewVehicle values={readDetails({})} from={isAddFrom(from) ? from : "profile"} />);
  });

  // A new vehicle opens its own page, which leads with the first step (scan the last receipt); one added
  // on the way to Scan goes straight on to Scan.
  routes.post("/vehicles", async (c) => {
    const body = await c.req.parseBody();
    const from = isAddFrom(body.from) ? body.from : "profile";
    const values = readDetails(body);
    const details = parseDetails(values, c.get("today"));
    if (!details.ok) return c.html(<NewVehicle values={values} errors={details.errors} from={from} />, 400);

    const id = await createVehicle(c.env.DB, c.get("userId"), details.value);
    return c.redirect(from === "scan" ? `/scan?vehicle=${id}` : `/vehicles/${id}?added=1`, 302);
  });

  routes.get("/vehicles/:id{[0-9]+}", async (c) => {
    const vehicle = await getVehicle(c.env.DB, c.get("userId"), Number(c.req.param("id")));
    if (!vehicle) return notFound(c);
    const stamped = Number(c.req.query("stamped"));
    return c.html(
      await history(
        c,
        vehicle,
        { date: c.get("today"), km: "" },
        {},
        Number.isInteger(stamped) ? stamped : null,
        c.req.query("added") === "1",
      ),
    );
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

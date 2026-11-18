import type { Context } from "hono";
import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { archiveVehicle, createVehicle, getVehicle, listItems, updateVehicle } from "./db";
import { detailValues, formValuesOf, itemValues, parseDetails, parseItems } from "./vehicle-form";
import { NotFound } from "./views/NotFound";
import { EditVehicle, NewVehicle } from "./views/VehicleForm";

const notFound = (c: Context<AppEnv>) => c.html(<NotFound />, 404);

export function vehicleRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/vehicles/new", (c) => c.html(<NewVehicle values={detailValues({})} />));

  routes.post("/vehicles", async (c) => {
    const values = detailValues(await c.req.parseBody());
    const details = parseDetails(values);
    if (!details.ok) return c.html(<NewVehicle values={values} errors={details.errors} />, 400);

    const id = await createVehicle(c.env.DB, c.get("userId"), details.value);
    return c.redirect(`/vehicles/${id}/edit`, 302);
  });

  routes.get("/vehicles/:id{[0-9]+}/edit", async (c) => {
    const id = Number(c.req.param("id"));
    const vehicle = await getVehicle(c.env.DB, c.get("userId"), id);
    if (!vehicle) return notFound(c);

    const values = formValuesOf(vehicle, await listItems(c.env.DB, id));
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
    const values = { details: detailValues(body), items: itemValues(body) };
    const details = parseDetails(values.details);
    const items = parseItems(values.items);
    if (!details.ok || !items.ok) {
      const errors = { ...(details.ok ? {} : details.errors), ...(items.ok ? {} : items.errors) };
      return c.html(<EditVehicle id={id} values={values} archived={vehicle.archived === 1} errors={errors} />, 400);
    }

    if (!(await updateVehicle(c.env.DB, userId, id, details.value, items.value))) return notFound(c);
    return c.redirect(`/vehicles/${id}/edit?saved=1`, 302);
  });

  routes.post("/vehicles/:id{[0-9]+}/archive", async (c) => {
    if (!(await archiveVehicle(c.env.DB, c.get("userId"), Number(c.req.param("id"))))) return notFound(c);
    return c.redirect("/", 302);
  });

  return routes;
}

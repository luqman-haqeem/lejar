import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { getVehicle, listServicesWithLines } from "./db";
import { notFound } from "./http";
import { PrintHistory } from "./views/PrintHistory";

export function printRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/vehicles/:id{[0-9]+}/print", async (c) => {
    const userId = c.get("userId");
    const vehicle = await getVehicle(c.env.DB, userId, Number(c.req.param("id")));
    if (!vehicle) return notFound(c);
    const services = await listServicesWithLines(c.env.DB, userId, vehicle.id);
    return c.html(<PrintHistory vehicle={vehicle} services={services} today={c.get("today")} />);
  });

  return routes;
}

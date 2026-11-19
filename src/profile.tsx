import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { countArchivedVehicles, listVehicles } from "./db";
import { getUserEmail } from "./users";
import { Profile } from "./views/Profile";

export function profileRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/profile", async (c) => {
    const userId = c.get("userId");
    const [email, vehicles, archived] = await Promise.all([
      getUserEmail(c.env.DB, userId),
      listVehicles(c.env.DB, userId),
      countArchivedVehicles(c.env.DB, userId),
    ]);
    return c.html(<Profile email={email} vehicles={vehicles} archivedCount={archived} />);
  });

  return routes;
}

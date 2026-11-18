import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "./app-types";
import { authRoutes, SESSION_COOKIE } from "./auth";
import { verifySession } from "./session";
import { Dashboard } from "./views/Dashboard";
import { Login } from "./views/Login";

export type AppDeps = { fetchFn?: typeof fetch };

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>();

  app.get("/healthz", (c) => c.text("ok"));
  app.get("/login", (c) => c.html(<Login />));
  app.route("/", authRoutes(deps.fetchFn));

  app.use("*", async (c, next) => {
    const userId = await verifySession(getCookie(c, SESSION_COOKIE), c.env.SESSION_SECRET);
    if (userId === null) return c.redirect("/login", 302);
    c.set("userId", userId);
    await next();
  });

  app.get("/", (c) => c.html(<Dashboard />));

  return app;
}

export default createApp();

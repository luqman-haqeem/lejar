import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "./app-types";
import { authRoutes, SESSION_COOKIE } from "./auth";
import { dashboardRoutes } from "./dashboard";
import { todayKL } from "./lib/dates";
import { verifySession } from "./session";
import { printRoutes } from "./print";
import { receiptRoutes } from "./receipts";
import { scanRoutes } from "./scan";
import { serviceRoutes } from "./services";
import { vehicleRoutes } from "./vehicles";
import { Login } from "./views/Login";

/** Injectable for tests: the fetch used for Google, the one used for OpenRouter, and the clock that decides "today". */
export type AppDeps = { fetchFn?: typeof fetch; aiFetch?: typeof fetch; now?: () => Date };

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>();

  app.get("/healthz", (c) => c.text("ok"));
  app.get("/login", (c) => c.html(<Login />));
  app.route("/", authRoutes(deps.fetchFn));

  app.use("*", async (c, next) => {
    const userId = await verifySession(getCookie(c, SESSION_COOKIE), c.env.SESSION_SECRET);
    if (userId === null) return c.redirect("/login", 302);
    c.set("userId", userId);
    c.set("today", todayKL(deps.now?.() ?? new Date()));
    await next();
  });

  app.route("/", dashboardRoutes());
  app.route("/", vehicleRoutes());
  app.route("/", printRoutes());
  app.route("/", serviceRoutes());
  app.route("/", receiptRoutes());
  app.route("/", scanRoutes(deps.aiFetch));

  return app;
}

export default createApp();

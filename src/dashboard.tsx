import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { lastDoneByItem, listItems, listReadings, listVehicles, type Vehicle } from "./db";
import { estimateKm, expiryStatus, itemDue, odometerState, sortByUrgency } from "./lib/due";
import { Dashboard, type VehicleDue } from "./views/Dashboard";

async function vehicleDue(db: D1Database, userId: number, vehicle: Vehicle, today: string): Promise<VehicleDue> {
  const [items, lastDone, readings] = await Promise.all([
    listItems(db, vehicle.id),
    lastDoneByItem(db, userId, vehicle.id),
    listReadings(db, userId, vehicle.id),
  ]);
  const estKm = estimateKm(readings, today);
  return {
    vehicle,
    estKm,
    odometer: odometerState(readings, today),
    items: sortByUrgency(items.map((i) => itemDue(i, lastDone.get(i.id) ?? null, estKm, vehicle.type, today))),
    roadtax: expiryStatus(vehicle.roadtax_expiry, today),
    insurance: expiryStatus(vehicle.insurance_expiry, today),
  };
}

export function dashboardRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/", async (c) => {
    const userId = c.get("userId");
    const vehicles = await listVehicles(c.env.DB, userId);
    const due = await Promise.all(vehicles.map((v) => vehicleDue(c.env.DB, userId, v, c.get("today"))));
    return c.html(<Dashboard vehicles={due} />);
  });

  return routes;
}

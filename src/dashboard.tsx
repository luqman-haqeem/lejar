import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { dashboardData, type DashboardVehicle } from "./db";
import { estimateKm, expiryStatus, itemDue, odometerState, sortByUrgency } from "./lib/due";
import { Dashboard, type VehicleDue } from "./views/Dashboard";

export function vehicleDue({ vehicle, items, lastDone, readings }: DashboardVehicle, today: string): VehicleDue {
  const estKm = estimateKm(readings, today);
  const due = items.map((i) => itemDue(i, lastDone.get(i.id) ?? null, estKm, vehicle.type, today));
  return {
    vehicle,
    estKm,
    // Started once anything sets a schedule clock: a logged visit (it records a reading) or a baseline.
    started: readings.some((r) => r.source === "service") || due.some((i) => i.lastDate !== null || i.lastKm !== null),
    odometer: odometerState(readings, today),
    items: sortByUrgency(due),
    roadtax: expiryStatus(vehicle.roadtax_expiry, today),
    insurance: expiryStatus(vehicle.insurance_expiry, today),
  };
}

export function dashboardRoutes() {
  const routes = new Hono<AppEnv>();

  routes.get("/", async (c) => {
    const { vehicles, archivedCount } = await dashboardData(c.env.DB, c.get("userId"));
    const today = c.get("today");
    return c.html(<Dashboard vehicles={vehicles.map((v) => vehicleDue(v, today))} archivedCount={archivedCount} />);
  });

  return routes;
}

import { findOdometerConflict } from "./db";
import { fmtDate } from "./lib/dates";
import { fmtKm } from "./lib/km";

/**
 * Null when `km` on `date` fits the vehicle's other readings, otherwise a message naming the nearest
 * reading it contradicts. `excludeServiceId` skips a service's own reading when it's being edited.
 */
export async function checkOdometer(
  db: D1Database,
  userId: number,
  vehicleId: number,
  date: string,
  km: number,
  excludeServiceId: number | null = null,
): Promise<string | null> {
  const conflict = await findOdometerConflict(db, userId, vehicleId, date, km, excludeServiceId);
  return conflict && `Odometer ${fmtKm(km)} conflicts with ${fmtDate(conflict.date)} reading of ${fmtKm(conflict.km)}`;
}

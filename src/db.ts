import { TEMPLATES, type VehicleType } from "./lib/templates";

// Vehicle functions take userId and filter by vehicles.user_id. Item functions take a vehicleId the
// caller has already checked with getVehicle (or check it themselves, like updateVehicle).

export interface Vehicle {
  id: number;
  user_id: number;
  type: VehicleType;
  name: string;
  plate: string;
  make: string;
  model: string;
  year: number | null;
  roadtax_expiry: string | null;
  insurance_expiry: string | null;
  insurer: string;
  archived: number;
}

export type VehicleDetails = Omit<Vehicle, "id" | "user_id" | "archived">;

export interface ServiceItem {
  id: number;
  vehicle_id: number;
  name: string;
  interval_km: number | null;
  interval_months: number | null;
  baseline_date: string | null;
  baseline_km: number | null;
  sort: number;
}

/** A schedule row as edited: rows with an id update that item, rows without one are new. */
export type ItemInput = Omit<ServiceItem, "id" | "vehicle_id" | "sort"> & { id?: number };

/** The vehicle columns a user edits, in one place for the SQL and the form. */
export const DETAIL_COLUMNS = [
  "type",
  "name",
  "plate",
  "make",
  "model",
  "year",
  "roadtax_expiry",
  "insurance_expiry",
  "insurer",
] as const satisfies readonly (keyof VehicleDetails)[];

const bindDetails = (v: VehicleDetails) => DETAIL_COLUMNS.map((k) => v[k]);

/** Inserts the vehicle and seeds its schedule from the template for its type. */
export async function createVehicle(db: D1Database, userId: number, v: VehicleDetails): Promise<number> {
  // One batch (one transaction), so a vehicle never exists without its schedule. Inside it, the
  // user's highest vehicle id is the row just inserted.
  const insertItem = db.prepare(
    `INSERT INTO service_items (vehicle_id, name, interval_km, interval_months, sort)
     VALUES ((SELECT max(id) FROM vehicles WHERE user_id = ?), ?, ?, ?, ?)`,
  );
  const [inserted] = await db.batch<{ id: number }>([
    db
      .prepare(
        `INSERT INTO vehicles (user_id, ${DETAIL_COLUMNS.join(", ")}, created_at)
         VALUES (?, ${DETAIL_COLUMNS.map(() => "?").join(", ")}, ?) RETURNING id`,
      )
      .bind(userId, ...bindDetails(v), new Date().toISOString()),
    ...TEMPLATES[v.type].map((t, i) => insertItem.bind(userId, t.name, t.interval_km, t.interval_months, i)),
  ]);
  return inserted.results[0].id;
}

/** The vehicle, or null if it doesn't exist or isn't this user's. Includes archived vehicles. */
export async function getVehicle(db: D1Database, userId: number, id: number): Promise<Vehicle | null> {
  return db.prepare("SELECT * FROM vehicles WHERE id = ? AND user_id = ?").bind(id, userId).first<Vehicle>();
}

/** The user's vehicles that aren't archived, by name. */
export async function listVehicles(db: D1Database, userId: number): Promise<Vehicle[]> {
  const { results } = await db
    .prepare("SELECT * FROM vehicles WHERE user_id = ? AND archived = 0 ORDER BY name COLLATE NOCASE, id")
    .bind(userId)
    .all<Vehicle>();
  return results;
}

/** The vehicle's schedule in display order. Callers check ownership with getVehicle first. */
export async function listItems(db: D1Database, vehicleId: number): Promise<ServiceItem[]> {
  const { results } = await db
    .prepare("SELECT * FROM service_items WHERE vehicle_id = ? ORDER BY sort, id")
    .bind(vehicleId)
    .all<ServiceItem>();
  return results;
}

/**
 * Saves the vehicle's details and replaces its schedule with `items`, in one batch: rows with an id
 * update that item, rows without one are inserted, and items left out are deleted. Ids that aren't
 * this vehicle's are treated as new rows. Returns false (changing nothing) if the vehicle isn't the user's.
 */
export async function updateVehicle(
  db: D1Database,
  userId: number,
  id: number,
  v: VehicleDetails,
  items: ItemInput[],
): Promise<boolean> {
  if (!(await getVehicle(db, userId, id))) return false;
  const existing = new Set((await listItems(db, id)).map((i) => i.id));
  const kept = new Set(items.flatMap((i) => (i.id !== undefined && existing.has(i.id) ? [i.id] : [])));

  const statements = [
    db
      .prepare(`UPDATE vehicles SET ${DETAIL_COLUMNS.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND user_id = ?`)
      .bind(...bindDetails(v), id, userId),
    ...[...existing]
      .filter((itemId) => !kept.has(itemId))
      .map((itemId) => db.prepare("DELETE FROM service_items WHERE id = ? AND vehicle_id = ?").bind(itemId, id)),
    ...items.map((item, sort) => {
      const fields = [item.name, item.interval_km, item.interval_months, item.baseline_date, item.baseline_km, sort];
      return item.id !== undefined && kept.has(item.id)
        ? db
            .prepare(
              `UPDATE service_items SET name = ?, interval_km = ?, interval_months = ?, baseline_date = ?,
               baseline_km = ?, sort = ? WHERE id = ? AND vehicle_id = ?`,
            )
            .bind(...fields, item.id, id)
        : db
            .prepare(
              `INSERT INTO service_items (name, interval_km, interval_months, baseline_date, baseline_km, sort, vehicle_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(...fields, id);
    }),
  ];
  await db.batch(statements);
  return true;
}

/** Hides the vehicle from the dashboard. Returns false if it isn't the user's. */
export async function archiveVehicle(db: D1Database, userId: number, id: number): Promise<boolean> {
  const res = await db.prepare("UPDATE vehicles SET archived = 1 WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return res.meta.changes > 0;
}

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

// ---- Services, their lines, and odometer readings ----

export interface Service {
  id: number;
  vehicle_id: number;
  date: string;
  odometer_km: number;
  workshop: string;
  total_sen: number;
  notes: string;
  receipt_key: string | null;
}

export interface ServiceLine {
  id: number;
  service_id: number;
  description: string;
  cost_sen: number | null;
  service_item_id: number | null;
  sort: number;
}

export type ServiceWithLines = Service & { lines: ServiceLine[] };

export type LineInput = Pick<ServiceLine, "description" | "cost_sen" | "service_item_id">;
export type ServiceInput = Pick<Service, "date" | "odometer_km" | "workshop" | "total_sen" | "notes"> & {
  lines: LineInput[];
};

export interface Reading {
  id: number;
  vehicle_id: number;
  date: string;
  km: number;
  source: "service" | "manual";
  service_id: number | null;
}

// Inside a batch, the vehicle's highest service id is the service just inserted.
const NEW_SERVICE_ID = "(SELECT max(id) FROM services WHERE vehicle_id = ?)";

/** Line inserts for a service. A schedule item that isn't this vehicle's is stored as no link. */
function insertLines(db: D1Database, serviceId: number | null, vehicleId: number, lines: LineInput[]) {
  const serviceRef = serviceId === null ? NEW_SERVICE_ID : "?";
  const stmt = db.prepare(
    `INSERT INTO service_lines (service_id, description, cost_sen, service_item_id, sort)
     VALUES (${serviceRef}, ?, ?, (SELECT id FROM service_items WHERE id = ? AND vehicle_id = ?), ?)`,
  );
  return lines.map((l, sort) =>
    stmt.bind(serviceId ?? vehicleId, l.description, l.cost_sen, l.service_item_id, vehicleId, sort),
  );
}

/**
 * Writes the service, its lines and its odometer reading in one batch. Returns the new id, or null
 * (writing nothing) if the vehicle isn't the user's.
 */
export async function createService(
  db: D1Database,
  userId: number,
  vehicleId: number,
  s: ServiceInput,
): Promise<number | null> {
  if (!(await getVehicle(db, userId, vehicleId))) return null;
  const [inserted] = await db.batch<{ id: number }>([
    db
      .prepare(
        `INSERT INTO services (vehicle_id, date, odometer_km, workshop, total_sen, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(vehicleId, s.date, s.odometer_km, s.workshop, s.total_sen, s.notes, new Date().toISOString()),
    ...insertLines(db, null, vehicleId, s.lines),
    db
      .prepare(
        `INSERT INTO odometer_readings (vehicle_id, date, km, source, service_id)
         VALUES (?, ?, ?, 'service', ${NEW_SERVICE_ID})`,
      )
      .bind(vehicleId, s.date, s.odometer_km, vehicleId),
  ]);
  return inserted.results[0].id;
}

/** The service with its lines, or null if it doesn't exist or isn't the user's. */
export async function getService(db: D1Database, userId: number, id: number): Promise<ServiceWithLines | null> {
  const service = await db
    .prepare(
      `SELECT s.* FROM services s JOIN vehicles v ON v.id = s.vehicle_id
       WHERE s.id = ? AND v.user_id = ?`,
    )
    .bind(id, userId)
    .first<Service>();
  if (!service) return null;
  const { results } = await db
    .prepare("SELECT * FROM service_lines WHERE service_id = ? ORDER BY sort, id")
    .bind(id)
    .all<ServiceLine>();
  return { ...service, lines: results };
}

/** Replaces the service's fields and lines and moves its reading. Returns false if it isn't the user's. */
export async function updateService(db: D1Database, userId: number, id: number, s: ServiceInput): Promise<boolean> {
  const current = await getService(db, userId, id);
  if (!current) return false;
  await db.batch([
    db
      .prepare("UPDATE services SET date = ?, odometer_km = ?, workshop = ?, total_sen = ?, notes = ? WHERE id = ?")
      .bind(s.date, s.odometer_km, s.workshop, s.total_sen, s.notes, id),
    db.prepare("DELETE FROM service_lines WHERE service_id = ?").bind(id),
    ...insertLines(db, id, current.vehicle_id, s.lines),
    db.prepare("UPDATE odometer_readings SET date = ?, km = ? WHERE service_id = ?").bind(s.date, s.odometer_km, id),
  ]);
  return true;
}

/**
 * Deletes the service with its lines and odometer reading. Returns its vehicle and receipt key (for
 * the caller to remove from storage), or null if it isn't the user's.
 */
export async function deleteService(
  db: D1Database,
  userId: number,
  id: number,
): Promise<{ vehicleId: number; receiptKey: string | null } | null> {
  const service = await getService(db, userId, id);
  if (!service) return null;
  // The schema cascades the service's lines and reading.
  await db.prepare("DELETE FROM services WHERE id = ?").bind(id).run();
  return { vehicleId: service.vehicle_id, receiptKey: service.receipt_key };
}

/** Filters a table with a vehicle_id column to one vehicle of the user's. Binds (vehicleId, userId). */
const OWNED_VEHICLE = "vehicle_id IN (SELECT id FROM vehicles WHERE id = ? AND user_id = ?)";

/** The vehicle's services, newest first. Empty if the vehicle isn't the user's. */
export async function listServices(db: D1Database, userId: number, vehicleId: number): Promise<Service[]> {
  const { results } = await db
    .prepare(`SELECT * FROM services WHERE ${OWNED_VEHICLE} ORDER BY date DESC, odometer_km DESC, id DESC`)
    .bind(vehicleId, userId)
    .all<Service>();
  return results;
}

export type YearTotal = { year: string; total_sen: number };

/** Total spent per calendar year, newest year first. */
export async function yearTotals(db: D1Database, userId: number, vehicleId: number): Promise<YearTotal[]> {
  const { results } = await db
    .prepare(
      `SELECT substr(date, 1, 4) AS year, SUM(total_sen) AS total_sen FROM services
       WHERE ${OWNED_VEHICLE} GROUP BY year ORDER BY year DESC`,
    )
    .bind(vehicleId, userId)
    .all<YearTotal>();
  return results;
}

/** The vehicle's odometer readings, oldest first. */
export async function listReadings(db: D1Database, userId: number, vehicleId: number): Promise<Reading[]> {
  const { results } = await db
    .prepare(`SELECT * FROM odometer_readings WHERE ${OWNED_VEHICLE} ORDER BY date, km, id`)
    .bind(vehicleId, userId)
    .all<Reading>();
  return results;
}

/** Adds a manual reading. Returns false (writing nothing) if the vehicle isn't the user's. */
export async function addReading(
  db: D1Database,
  userId: number,
  vehicleId: number,
  date: string,
  km: number,
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO odometer_readings (vehicle_id, date, km, source)
       SELECT id, ?, ?, 'manual' FROM vehicles WHERE id = ? AND user_id = ?`,
    )
    .bind(date, km, vehicleId, userId)
    .run();
  return res.meta.changes > 0;
}

/**
 * Deletes a manual reading (a service's reading changes with the service). Returns its vehicle id,
 * or null if it isn't a manual reading of the user's.
 */
export async function deleteManualReading(db: D1Database, userId: number, id: number): Promise<number | null> {
  const row = await db
    .prepare(
      `DELETE FROM odometer_readings WHERE id = ? AND source = 'manual'
         AND vehicle_id IN (SELECT id FROM vehicles WHERE user_id = ?)
       RETURNING vehicle_id`,
    )
    .bind(id, userId)
    .first<{ vehicle_id: number }>();
  return row?.vehicle_id ?? null;
}

/**
 * The nearest-dated reading that contradicts `km` on `date` (an earlier reading with more km, or a
 * later one with fewer), ignoring the reading of `excludeServiceId`. Null when consistent.
 */
export async function findOdometerConflict(
  db: D1Database,
  userId: number,
  vehicleId: number,
  date: string,
  km: number,
  excludeServiceId: number | null = null,
): Promise<Pick<Reading, "date" | "km"> | null> {
  return db
    .prepare(
      `SELECT date, km FROM odometer_readings
       WHERE ${OWNED_VEHICLE} AND ((date < ? AND km > ?) OR (date > ? AND km < ?))
         AND (? IS NULL OR service_id IS NULL OR service_id != ?)
       ORDER BY abs(julianday(date) - julianday(?)) LIMIT 1`,
    )
    .bind(vehicleId, userId, date, km, date, km, excludeServiceId, excludeServiceId, date)
    .first<Pick<Reading, "date" | "km">>();
}

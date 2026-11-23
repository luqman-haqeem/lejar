// What's due, and when. Pure functions with no I/O; "today" is always passed in as an ISO date.

import { addMonths, daysBetween } from "./dates";
import type { VehicleType } from "./templates";

export type KmReading = { date: string; km: number };

export type DueStatus = "overdue" | "soon" | "unknown" | "ok";

export type ScheduleItem = {
  id: number;
  name: string;
  interval_km: number | null;
  interval_months: number | null;
  baseline_date: string | null;
  baseline_km: number | null;
};

export type ItemDue = {
  itemId: number;
  name: string;
  status: DueStatus;
  dueDate: string | null;
  dueKm: number | null;
  kmLeft: number | null;
  daysLeft: number | null;
  lastDate: string | null;
  lastKm: number | null;
  /**
   * For an unknown item, what would make it known: a "last done" point matching its interval, or an
   * odometer reading to compare a km due point against. Null otherwise.
   */
  needs: "last_done" | "reading" | null;
};

/** How close (in km) an item gets before it shows as due soon. */
export const SOON_KM: Record<VehicleType, number> = { car: 1000, motorbike: 300 };
export const SOON_DAYS = 14;
export const EXPIRY_SOON_DAYS = 30;
export const STALE_ODOMETER_DAYS = 30;

/**
 * Today's km: the latest reading plus the average km/day since. The average uses readings from the
 * last 12 months, plus the latest reading before that as an anchor. With fewer than two usable
 * readings (or all on one day) it's just the latest reading; with none, null.
 */
export function estimateKm(readings: KmReading[], today: string): number | null {
  if (readings.length === 0) return null;
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
  const windowStart = addMonths(today, -12);
  const inWindow = sorted.findIndex((r) => r.date >= windowStart);
  const used = inWindow === -1 ? sorted.slice(-1) : sorted.slice(Math.max(0, inWindow - 1));

  const first = used[0];
  const last = used[used.length - 1];
  const span = daysBetween(first.date, last.date);
  if (used.length < 2 || span <= 0) return last.km;
  const perDay = (last.km - first.km) / span;
  return Math.round(last.km + perDay * daysBetween(last.date, today));
}

/**
 * The km on `date` worked out from the readings: a straight line between the nearest reading on or
 * before it and the nearest on or after it (a reading on the date is its own km). Null unless there's
 * a reading on each side: it never extends past the readings.
 */
export function kmOnDate(readings: KmReading[], date: string): number | null {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
  const before = sorted.filter((r) => r.date <= date).at(-1);
  const after = sorted.find((r) => r.date >= date);
  if (!before || !after) return null;
  if (before.date === date || before.date === after.date) return before.km;
  const share = daysBetween(before.date, date) / daysBetween(before.date, after.date);
  return Math.round(before.km + (after.km - before.km) * share);
}

/** The latest Service that reset an item; `km` is null when that Service has no Odometer reading. */
export type LastDone = { date: string; km: number | null };

/**
 * The item's due point and status. "Last done" is its latest logged service, else its baseline
 * (date and/or km), else it's unknown. A latest service with no km takes the km worked out from the
 * vehicle's `readings` for its date (kmOnDate), else none, so it's due by date only.
 * Whichever of km or date comes first decides the status.
 */
export function itemDue(
  item: ScheduleItem,
  lastDone: LastDone | null,
  estKm: number | null,
  vehicleType: VehicleType,
  today: string,
  readings: KmReading[] = [],
): ItemDue {
  const lastDate = lastDone ? lastDone.date : item.baseline_date;
  const lastKm = lastDone ? (lastDone.km ?? kmOnDate(readings, lastDone.date)) : item.baseline_km;

  const dueKm = lastKm !== null && item.interval_km !== null ? lastKm + item.interval_km : null;
  const dueDate = lastDate !== null && item.interval_months !== null ? addMonths(lastDate, item.interval_months) : null;
  const kmLeft = dueKm !== null && estKm !== null ? dueKm - estKm : null;
  const daysLeft = dueDate !== null ? daysBetween(today, dueDate) : null;

  let status: DueStatus;
  if (kmLeft === null && daysLeft === null) status = "unknown";
  else if ((kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft < 0)) status = "overdue";
  else if ((kmLeft !== null && kmLeft <= SOON_KM[vehicleType]) || (daysLeft !== null && daysLeft <= SOON_DAYS))
    status = "soon";
  else status = "ok";

  const needs = status !== "unknown" ? null : dueKm !== null ? "reading" : "last_done";
  return { itemId: item.id, name: item.name, status, dueDate, dueKm, kmLeft, daysLeft, lastDate, lastKm, needs };
}

export type ExpiryStatus =
  | { status: "unset"; date: null; daysLeft: null }
  | { status: "overdue" | "soon" | "ok"; date: string; daysLeft: number };

/** Road tax or insurance: overdue on and after the expiry date, due soon within 30 days. */
export function expiryStatus(expiry: string | null, today: string): ExpiryStatus {
  if (expiry === null) return { status: "unset", date: null, daysLeft: null };
  const daysLeft = daysBetween(today, expiry);
  const status = daysLeft <= 0 ? "overdue" : daysLeft <= EXPIRY_SOON_DAYS ? "soon" : "ok";
  return { status, date: expiry, daysLeft };
}

export type OdometerState = "none" | "stale" | "fresh";

export function odometerState(readings: KmReading[], today: string): OdometerState {
  return readings.length === 0 ? "none" : odometerStale(readings, today) ? "stale" : "fresh";
}

/** True when the latest reading is more than 30 days old. No readings isn't stale: there's nothing to update. */
export function odometerStale(readings: KmReading[], today: string): boolean {
  if (readings.length === 0) return false;
  const latest = readings.reduce((max, r) => (r.date > max ? r.date : max), readings[0].date);
  return daysBetween(latest, today) > STALE_ODOMETER_DAYS;
}

const RANK: Record<DueStatus, number> = { overdue: 0, soon: 1, unknown: 2, ok: 3 };
const nullsLast = (a: number | null, b: number | null) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b;

/** Overdue, then due soon, then unknown, then OK; within each, fewest days left, then fewest km left. */
export function sortByUrgency(items: ItemDue[]): ItemDue[] {
  return [...items].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || nullsLast(a.daysLeft, b.daysLeft) || nullsLast(a.kmLeft, b.kmLeft),
  );
}

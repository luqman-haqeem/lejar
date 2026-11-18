import { DETAIL_COLUMNS, type ItemInput, type ServiceItem, type Vehicle, type VehicleDetails } from "./db";
import { type Body, type FormErrors, isBlankRow, optionalDate, type Parsed, parseCount, readFields, readRows, toField } from "./form";
import { isVehicleType, type VehicleType } from "./lib/templates";

// The vehicle form posts flat fields: the details by name, and schedule rows as
// "item.<n>.<field>" (id, name, km, months, baseline_date, baseline_km, remove).

export const DETAIL_FIELDS = DETAIL_COLUMNS;
export const ITEM_FIELDS = ["id", "name", "km", "months", "baseline_date", "baseline_km", "remove"] as const;

export type DetailValues = Record<(typeof DETAIL_FIELDS)[number], string>;
export type ItemValues = Record<(typeof ITEM_FIELDS)[number], string>;
/** What the form shows: either a saved vehicle, or exactly what the user typed. */
export type FormValues = { details: DetailValues; items: ItemValues[] };

export function readDetails(body: Body): DetailValues {
  return readFields(body, DETAIL_FIELDS, ["roadtax_expiry", "insurance_expiry"]);
}

export function readItems(body: Body): ItemValues[] {
  return readRows(body, "item", ITEM_FIELDS, ["baseline_date"]);
}

export function formValuesOf(v: Vehicle, items: ServiceItem[]): FormValues {
  return {
    details: Object.fromEntries(DETAIL_FIELDS.map((k) => [k, toField(v[k])])) as DetailValues,
    items: items.map((i) => ({
      id: String(i.id),
      name: i.name,
      km: toField(i.interval_km),
      months: toField(i.interval_months),
      baseline_date: toField(i.baseline_date),
      baseline_km: toField(i.baseline_km),
      remove: "",
    })),
  };
}

export const MAX_ITEMS = 50;

export function parseDetails(d: DetailValues, today: string): Parsed<VehicleDetails> {
  const errors: FormErrors = {};
  const thisYear = Number(today.slice(0, 4));

  if (!isVehicleType(d.type)) errors.type = "Choose car or motorbike.";
  if (!d.name) errors.name = "Give the vehicle a name.";
  const year = parseCount(d.year, 1900, thisYear + 1);
  if (year === undefined) errors.year = `Year must be between 1900 and ${thisYear + 1}.`;
  const roadtax = optionalDate(d.roadtax_expiry);
  if (roadtax === undefined) errors.roadtax_expiry = "Road tax expiry isn't a valid date.";
  const insurance = optionalDate(d.insurance_expiry);
  if (insurance === undefined) errors.insurance_expiry = "Insurance expiry isn't a valid date.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      type: d.type as VehicleType,
      name: d.name,
      plate: d.plate.toUpperCase().replace(/\s+/g, " "),
      make: d.make,
      model: d.model,
      year: year ?? null,
      roadtax_expiry: roadtax ?? null,
      insurance_expiry: insurance ?? null,
      insurer: d.insurer,
    },
  };
}

/**
 * Rows ticked "remove" and blank new rows are dropped. Every kept row needs a name and at least one
 * interval. A baseline ("last done roughly here") can't be in the future.
 */
export function parseItems(rows: ItemValues[], today: string): Parsed<ItemInput[]> {
  const errors: FormErrors = {};
  const items: ItemInput[] = [];

  rows.forEach((r, n) => {
    if (r.remove) return;
    const isNew = r.id === "";
    if (isNew && isBlankRow(r)) return;

    const key = (f: string) => `item.${n}.${f}`;
    const label = r.name || "New item";
    if (!r.name) errors[key("name")] = "Each schedule item needs a name.";

    const km = parseCount(r.km, 1, 1_000_000);
    if (km === undefined) errors[key("km")] = `${label}: km interval must be a whole number of km.`;
    const months = parseCount(r.months, 1, 240);
    if (months === undefined) errors[key("months")] = `${label}: month interval must be between 1 and 240.`;
    if (km === null && months === null) errors[key("km")] = `${label}: set a km or a month interval.`;

    const baselineDate = optionalDate(r.baseline_date);
    if (baselineDate === undefined) errors[key("baseline_date")] = `${label}: last done date isn't a valid date.`;
    else if (baselineDate !== null && baselineDate > today)
      errors[key("baseline_date")] = `${label}: last done date can't be in the future.`;
    const baselineKm = parseCount(r.baseline_km, 0, 10_000_000);
    if (baselineKm === undefined) errors[key("baseline_km")] = `${label}: last done km must be a whole number.`;

    const id = isNew ? undefined : Number(r.id);
    items.push({
      ...(id !== undefined && Number.isSafeInteger(id) ? { id } : {}),
      name: r.name,
      interval_km: km ?? null,
      interval_months: months ?? null,
      baseline_date: baselineDate ?? null,
      baseline_km: baselineKm ?? null,
    });
  });

  if (items.length > MAX_ITEMS) errors.items = `A schedule can have at most ${MAX_ITEMS} items.`;
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: items };
}

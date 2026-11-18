import type { LineInput, ServiceItem, ServiceInput, ServiceWithLines } from "./db";
import { type Body, type FormErrors, isBlankRow, type Parsed, parseCount, readFields, readRows, toField } from "./form";
import { parseDateInput } from "./lib/dates";
import { fmtRM, parseRM } from "./lib/money";

// The service form posts the visit's fields by name, and its lines as "line.<n>.<field>".

export const SERVICE_FIELDS = ["date", "odometer_km", "workshop", "total", "notes"] as const;
export const LINE_FIELDS = ["description", "cost", "item"] as const;
export const MAX_LINES = 50;

export type ServiceValues = Record<(typeof SERVICE_FIELDS)[number], string>;
export type LineValues = Record<(typeof LINE_FIELDS)[number], string>;
export type ServiceFormValues = { service: ServiceValues; lines: LineValues[] };

const AMOUNT_HINT = "must be an amount like 85 or RM 1,234.50.";

export function readServiceForm(body: Body): ServiceFormValues {
  return { service: readFields(body, SERVICE_FIELDS, ["date"]), lines: readRows(body, "line", LINE_FIELDS) };
}

export function blankServiceForm(workshop = ""): ServiceFormValues {
  return { service: { date: "", odometer_km: "", workshop, total: "", notes: "" }, lines: [] };
}

/** Money is shown without the "RM" in inputs, which already say "RM". */
const amount = (sen: number | null) => (sen === null ? "" : fmtRM(sen).slice(3));

export function serviceFormValuesOf(s: ServiceWithLines): ServiceFormValues {
  return {
    service: {
      date: s.date,
      odometer_km: String(s.odometer_km),
      workshop: s.workshop,
      total: amount(s.total_sen),
      notes: s.notes,
    },
    lines: s.lines.map((l) => ({ description: l.description, cost: amount(l.cost_sen), item: toField(l.service_item_id) })),
  };
}

/**
 * Blank line rows are dropped. Callers 404 on item ids that aren't the vehicle's. A line tagged with a
 * schedule item but no description takes the item's
 * name. A blank total becomes the sum of the line costs. Any past date is fine; future ones aren't.
 */
export function parseServiceForm(
  { service: v, lines: rows }: ServiceFormValues,
  items: ServiceItem[],
  today: string,
): Parsed<Omit<ServiceInput, "receipt_key">> {
  const errors: FormErrors = {};

  const date = v.date === "" ? null : parseDateInput(v.date);
  if (v.date === "") errors.date = "Enter the service date.";
  else if (date === null) errors.date = "The service date isn't a valid date.";
  else if (date > today) errors.date = "The service date can't be in the future.";

  const km = parseCount(v.odometer_km, 0, 10_000_000);
  if (km === null) errors.odometer_km = "Enter the odometer reading.";
  else if (km === undefined) errors.odometer_km = "The odometer reading must be a whole number of km.";

  const lines: LineInput[] = [];
  rows.forEach((r, n) => {
    if (isBlankRow(r)) return;
    const key = (f: string) => `line.${n}.${f}`;
    const itemId = r.item === "" ? null : Number(r.item);
    const item = items.find((i) => i.id === itemId);
    const description = r.description || item?.name || "";
    const label = description || `Line ${n + 1}`;
    if (!description) errors[key("description")] = `${label}: describe the work or part.`;
    const cost = r.cost === "" ? null : parseRM(r.cost);
    if (r.cost !== "" && cost === null) errors[key("cost")] = `${label}: cost ${AMOUNT_HINT}`;
    lines.push({ description, cost_sen: cost, service_item_id: item ? item.id : null });
  });
  if (lines.length > MAX_LINES) errors.lines = `A service can have at most ${MAX_LINES} lines.`;

  const total = v.total === "" ? lines.reduce((sum, l) => sum + (l.cost_sen ?? 0), 0) : parseRM(v.total);
  if (total === null) errors.total = `Total ${AMOUNT_HINT}`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { date: date!, odometer_km: km!, workshop: v.workshop, total_sen: total!, notes: v.notes, lines },
  };
}

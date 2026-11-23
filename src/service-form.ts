import type { LineInput, ServiceItem, ServiceInput, ServiceWithLines } from "./db";
import { type Body, type FormErrors, isBlankRow, type Parsed, parseCount, readFields, readRows, toField } from "./form";
import { parseDateInput } from "./lib/dates";
import { categoryNameProblem, isCategory, itemCategory, NEW_CATEGORY, suggestCategory } from "./lib/categories";
import { formatPartSpec, positionsFor } from "./lib/parts";
import type { VehicleType } from "./lib/templates";
import { suggestItem } from "./lib/matchItems";
import { fmtRM, parseRM } from "./lib/money";
import type { ScanResult } from "./openrouter";

// The service form posts the visit's fields by name, and its lines as "line.<n>.<field>".

// "no_km" is "1" once the owner has confirmed the visit has no Odometer reading.
export const SERVICE_FIELDS = ["date", "odometer_km", "workshop", "total", "notes", "no_km"] as const;
// "new_category" is the name typed after choosing "New category…" as the line's category.
export const LINE_FIELDS = ["description", "cost", "item", "brand", "spec", "position", "warranty_until", "category", "new_category"] as const;
export const MAX_LINES = 50;

export type ServiceValues = Record<(typeof SERVICE_FIELDS)[number], string>;
export type LineValues = Record<(typeof LINE_FIELDS)[number], string>;
export type ServiceFormValues = { service: ServiceValues; lines: LineValues[] };

const AMOUNT_HINT = "must be an amount like 85 or RM 1,234.50.";

/** Lines ticked "Remove line" are dropped here, so they're never checked, saved or shown again. */
export function readServiceForm(body: Body): ServiceFormValues {
  const lines = readRows(body, "line", [...LINE_FIELDS, "remove"], ["warranty_until"])
    .filter((r) => r.remove === "")
    .map(({ remove: _, ...line }) => line);
  return { service: readFields(body, SERVICE_FIELDS, ["date"]), lines };
}

export function blankServiceForm(workshop = ""): ServiceFormValues {
  return { service: { date: "", odometer_km: "", workshop, total: "", notes: "", no_km: "" }, lines: [] };
}

/**
 * The service form prefilled from a receipt scan: each line tagged with its suggested schedule item
 * and category.
 * `unread` lists the fields the scan couldn't read, to highlight.
 */
export function scanFormValues(
  scan: ScanResult,
  items: ServiceItem[],
  vehicleType: VehicleType,
): { values: ServiceFormValues; unread: string[] } {
  const unread: string[] = [];
  const field = <T,>(name: string, v: T | null, show: (v: T) => string) => {
    if (v === null) unread.push(name);
    return v === null ? "" : show(v);
  };
  const service = {
    date: field("date", scan.date, String),
    odometer_km: field("odometer_km", scan.odometer_km, String),
    workshop: field("workshop", scan.workshop, String),
    total: field("total", scan.total_sen, amount),
    notes: "",
    no_km: "",
  };
  const lines = scan.lines.map((l, n) => {
    const item = items.find((i) => i.id === suggestItem(l.description, items));
    return {
      description: l.description,
      cost: field(`line.${n}.cost`, l.cost_sen, amount),
      item: toField(item?.id ?? null),
      // Part details aren't highlighted when unread: most lines have none.
      brand: l.part?.brand ?? "",
      spec: l.part?.spec ?? "",
      position: l.part?.position && positionsFor(vehicleType).includes(l.part.position) ? l.part.position : "",
      warranty_until: l.part?.warranty_until ?? "",
      // The suggested reminder's category, else keywords; the owner reviews it before saving.
      // Only built-in categories are suggested, never the owner's own.
      category: (item && itemCategory(item.name)) ?? suggestCategory(l.description) ?? "",
      new_category: "",
    };
  });
  return { values: { service, lines }, unread };
}

/** Money is shown without the "RM" in inputs, which already say "RM". */
const amount = (sen: number | null) => (sen === null ? "" : fmtRM(sen).slice(3));

export function serviceFormValuesOf(s: ServiceWithLines): ServiceFormValues {
  return {
    service: {
      date: s.date,
      odometer_km: toField(s.odometer_km),
      workshop: s.workshop,
      total: amount(s.total_sen),
      notes: s.notes,
      // A Service already saved with no km saves again without asking.
      no_km: s.odometer_km === null ? "1" : "",
    },
    lines: s.lines.map((l) => ({
      description: l.description,
      cost: amount(l.cost_sen),
      item: toField(l.service_item_id),
      brand: l.part_brand ?? "",
      spec: l.part_spec ?? "",
      position: l.part_position ?? "",
      warranty_until: l.warranty_until ?? "",
      category: l.category ?? "",
      new_category: "",
    })),
  };
}

/**
 * True when the km is blank and the owner hasn't yet confirmed saving without it: the form goes back
 * in its "warned" state instead of saving.
 */
export const kmUnconfirmed = (v: ServiceValues) => v.odometer_km === "" && v.no_km !== "1";

/**
 * Blank line rows are dropped. Callers 404 on item ids that aren't the vehicle's. A line tagged with a
 * schedule item but no description takes the item's
 * name. A blank total becomes the sum of the line costs. Any past date is fine; future ones aren't.
 * A line's category is a built-in one, one of `ownCategories`, or a new one named on the line; lines
 * naming the same new one (ignoring case) share it.
 */
export function parseServiceForm(
  { service: v, lines: rows }: ServiceFormValues,
  items: ServiceItem[],
  today: string,
  vehicleType: VehicleType,
  ownCategories: readonly string[],
): Parsed<Omit<ServiceInput, "receipt_key">> {
  const errors: FormErrors = {};

  const date = v.date === "" ? null : parseDateInput(v.date);
  if (v.date === "") errors.date = "Enter the service date.";
  else if (date === null) errors.date = "The service date isn't a valid date.";
  else if (date > today) errors.date = "The service date can't be in the future.";

  // A blank km is only saved once confirmed (kmUnconfirmed); a km that's there is checked as usual.
  const km = parseCount(v.odometer_km, 0, 10_000_000);
  if (km === undefined) errors.odometer_km = "The odometer reading must be a whole number of km.";

  const lines: LineInput[] = [];
  // New categories named so far, by lowercased name.
  const newCategories = new Map<string, string>();
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
    const warranty = r.warranty_until === "" ? null : parseDateInput(r.warranty_until);
    if (r.warranty_until !== "" && warranty === null) errors[key("warranty_until")] = `${label}: warranty until isn't a valid date.`;
    if (r.position !== "" && !positionsFor(vehicleType).includes(r.position)) {
      errors[key("position")] = `${label}: choose a position from the list.`;
    }
    let category: string | null = null;
    if (r.category === NEW_CATEGORY) {
      const same = newCategories.get(r.new_category.toLowerCase());
      const problem = same ? null : categoryNameProblem(r.new_category, ownCategories);
      if (problem) errors[key("new_category")] = `${label}: ${problem}`;
      else {
        category = same ?? r.new_category;
        newCategories.set(r.new_category.toLowerCase(), category);
      }
    } else if (isCategory(r.category) || ownCategories.includes(r.category)) {
      category = r.category;
    } else if (r.category !== "") {
      errors[key("category")] = `${label}: choose a category from the list.`;
    }
    lines.push({
      description,
      cost_sen: cost,
      service_item_id: item ? item.id : null,
      part_brand: r.brand || null,
      part_spec: formatPartSpec(r.spec) || null,
      part_position: r.position || null,
      warranty_until: warranty,
      // A line resetting a reminder takes the item's category unless the owner chose one.
      category: category ?? (item && itemCategory(item.name)) ?? null,
    });
  });
  if (lines.length > MAX_LINES) errors.lines = `A service can have at most ${MAX_LINES} lines.`;

  const total = v.total === "" ? lines.reduce((sum, l) => sum + (l.cost_sen ?? 0), 0) : parseRM(v.total);
  if (total === null) errors.total = `Total ${AMOUNT_HINT}`;

  if (Object.keys(errors).length > 0 || kmUnconfirmed(v)) return { ok: false, errors };
  return {
    ok: true,
    value: {
      date: date!,
      odometer_km: km ?? null,
      workshop: v.workshop,
      total_sen: total!,
      notes: v.notes,
      lines,
      new_categories: [...newCategories.values()],
    },
  };
}

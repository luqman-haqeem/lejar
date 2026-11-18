import { parseDateInput } from "./lib/dates";

// Helpers shared by the HTML forms. Forms post flat fields; repeatable rows are "<prefix>.<n>.<field>".

export type Body = Record<string, string | File>;
/** Field key ("name", "item.3.km") to message. */
export type FormErrors = Record<string, string>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FormErrors };

const str = (body: Body, key: string) => {
  const v = body[key];
  return typeof v === "string" ? v.trim() : "";
};

/**
 * Reads the named fields as typed (trimmed). Fields listed in `dates` come back as ISO when they
 * parse, so a date picker can show them again after a failed save.
 */
export function readFields<F extends string>(
  body: Body,
  fields: readonly F[],
  dates: readonly F[] = [],
  prefix = "",
): Record<F, string> {
  return Object.fromEntries(
    fields.map((f) => {
      const v = str(body, `${prefix}${f}`);
      return [f, dates.includes(f) ? (parseDateInput(v) ?? v) : v];
    }),
  ) as Record<F, string>;
}

/** Repeatable rows "<prefix>.<n>.<field>", in the order the form numbered them. */
export function readRows<F extends string>(
  body: Body,
  prefix: string,
  fields: readonly F[],
  dates: readonly F[] = [],
): Record<F, string>[] {
  const pattern = new RegExp(`^${prefix}\\.(\\d+)\\.`);
  const indexes = new Set<number>();
  for (const key of Object.keys(body)) {
    const m = key.match(pattern);
    if (m) indexes.add(Number(m[1]));
  }
  return [...indexes].sort((a, b) => a - b).map((n) => readFields(body, fields, dates, `${prefix}.${n}.`));
}

export const isBlankRow = (row: Record<string, string>) => Object.values(row).every((v) => v === "");

/** A whole number, allowing "50,000" or "50 000". Blank gives null; anything else gives undefined. */
export function parseCount(input: string, min: number, max: number): number | null | undefined {
  if (input === "") return null;
  const digits = input.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(digits)) return undefined;
  const n = Number(digits);
  return n >= min && n <= max ? n : undefined;
}

/** Blank gives null; a date that doesn't parse gives undefined. */
export function optionalDate(input: string): string | null | undefined {
  return input === "" ? null : (parseDateInput(input) ?? undefined);
}

export const toField = (x: string | number | null) => (x === null ? "" : String(x));

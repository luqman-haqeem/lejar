import { fmtDate } from "./dates";
import { fmtKm, fmtKmNumber } from "./km";

/** An Odometer reading, as far as the hint is concerned. */
export type HintReading = { date: string; km: number };

/**
 * The hint text for every date, precomputed so the browser only looks a date up: `before` is for dates
 * before the first reading; each `[date, sameDay, after]` gives the text on that reading date and for
 * dates after it up to the next one. ISO dates, ascending.
 */
export type HintLookup = { before: string; dates: [string, string, string][] };

/** Readings grouped by date, ascending, keeping the lowest and highest km of each date. */
function byDate(readings: HintReading[]) {
  const days = new Map<string, { date: string; low: number; high: number }>();
  for (const r of readings) {
    const d = days.get(r.date);
    if (d) {
      d.low = Math.min(d.low, r.km);
      d.high = Math.max(d.high, r.km);
    } else days.set(r.date, { date: r.date, low: r.km, high: r.km });
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

type Day = ReturnType<typeof byDate>[number];

const sameDay = (d: Day) => `Same day: ${fmtKm(d.high)}`;

/** The hint for a date strictly between `earlier` and `later` (either may be missing, not both). */
function around(earlier: Day | undefined, later: Day | undefined): string {
  if (earlier && later) return `Between ${fmtKmNumber(earlier.high)} and ${fmtKm(later.low)}`;
  if (earlier) return `Last: ${fmtKm(earlier.high)} · ${fmtDate(earlier.date)}`;
  return `Under ${fmtKm(later!.low)}`;
}

/**
 * The hint under the Odometer field for an ISO `date` (null: no date chosen, which counts as after
 * every reading), from the vehicle's other Odometer readings. Null when there are no readings.
 */
export function odometerHint(readings: HintReading[], date: string | null): string | null {
  const days = byDate(readings);
  if (days.length === 0) return null;
  if (date === null) return around(days.at(-1), undefined);
  const same = days.find((d) => d.date === date);
  if (same) return sameDay(same);
  return around(days.filter((d) => d.date < date).at(-1), days.find((d) => d.date > date));
}

/** The hint text for each date range, for the browser to swap in as the Date field changes. Null when there are no readings. */
export function odometerHintLookup(readings: HintReading[]): HintLookup | null {
  const days = byDate(readings);
  if (days.length === 0) return null;
  return {
    before: around(undefined, days[0]),
    dates: days.map((d, i) => [d.date, sameDay(d), around(d, days[i + 1])]),
  };
}

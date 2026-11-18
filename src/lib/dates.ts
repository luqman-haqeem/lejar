// Dates are ISO "YYYY-MM-DD" strings everywhere; only the UI shows DD/MM/YYYY.

const KL_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Asia/Kuala_Lumpur, as ISO. */
export function todayKL(now: Date = new Date()): string {
  return KL_DATE.format(now);
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Reads a date picker value (ISO) or a hand-typed DD/MM/YYYY. Returns ISO, or null if it isn't a real date. */
export function parseDateInput(input: string): string | null {
  const s = input.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : null;
  if (!parts) return null;

  const [y, m, d] = parts.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

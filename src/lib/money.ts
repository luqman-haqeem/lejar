// Money is stored as integer sen and shown as "RM 1,234.50".

const AMOUNT = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/** "RM 1,234.5", "85", "rm12.05" → sen. Negative, garbage or blank input gives null. */
export function parseRM(input: string): number | null {
  const s = input.trim().replace(/^rm\s*/i, "");
  const m = s.match(AMOUNT);
  if (!m) return null;
  const [whole, cents = ""] = s.replace(/,/g, "").split(".");
  return Number(whole) * 100 + Number(cents.padEnd(2, "0"));
}

/** fmtRM, or blank for an amount that wasn't given (e.g. a line with no separate cost). */
export const fmtOptionalRM = (sen: number | null) => (sen === null ? "" : fmtRM(sen));

export function fmtRM(sen: number): string {
  const whole = Math.floor(sen / 100).toLocaleString("en-US");
  return `RM ${whole}.${String(sen % 100).padStart(2, "0")}`;
}

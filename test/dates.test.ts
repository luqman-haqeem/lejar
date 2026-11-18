import { describe, expect, it } from "vitest";
import { fmtDate, parseDateInput, todayKL } from "../src/lib/dates";

describe("today in Malaysia", () => {
  it("rolls over at midnight Kuala Lumpur time, not UTC", () => {
    expect(todayKL(new Date("2026-10-18T15:59:59Z"))).toBe("2026-10-18");
    expect(todayKL(new Date("2026-10-18T16:00:00Z"))).toBe("2026-10-19");
  });
});

describe("showing dates", () => {
  it("shows ISO dates as DD/MM/YYYY", () => {
    expect(fmtDate("2026-03-05")).toBe("05/03/2026");
  });
});

describe("reading typed dates", () => {
  it("accepts ISO from a date picker and DD/MM/YYYY typed by hand", () => {
    expect(parseDateInput("2026-03-05")).toBe("2026-03-05");
    expect(parseDateInput("5/3/2026")).toBe("2026-03-05");
    expect(parseDateInput(" 05/03/2026 ")).toBe("2026-03-05");
  });

  it("rejects dates that don't exist and garbage", () => {
    expect(parseDateInput("2026-02-29")).toBeNull();
    expect(parseDateInput("31/04/2026")).toBeNull();
    expect(parseDateInput("2026-13-01")).toBeNull();
    expect(parseDateInput("next week")).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });

  it("accepts 29 February in a leap year", () => {
    expect(parseDateInput("29/02/2028")).toBe("2028-02-29");
  });
});

import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, fmtDate, parseDateInput, todayKL } from "../src/lib/dates";

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

describe("adding months", () => {
  it("keeps the day of the month when it exists", () => {
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-06-01", 24)).toBe("2028-06-01");
  });

  it("clamps to the end of a shorter month instead of spilling into the next", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2027-08-31", 6)).toBe("2028-02-29");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("goes backwards too", () => {
    expect(addMonths("2026-10-18", -12)).toBe("2025-10-18");
    expect(addMonths("2028-02-29", -12)).toBe("2027-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("days between dates", () => {
  it("counts days from the first date to the second", () => {
    expect(daysBetween("2026-10-18", "2026-11-17")).toBe(30);
    expect(daysBetween("2026-10-18", "2026-10-01")).toBe(-17);
    expect(daysBetween("2026-10-18", "2026-10-18")).toBe(0);
    expect(daysBetween("2026-01-01", "2026-07-01")).toBe(181);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });
});

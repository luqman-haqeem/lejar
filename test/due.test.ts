import { describe, expect, it } from "vitest";
import { estimateKm, expiryStatus, itemDue, odometerStale, sortByUrgency, type ItemDue } from "../src/lib/due";

const TODAY = "2026-10-18";
const oil = { id: 1, name: "Engine oil", interval_km: 10000, interval_months: 6, baseline_date: null, baseline_km: null };
const brakeFluid = { id: 2, name: "Brake fluid", interval_km: null, interval_months: 24, baseline_date: null, baseline_km: null };

describe("when a schedule item is due", () => {
  it("is due soon when the km runs out before the date", () => {
    const due = itemDue(oil, { date: "2026-06-01", km: 50000 }, 59500, "car", TODAY);
    expect(due).toMatchObject({ dueKm: 60000, kmLeft: 500, dueDate: "2026-12-01", daysLeft: 44, status: "soon" });
  });

  it("is overdue when the date passes before the km", () => {
    const due = itemDue(oil, { date: "2026-04-01", km: 50000 }, 52000, "car", TODAY);
    expect(due).toMatchObject({ dueDate: "2026-10-01", daysLeft: -17, kmLeft: 8000, status: "overdue" });
  });

  it("is overdue on reaching the due km exactly", () => {
    expect(itemDue(oil, { date: "2026-09-01", km: 50000 }, 60000, "car", TODAY).status).toBe("overdue");
  });

  it("is due on the due date itself but not yet overdue", () => {
    const due = itemDue(oil, { date: "2026-04-18", km: 50000 }, 51000, "car", TODAY);
    expect(due).toMatchObject({ daysLeft: 0, status: "soon" });
  });

  it("is due soon within 14 days, and OK at 15", () => {
    expect(itemDue(oil, { date: "2026-04-30", km: 50000 }, 51000, "car", TODAY)).toMatchObject({ daysLeft: 12, status: "soon" });
    expect(itemDue(oil, { date: "2026-05-01", km: 50000 }, 51000, "car", TODAY)).toMatchObject({ daysLeft: 14, status: "soon" });
    expect(itemDue(oil, { date: "2026-05-02", km: 50000 }, 51000, "car", TODAY)).toMatchObject({ daysLeft: 15, status: "ok" });
  });

  it("uses a 1,000 km warning for cars and 300 km for motorbikes", () => {
    const last = { date: "2026-09-01", km: 50000 };
    expect(itemDue(oil, last, 59000, "car", TODAY).status).toBe("soon");
    expect(itemDue(oil, last, 58999, "car", TODAY).status).toBe("ok");
    expect(itemDue(oil, last, 59600, "motorbike", TODAY)).toMatchObject({ kmLeft: 400, status: "ok" });
    expect(itemDue(oil, last, 59700, "motorbike", TODAY)).toMatchObject({ kmLeft: 300, status: "soon" });
  });

  it("goes by date alone for an item with no km interval", () => {
    const due = itemDue(brakeFluid, { date: "2025-01-10", km: 30000 }, 60000, "car", TODAY);
    expect(due).toMatchObject({ dueKm: null, kmLeft: null, dueDate: "2027-01-10", status: "ok" });
  });

  it("clamps a month-end due date", () => {
    expect(itemDue(oil, { date: "2026-08-31", km: 50000 }, 51000, "car", TODAY).dueDate).toBe("2027-02-28");
  });
});

describe("where 'last done' comes from", () => {
  it("falls back to the baseline when the item has never been logged", () => {
    const item = { ...oil, baseline_date: "2025-11-01", baseline_km: null };
    const due = itemDue(item, null, 70000, "car", TODAY);
    expect(due).toMatchObject({ lastDate: "2025-11-01", lastKm: null, dueDate: "2026-05-01", dueKm: null, status: "overdue" });
  });

  it("uses a km-only baseline for km-based due status", () => {
    const item = { ...oil, baseline_km: 50000 };
    expect(itemDue(item, null, 59500, "car", TODAY)).toMatchObject({ dueKm: 60000, kmLeft: 500, dueDate: null, status: "soon" });
  });

  it("prefers a logged service over the baseline", () => {
    const item = { ...oil, baseline_date: "2024-01-01", baseline_km: 20000 };
    expect(itemDue(item, { date: "2026-09-01", km: 55000 }, 56000, "car", TODAY)).toMatchObject({
      lastDate: "2026-09-01",
      dueKm: 65000,
      status: "ok",
    });
  });

  it("is unknown with neither a logged service nor a baseline", () => {
    expect(itemDue(oil, null, 50000, "car", TODAY)).toMatchObject({
      status: "unknown",
      dueDate: null,
      dueKm: null,
      needs: "last_done",
    });
  });

  it("is unknown when only km is known but there's no current km estimate", () => {
    const item = { ...oil, interval_months: null, baseline_km: 50000 };
    expect(itemDue(item, null, null, "car", TODAY)).toMatchObject({
      dueKm: 60000,
      kmLeft: null,
      status: "unknown",
      needs: "reading",
    });
  });

  it("is unknown when the baseline doesn't match the interval", () => {
    const kmOnly = { ...oil, interval_months: null, baseline_date: "2026-06-01" };
    expect(itemDue(kmOnly, null, 55000, "car", TODAY)).toMatchObject({ status: "unknown", needs: "last_done" });
    expect(itemDue(oil, { date: "2026-09-01", km: 55000 }, 56000, "car", TODAY).needs).toBeNull();
  });
});

describe("estimating today's km", () => {
  it("extends the latest reading by the average daily km", () => {
    const readings = [
      { date: "2026-01-01", km: 40000 },
      { date: "2026-07-01", km: 49050 },
    ];
    expect(estimateKm(readings, TODAY)).toBe(54500); // 9,050 km over 181 days = 50/day, 109 days on
  });

  it("averages over the last 12 months, anchored by the latest reading before them", () => {
    const readings = [
      { date: "2020-01-01", km: 1000 }, // ignored: older than the anchor
      { date: "2025-09-18", km: 30000 }, // anchor: latest before 18/10/2025
      { date: "2026-09-18", km: 40950 }, // 10,950 km over 365 days = 30/day
    ];
    expect(estimateKm(readings, TODAY)).toBe(41850);
  });

  it("is the latest reading when there's only one", () => {
    expect(estimateKm([{ date: "2026-01-01", km: 40000 }], TODAY)).toBe(40000);
  });

  it("is the latest reading when all readings share a date", () => {
    const readings = [
      { date: "2026-01-01", km: 40000 },
      { date: "2026-01-01", km: 40010 },
    ];
    expect(estimateKm(readings, TODAY)).toBe(40010);
  });

  it("is unknown with no readings", () => {
    expect(estimateKm([], TODAY)).toBeNull();
  });
});

describe("road tax and insurance", () => {
  it("is overdue on and after the expiry date, due soon within 30 days, otherwise OK", () => {
    expect(expiryStatus("2026-10-17", TODAY)).toMatchObject({ status: "overdue", daysLeft: -1 });
    expect(expiryStatus("2026-10-18", TODAY)).toMatchObject({ status: "overdue", daysLeft: 0 });
    expect(expiryStatus("2026-10-19", TODAY)).toMatchObject({ status: "soon", daysLeft: 1 });
    expect(expiryStatus("2026-11-17", TODAY)).toMatchObject({ status: "soon", daysLeft: 30 });
    expect(expiryStatus("2026-11-18", TODAY)).toMatchObject({ status: "ok", daysLeft: 31, date: "2026-11-18" });
  });

  it("is 'not set' without a date", () => {
    expect(expiryStatus(null, TODAY)).toEqual({ status: "unset", date: null, daysLeft: null });
  });
});

describe("a stale odometer", () => {
  it("is stale once the latest reading is more than 30 days old", () => {
    expect(odometerStale([{ date: "2026-09-18", km: 1 }], TODAY)).toBe(false);
    expect(odometerStale([{ date: "2026-09-17", km: 1 }], TODAY)).toBe(true);
    expect(odometerStale([{ date: "2026-01-01", km: 1 }, { date: "2026-10-01", km: 2 }], TODAY)).toBe(false);
  });

  it("isn't stale with no readings (there's nothing to update)", () => {
    expect(odometerStale([], TODAY)).toBe(false);
  });
});

describe("sorting by urgency", () => {
  const item = (name: string, status: ItemDue["status"], daysLeft: number | null, kmLeft: number | null): ItemDue => ({
    itemId: 0,
    name,
    status,
    daysLeft,
    kmLeft,
    dueDate: null,
    dueKm: null,
    lastDate: null,
    lastKm: null,
    needs: null,
  });

  it("puts overdue first, then soon, then unknown, then OK, soonest first within each", () => {
    const sorted = sortByUrgency([
      item("ok", "ok", 100, 5000),
      item("unknown", "unknown", null, null),
      item("soon-later", "soon", 10, null),
      item("overdue-km-only", "overdue", null, -100),
      item("soon-sooner", "soon", 3, 2000),
      item("overdue-days", "overdue", -20, 500),
      item("soon-same-day-fewer-km", "soon", 3, 100),
    ]);
    expect(sorted.map((i) => i.name)).toEqual([
      "overdue-days",
      "overdue-km-only",
      "soon-same-day-fewer-km",
      "soon-sooner",
      "soon-later",
      "unknown",
      "ok",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { suggestItem } from "../src/lib/matchItems";
import { CAR_TEMPLATE, MOTORBIKE_TEMPLATE } from "../src/lib/templates";
import { parseScanResponse } from "../src/openrouter";

const TODAY = "2026-11-18";
const withIds = (template: typeof CAR_TEMPLATE) => template.map((t, i) => ({ ...t, id: 100 + i }));
const car = withIds(CAR_TEMPLATE);
const bike = withIds(MOTORBIKE_TEMPLATE);
const idOf = (items: { id: number; name: string }[], name: string) => items.find((i) => i.name === name)!.id;

describe("suggesting a schedule item for a receipt line", () => {
  it("knows English and Malay names for common work", () => {
    expect(suggestItem("Minyak hitam 4L", car)).toBe(idOf(car, "Engine oil"));
    expect(suggestItem("Fully Synthetic 5W-30", car)).toBe(idOf(car, "Engine oil"));
    expect(suggestItem("Penapis minyak", car)).toBe(idOf(car, "Oil filter"));
    expect(suggestItem("PENAPIS UDARA", car)).toBe(idOf(car, "Air filter"));
    expect(suggestItem("Aircond filter", car)).toBe(idOf(car, "Cabin filter"));
    expect(suggestItem("CVT fluid NS-3", car)).toBe(idOf(car, "ATF/CVT fluid"));
    expect(suggestItem("Spark plug x4", car)).toBe(idOf(car, "Spark plugs"));
    expect(suggestItem("Minyak brek DOT4", car)).toBe(idOf(car, "Brake fluid"));
    expect(suggestItem("Radiator coolant", car)).toBe(idOf(car, "Coolant"));
    expect(suggestItem("Rantai & sprocket", bike)).toBe(idOf(bike, "Drive chain/belt"));
    expect(suggestItem("Spark plug", bike)).toBe(idOf(bike, "Spark plug"));
  });

  it("prefers the more specific match", () => {
    expect(suggestItem("Engine oil filter", car)).toBe(idOf(car, "Oil filter"));
    expect(suggestItem("Oil filter + engine oil change", car)).toBe(idOf(car, "Oil filter"));
  });

  it("matches plurals", () => {
    expect(suggestItem("SPARK PLUGS (4)", car)).toBe(idOf(car, "Spark plugs"));
    expect(suggestItem("Oil filters", car)).toBe(idOf(car, "Oil filter"));
    expect(suggestItem("Palam pencucuh", car)).toBe(idOf(car, "Spark plugs"));
  });

  it("doesn't mistake other plugs and belts for spark plugs and drive belts", () => {
    expect(suggestItem("Drain plug washer", car)).toBeNull();
    expect(suggestItem("Sump plug", car)).toBeNull();
    expect(suggestItem("Fan belt", bike)).toBeNull();
    expect(suggestItem("Drive belt", bike)).toBe(idOf(bike, "Drive chain/belt"));
    expect(suggestItem("V-belt", bike)).toBe(idOf(bike, "Drive chain/belt"));
  });

  it("matches whole words, not pieces of them", () => {
    expect(suggestItem("Platform fee", car)).toBeNull(); // contains "atf"
  });

  it("leaves a line unlinked when nothing matches or the vehicle has no such item", () => {
    expect(suggestItem("Wiper blade", car)).toBeNull();
    expect(suggestItem("Labour", car)).toBeNull();
    expect(suggestItem("Timing belt", car)).toBeNull(); // cars here have no drive chain/belt item
    expect(suggestItem("Engine oil", [])).toBeNull();
  });
});

describe("reading the model's reply", () => {
  const reply = {
    date: "2026-09-02",
    odometer_km: "52,310",
    workshop: "Bengkel Ah Seng",
    total: "RM 245.00",
    lines: [
      { description: "Minyak hitam 4L", cost: 180 },
      { description: "Labour", cost: "RM 65" },
    ],
  };

  it("turns RM and km strings or numbers into sen and km, even inside a code fence", () => {
    const fenced = "```json\n" + JSON.stringify(reply) + "\n```";
    expect(parseScanResponse(fenced, TODAY)).toEqual({
      date: "2026-09-02",
      odometer_km: 52310,
      workshop: "Bengkel Ah Seng",
      total_sen: 24500,
      lines: [
        { description: "Minyak hitam 4L", cost_sen: 18000 },
        { description: "Labour", cost_sen: 6500 },
      ],
    });
  });

  it("reads DD/MM/YYYY dates, and keeps old ones (the date comes from the receipt)", () => {
    expect(parseScanResponse(JSON.stringify({ ...reply, date: "02/09/2019" }), TODAY)?.date).toBe("2019-09-02");
  });

  it("drops a date that's invalid or in the future", () => {
    expect(parseScanResponse(JSON.stringify({ ...reply, date: "2027-01-01" }), TODAY)?.date).toBeNull();
    expect(parseScanResponse(JSON.stringify({ ...reply, date: "31/02/2026" }), TODAY)?.date).toBeNull();
    expect(parseScanResponse(JSON.stringify({ ...reply, date: "yesterday" }), TODAY)?.date).toBeNull();
  });

  it("leaves fields it can't use blank", () => {
    const messy = { date: null, odometer_km: "about 50k", workshop: "  ", total: -5, lines: [{ description: "", cost: 1 }, { description: "Oil", cost: "free" }] };
    expect(parseScanResponse(JSON.stringify(messy), TODAY)).toEqual({
      date: null,
      odometer_km: null,
      workshop: null,
      total_sen: null,
      lines: [{ description: "Oil", cost_sen: null }],
    });
  });

  it("treats empty strings as unread, as the model is asked to send them", () => {
    const blank = { date: "", odometer_km: "", workshop: "", total: "", lines: [{ description: "Oil", cost: "" }] };
    expect(parseScanResponse(JSON.stringify(blank), TODAY)).toEqual({
      date: null,
      odometer_km: null,
      workshop: null,
      total_sen: null,
      lines: [{ description: "Oil", cost_sen: null }],
    });
  });

  it("drops implausible numbers however they're sent", () => {
    const huge = { ...reply, odometer_km: 99_000_000, total: 1e12 };
    expect(parseScanResponse(JSON.stringify(huge), TODAY)).toMatchObject({ odometer_km: null, total_sen: null });
    expect(parseScanResponse(JSON.stringify({ ...reply, odometer_km: 52310.4 }), TODAY)?.odometer_km).toBeNull();
  });

  it("reads part details on a line, keeping only what makes sense", () => {
    const parts = {
      ...reply,
      date: "2026-09-02",
      lines: [
        { description: "Michelin Primacy 4 x4", cost: "1280", brand: "Michelin", spec: "2055516 91v", position: "all", warranty_until: "02/03/2028", warranty_months: "" },
        { description: "Bateri", cost: "280", brand: " Amaron ", spec: "NS60", position: "", warranty_until: "", warranty_months: "24" },
        { description: "Wiper", cost: "40", brand: "", spec: "", position: "Middle", warranty_until: "soon", warranty_months: "lots" },
      ],
    };
    expect(parseScanResponse(JSON.stringify(parts), TODAY)?.lines).toEqual([
      {
        description: "Michelin Primacy 4 x4",
        cost_sen: 128000,
        part: { brand: "Michelin", spec: "205/55 R16 91V", position: "All", warranty_until: "2028-03-02" },
      },
      // "24 months" counts from the receipt's date.
      { description: "Bateri", cost_sen: 28000, part: { brand: "Amaron", spec: "NS60", position: null, warranty_until: "2028-09-02" } },
      { description: "Wiper", cost_sen: 4000 },
    ]);
  });

  it("gives up on a reply that isn't a JSON object", () => {
    expect(parseScanResponse("not json", TODAY)).toBeNull();
    expect(parseScanResponse("[1, 2]", TODAY)).toBeNull();
    expect(parseScanResponse("", TODAY)).toBeNull();
  });
});

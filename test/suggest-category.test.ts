import { describe, expect, it } from "vitest";
import { suggestCategory } from "../src/lib/categories";

describe("the category suggested for a receipt line", () => {
  it.each([
    ["Michelin Primacy 4 205/55R16", "Tyres"],
    ["Tayar Bridgestone x2", "Tyres"],
    ["Tyre rotation", "Tyres"],
    ["Front tires", "Tyres"],
    ["Brake pad depan", "Brakes"],
    ["Kasut brek belakang", "Brakes"],
    ["Disc rotor skim", "Brakes"],
    ["Minyak brek DOT4", "Brakes"],
    ["Bateri Amaron NS60", "Battery"],
    ["Battery", "Battery"],
    ["Wiper blade Bosch", "Wipers"],
    ["Absorber depan KYB", "Suspension"],
    ["Shock absorbers rear", "Suspension"],
    ["Mentol lampu depan", "Electrical"],
    ["Fuse 15A", "Electrical"],
    ["Headlight bulbs", "Electrical"],
    ["Oil filter", "Filters"],
    ["Penapis udara", "Filters"],
    ["Minyak hitam 5W-30 fully synthetic", "Engine"],
    ["Spark plugs", "Engine"],
    ["Coolant top up", "Engine"],
    ["Windscreen replacement", "Body"],
  ])("%s → %s", (description, category) => {
    expect(suggestCategory(description)).toBe(category);
  });

  it("leaves labour and service packages without one", () => {
    for (const d of ["Labour", "Upah", "Service package A", "Diagnostic", "Drain plug washer"]) {
      expect(suggestCategory(d)).toBeNull();
    }
  });

  it("files a sample Perodua receipt's lines", () => {
    const lines = [
      "Engine Oil 0W-20 Fully Synthetic 3.5L",
      "Oil Filter",
      "Drain Plug Washer",
      "Air Filter Element",
      "Brake Pad Front",
      "Wiper Blade Set",
      "Labour Charge",
    ];
    expect(lines.map(suggestCategory)).toEqual(["Engine", "Filters", null, "Filters", "Brakes", "Wipers", null]);
  });
});

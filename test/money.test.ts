import { describe, expect, it } from "vitest";
import { fmtRM, parseRM } from "../src/lib/money";

describe("reading ringgit amounts", () => {
  it("accepts amounts with or without RM, commas and cents", () => {
    expect(parseRM("RM 1,234.5")).toBe(123450);
    expect(parseRM("85")).toBe(8500);
    expect(parseRM("85.00")).toBe(8500);
    expect(parseRM("rm12.05")).toBe(1205);
    expect(parseRM(" 0.99 ")).toBe(99);
    expect(parseRM("0")).toBe(0);
  });

  it("rejects negatives, garbage and fractions of a sen", () => {
    expect(parseRM("-5")).toBeNull();
    expect(parseRM("abc")).toBeNull();
    expect(parseRM("12.345")).toBeNull();
    expect(parseRM("1.2.3")).toBeNull();
    expect(parseRM("")).toBeNull();
    expect(parseRM("RM")).toBeNull();
  });
});

describe("showing ringgit amounts", () => {
  it("shows sen as RM with thousands separators and two decimals", () => {
    expect(fmtRM(123450)).toBe("RM 1,234.50");
    expect(fmtRM(8500)).toBe("RM 85.00");
    expect(fmtRM(5)).toBe("RM 0.05");
    expect(fmtRM(123456789)).toBe("RM 1,234,567.89");
  });
});

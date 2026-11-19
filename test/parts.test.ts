import { describe, expect, it } from "vitest";
import { formatPartSpec } from "../src/lib/parts";

describe("formatting a part's spec", () => {
  it("writes a tyre size the standard way however it was typed", () => {
    expect(formatPartSpec("2055516")).toBe("205/55 R16");
    expect(formatPartSpec("205 55 16")).toBe("205/55 R16");
    expect(formatPartSpec("205/55r16")).toBe("205/55 R16");
    expect(formatPartSpec(" 185/55 R15 ")).toBe("185/55 R15");
  });

  it("keeps the load index and speed rating", () => {
    expect(formatPartSpec("205/55R16 91v")).toBe("205/55 R16 91V");
    expect(formatPartSpec("2055516 91V")).toBe("205/55 R16 91V");
  });

  it("leaves anything that isn't a tyre size as typed", () => {
    expect(formatPartSpec("NS60")).toBe("NS60");
    expect(formatPartSpec("55B24L")).toBe("55B24L");
    expect(formatPartSpec("5W-30")).toBe("5W-30");
    expect(formatPartSpec("Bosch 0 986 452 041")).toBe("Bosch 0 986 452 041");
  });

  it("trims and turns blank into empty", () => {
    expect(formatPartSpec("   ")).toBe("");
  });
});

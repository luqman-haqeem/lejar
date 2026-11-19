// Part details on a service line: brand, spec, position and warranty until (see GLOSSARY.md).

import type { ServiceLine } from "../db";
import { fmtDate } from "./dates";
import type { VehicleType } from "./templates";

const TYRE_SIZE = /^(\d{3})\s*[/ ]?\s*(\d{2})\s*[/ ]?\s*R?\s*(\d{2})(?:\s*(\d{2,3}[A-Z]))?$/;

/**
 * A spec that looks like a tyre size, written the standard way ("2055516" → "205/55 R16", keeping a
 * "91V" load index and speed rating). Anything else is kept as typed, trimmed.
 */
export function formatPartSpec(spec: string): string {
  const s = spec.trim();
  const m = s.toUpperCase().match(TYRE_SIZE);
  if (!m) return s;
  return `${m[1]}/${m[2]} R${m[3]}${m[4] ? ` ${m[4]}` : ""}`;
}

const CAR_POSITIONS = ["All", "Front", "Rear", "Front left", "Front right", "Rear left", "Rear right"] as const;
const MOTORBIKE_POSITIONS = ["All", "Front", "Rear"] as const;

/** Where on the vehicle a part can be fitted: a motorbike has no left and right. */
export function positionsFor(type: VehicleType): readonly string[] {
  return type === "motorbike" ? MOTORBIKE_POSITIONS : CAR_POSITIONS;
}

/** "Warranty until 02/03/2028", or "Warranty expired 14/05/2026" once `today` is past it. */
export function warrantyText(until: string, today: string): string {
  return until < today ? `Warranty expired ${fmtDate(until)}` : `Warranty until ${fmtDate(until)}`;
}

export type PartDetails = Pick<ServiceLine, "part_brand" | "part_spec" | "part_position" | "warranty_until">;

export const hasPartDetails = (p: PartDetails) =>
  Boolean(p.part_brand || p.part_spec || p.part_position || p.warranty_until);

/** "Michelin · 205/55 R16 91V · Front · Warranty until 02/03/2028", leaving out what's empty. */
export function partSummary(p: PartDetails, today: string): string {
  return [p.part_brand, p.part_spec, p.part_position, p.warranty_until && warrantyText(p.warranty_until, today)]
    .filter(Boolean)
    .join(" · ");
}

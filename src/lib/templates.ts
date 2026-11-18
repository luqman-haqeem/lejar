export type VehicleType = "car" | "motorbike";

export type TemplateItem = { name: string; interval_km: number | null; interval_months: number | null };

// Starting intervals are rough guesses; users correct them per vehicle.
export const CAR_TEMPLATE: readonly TemplateItem[] = [
  { name: "Engine oil", interval_km: 10000, interval_months: 6 },
  { name: "Oil filter", interval_km: 10000, interval_months: 6 },
  { name: "Air filter", interval_km: 20000, interval_months: 12 },
  { name: "Cabin filter", interval_km: 20000, interval_months: 12 },
  { name: "ATF/CVT fluid", interval_km: 40000, interval_months: 24 },
  { name: "Spark plugs", interval_km: 40000, interval_months: 24 },
  { name: "Brake fluid", interval_km: null, interval_months: 24 },
  { name: "Coolant", interval_km: 40000, interval_months: 24 },
];

export const MOTORBIKE_TEMPLATE: readonly TemplateItem[] = [
  { name: "Engine oil", interval_km: 3000, interval_months: 3 },
  { name: "Oil filter", interval_km: 6000, interval_months: 6 },
  { name: "Spark plug", interval_km: 10000, interval_months: 12 },
  { name: "Drive chain/belt", interval_km: 1000, interval_months: 1 },
  { name: "Brake fluid", interval_km: null, interval_months: 24 },
];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = { car: "Car", motorbike: "Motorbike" };

export const isVehicleType = (s: string): s is VehicleType => Object.hasOwn(VEHICLE_TYPE_LABELS, s);

export const TEMPLATES: Record<VehicleType, readonly TemplateItem[]> = {
  car: CAR_TEMPLATE,
  motorbike: MOTORBIKE_TEMPLATE,
};

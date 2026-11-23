/** A km figure without its unit, e.g. "52,000". */
export const fmtKmNumber = (km: number) => km.toLocaleString("en-US");
export const fmtKm = (km: number) => `${fmtKmNumber(km)} km`;

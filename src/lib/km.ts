/** A km figure without its unit, e.g. "52,000". */
export const fmtKmNumber = (km: number) => km.toLocaleString("en-US");
export const fmtKm = (km: number) => `${fmtKmNumber(km)} km`;
/** A Service's km, or "km not recorded" for one the owner saved without it. */
export const fmtServiceKm = (km: number | null) => (km === null ? "km not recorded" : fmtKm(km));

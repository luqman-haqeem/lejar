// The Workers runtime provides node:buffer via the nodejs_compat flag. Only the part used here is
// declared, to avoid pulling @types/node in alongside the Workers types.
declare module "node:buffer" {
  export const Buffer: { from(data: Uint8Array | ArrayBuffer): { toString(encoding: "base64"): string } };
}

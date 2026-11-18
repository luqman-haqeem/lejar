import type { Env } from "./env";

/** `today` is the signed-in request's date in Asia/Kuala_Lumpur (ISO), set once by the auth middleware. */
export type AppEnv = { Bindings: Env; Variables: { userId: number; today: string } };

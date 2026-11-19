import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { idOf, notFound } from "./http";
import { inBackground } from "./background";
import type { Context } from "hono";
import { getVehicle, giveBackScan, listItems, listVehicles, scansLeft, takeScan } from "./db";
import { scanReceipt } from "./openrouter";
import { cleanupOrphans, photoProblem, putReceipt, uploadTooLarge } from "./receipts";
import { blankServiceForm, scanFormValues } from "./service-form";
import { PhotoTooLarge } from "./views/PhotoTooLarge";
import { SCAN_LIMIT_REACHED, ScanPage } from "./views/ScanPage";
import { ServiceForm } from "./views/ServiceForm";


/** The caps from config (wrangler.jsonc vars). A malformed value is logged and the safe default used. */
function caps(c: Context<AppEnv>) {
  const n = (name: "SCAN_CAP_PER_USER" | "SCAN_CAP_GLOBAL", fallback: number) => {
    const v = c.env[name];
    if (v !== undefined && /^\d+$/.test(v)) return Number(v);
    console.warn(`${name} is not a whole number (${JSON.stringify(v)}); using ${fallback}`);
    return fallback;
  };
  return { perUser: n("SCAN_CAP_PER_USER", 20), global: n("SCAN_CAP_GLOBAL", 300) };
}

export const SCAN_FAILED = "Couldn't read receipt — fill in manually";
export const SCAN_READ = "Check what was read from the receipt, fill in anything highlighted, then save.";

export function scanRoutes(aiFetch: typeof fetch = fetch) {
  const routes = new Hono<AppEnv>();

  routes.get("/scan", async (c) => {
    const userId = c.get("userId");
    const vehicles = await listVehicles(c.env.DB, userId);
    const requested = idOf(c.req.query("vehicle"));
    if (requested !== null && !(await getVehicle(c.env.DB, userId, requested))) return notFound(c);
    if (vehicles.length === 0) return c.redirect("/vehicles/new?from=scan", 302);
    const { perUser, global } = caps(c);
    const left = await scansLeft(c.env.DB, userId, c.get("today"), perUser, global);
    return c.html(<ScanPage vehicles={vehicles} selected={requested ?? vehicles[0].id} left={left} />);
  });

  // Stores the photo, has the AI read it, and opens the service form prefilled. Nothing is saved to
  // the database until the user presses Save on that form (which posts to /services).
  routes.post("/scan", async (c) => {
    if (uploadTooLarge(c.req.raw)) return c.html(<PhotoTooLarge />, 413);
    const userId = c.get("userId");
    const body = await c.req.parseBody();
    const vehicleId = idOf(body.vehicle);
    const vehicle = vehicleId === null ? null : await getVehicle(c.env.DB, userId, vehicleId);
    if (!vehicle) return notFound(c);

    const { perUser, global } = caps(c);
    const page = async (error: string, status: 400 | 413 | 415 | 429 | 503) => {
      const [vehicles, left] = await Promise.all([
        listVehicles(c.env.DB, userId),
        scansLeft(c.env.DB, userId, c.get("today"), perUser, global),
      ]);
      return c.html(<ScanPage vehicles={vehicles} selected={vehicle.id} error={error} left={left} />, status);
    };
    const file = body.photo instanceof File && body.photo.size > 0 ? body.photo : null;
    if (!file) return page("Choose or take a photo of the receipt.", 400);
    const problem = photoProblem(file);
    if (problem) return page(problem.message, problem.status);
    // Counted once the upload is acceptable, before anything is stored or sent: a scan counts even
    // if the AI then fails, which bounds the bill.
    if (!(await takeScan(c.env.DB, userId, c.get("today"), perUser, global))) return page(SCAN_LIMIT_REACHED, 429);

    let key: string;
    try {
      key = await putReceipt(c.env.RECEIPTS, userId, file);
    } catch (e) {
      console.warn("receipt upload failed", e instanceof Error ? e.message : e);
      await giveBackScan(c.env.DB, userId, c.get("today")); // the scan never ran
      return page("Couldn't store the photo just now. Please try again.", 503);
    }
    await inBackground(c, cleanupOrphans(c.env.RECEIPTS, c.env.DB));
    const items = await listItems(c.env.DB, userId, vehicle.id);
    const today = c.get("today");
    const config = { apiKey: c.env.OPENROUTER_API_KEY, model: c.env.SCAN_MODEL };
    const result = await scanReceipt({ bytes: await file.arrayBuffer(), contentType: file.type }, config, today, aiFetch);

    const form = result ? scanFormValues(result, items) : { values: blankServiceForm(), unread: [] };
    return c.html(
      <ServiceForm
        vehicle={vehicle}
        items={items}
        values={form.values}
        mode={{ kind: "new" }}
        receiptKey={key}
        unread={form.unread}
        notice={result ? SCAN_READ : SCAN_FAILED}
      />,
    );
  });

  return routes;
}

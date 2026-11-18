import type { Context } from "hono";
import { Hono } from "hono";
import type { AppEnv } from "./app-types";
import { inBackground } from "./background";
import { getVehicle, listItems, listVehicles } from "./db";
import { scanReceipt } from "./openrouter";
import { cleanupOrphans, photoProblem, putReceipt, uploadTooLarge } from "./receipts";
import { blankServiceForm, scanFormValues } from "./service-form";
import { NotFound } from "./views/NotFound";
import { PhotoTooLarge } from "./views/PhotoTooLarge";
import { ScanPage } from "./views/ScanPage";
import { ServiceForm } from "./views/ServiceForm";

const notFound = (c: Context<AppEnv>) => c.html(<NotFound />, 404);
const idOf = (s: unknown) => (typeof s === "string" && /^\d+$/.test(s) ? Number(s) : null);

export const SCAN_FAILED = "Couldn't read receipt — fill in manually";
export const SCAN_READ = "Check what was read from the receipt, fill in anything highlighted, then save.";

export function scanRoutes(aiFetch: typeof fetch = fetch) {
  const routes = new Hono<AppEnv>();

  routes.get("/scan", async (c) => {
    const userId = c.get("userId");
    const vehicles = await listVehicles(c.env.DB, userId);
    const requested = idOf(c.req.query("vehicle"));
    if (requested !== null && !(await getVehicle(c.env.DB, userId, requested))) return notFound(c);
    if (vehicles.length === 0) return c.redirect("/vehicles/new", 302);
    return c.html(<ScanPage vehicles={vehicles} selected={requested ?? vehicles[0].id} />);
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

    const page = async (error: string, status: 400 | 413 | 415) =>
      c.html(<ScanPage vehicles={await listVehicles(c.env.DB, userId)} selected={vehicle.id} error={error} />, status);
    const file = body.photo instanceof File && body.photo.size > 0 ? body.photo : null;
    if (!file) return page("Choose or take a photo of the receipt.", 400);
    const problem = photoProblem(file);
    if (problem) return page(problem.message, problem.status);

    const key = await putReceipt(c.env.RECEIPTS, userId, file);
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

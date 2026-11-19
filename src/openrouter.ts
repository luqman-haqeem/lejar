// Reading a receipt photo with an OpenRouter vision model.

import { Buffer } from "node:buffer";
import { parseCount } from "./form";
import { parseDateInput } from "./lib/dates";
import { parseRM } from "./lib/money";
import { addMonths } from "./lib/dates";
import { formatPartSpec, positionsFor } from "./lib/parts";

export type ScanResult = {
  date: string | null;
  odometer_km: number | null;
  workshop: string | null;
  total_sen: number | null;
  lines: ScannedLine[];
};

/** Part details read off a line; set only when at least one was read. */
export type ScannedPart = { brand: string | null; spec: string | null; position: string | null; warranty_until: string | null };
export type ScannedLine = { description: string; cost_sen: number | null; part?: ScannedPart };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** No workshop bill is this big; a larger number is a misread. */
const MAX_SEN = 10_000_000 * 100;
const MAX_KM = 10_000_000;

/** RM as a number (245.5) or a string ("RM 245.50") → sen; anything else, negative or implausible → null. */
function sen(v: unknown): number | null {
  const parsed =
    typeof v === "number" ? (Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null) : typeof v === "string" ? parseRM(v) : null;
  return parsed !== null && parsed <= MAX_SEN ? parsed : null;
}

/** Whole km as a number or a string ("52,310"); anything else → null. */
function km(v: unknown): number | null {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  return parseCount(s, 0, MAX_KM) ?? null;
}

/** Brand, spec, position and warranty on a line, or undefined when none was read. */
function scannedPart(l: Record<string, unknown>, receiptDate: string | null): ScannedPart | undefined {
  const brand = text(l.brand);
  const spec = text(l.spec);
  const said = text(l.position)?.toLowerCase();
  const position = positionsFor("car").find((p) => p.toLowerCase() === said) ?? null;
  const months = parseCount(typeof l.warranty_months === "string" ? l.warranty_months.trim() : String(l.warranty_months ?? ""), 1, 120);
  const warranty_until =
    (typeof l.warranty_until === "string" ? parseDateInput(l.warranty_until) : null) ??
    (months && receiptDate ? addMonths(receiptDate, months) : null);
  if (!brand && !spec && !position && !warranty_until) return undefined;
  return { brand, spec: spec && formatPartSpec(spec), position, warranty_until };
}

/**
 * The model's JSON reply as a ScanResult. Tolerates a markdown code fence, numbers sent as strings,
 * and RM prefixes. A field it can't use becomes null; a date that's invalid or after `today` too.
 * Null when the reply isn't a JSON object at all.
 */
export function parseScanResponse(raw: string, today: string): ScanResult | null {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let data: unknown;
  try {
    data = JSON.parse(unfenced);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  const parsedDate = typeof data.date === "string" ? parseDateInput(data.date) : null;
  const date = parsedDate !== null && parsedDate <= today ? parsedDate : null;
  const lines = Array.isArray(data.lines) ? data.lines : [];
  return {
    date,
    odometer_km: km(data.odometer_km),
    workshop: text(data.workshop),
    total_sen: sen(data.total),
    lines: lines.flatMap((l) => {
      if (!isRecord(l)) return [];
      const description = text(l.description);
      if (!description) return [];
      const part = scannedPart(l, date);
      return [part ? { description, cost_sen: sen(l.cost), part } : { description, cost_sen: sen(l.cost) }];
    }),
  };
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const SCAN_TIMEOUT_MS = 25_000;

const str = (description: string) => ({ type: "string", description });

/**
 * What we ask the model to return. Every value is a plain string ("" when unreadable) because not
 * every provider's strict mode accepts nullable unions; parseScanResponse reads RM, km and dates
 * out of the strings.
 */
const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["date", "odometer_km", "workshop", "total", "lines"],
  properties: {
    date: str("Date on the receipt as YYYY-MM-DD, or \"\" if unreadable"),
    odometer_km: str("Odometer / mileage reading in km as digits, or \"\""),
    workshop: str("Workshop or shop name, or \"\""),
    total: str("Grand total in RM as a number like 245.50, or \"\""),
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "cost", "brand", "spec", "position", "warranty_until", "warranty_months"],
        properties: {
          description: str("The part or work as written on the receipt"),
          cost: str("Line amount in RM as a number like 180.00, or \"\""),
          brand: str("Brand of the part fitted (e.g. Michelin, Amaron), or \"\""),
          spec: str("Size or spec of the part as written (e.g. 205/55 R16 91V, NS60, 5W-30), or \"\""),
          position: str(
            "Where it was fitted, only if the receipt says so: All, Front, Rear, Front left, Front right, Rear left or Rear right; All for a set of 4 tyres; otherwise \"\"",
          ),
          warranty_until: str("Warranty end date as YYYY-MM-DD if a date is written, or \"\""),
          warranty_months: str("Warranty length in months as digits if written as a period (e.g. 1 year = 12), or \"\""),
        },
      },
    },
  },
} as const;

const PROMPT = `This is a photo of a vehicle workshop receipt or invoice from Malaysia, possibly in English or Malay.
Read it and return the receipt's date, the odometer (mileage) reading in km if written, the workshop name,
the grand total in RM, and each line item with its amount in RM. For a part, also give its brand, size or spec,
position and warranty when written. Dates on Malaysian receipts are usually
day/month/year; return them as YYYY-MM-DD. Use "" for anything you can't read with confidence: don't guess.`;

export type ScanConfig = { apiKey: string; model: string };
export type ReceiptImage = { bytes: Uint8Array | ArrayBuffer; contentType: string };

/**
 * Asks the model to read the receipt. Returns null (never throws) on any failure: network error,
 * the 25 s timeout (SCAN_TIMEOUT_MS), a non-200 reply, an error body, or a reply that isn't usable
 * JSON. Failures are logged so `wrangler tail` shows why a scan came back empty.
 */
export async function scanReceipt(
  image: ReceiptImage,
  config: ScanConfig,
  today: string,
  fetchFn: typeof fetch = fetch,
): Promise<ScanResult | null> {
  try {
    const dataUrl = `data:${image.contentType};base64,${Buffer.from(image.bytes).toString("base64")}`;
    const res = await fetchFn(OPENROUTER_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_schema", json_schema: { name: "receipt", strict: true, schema: RECEIPT_SCHEMA } },
        // Only route to a provider that honours response_format.
        provider: { require_parameters: true },
        temperature: 0,
      }),
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn("receipt scan failed", res.status, (await res.text()).slice(0, 500));
      return null;
    }
    const reply = (await res.json()) as { choices?: { message?: { content?: unknown } }[]; error?: unknown };
    const content = reply.choices?.[0]?.message?.content;
    const result = typeof content === "string" ? parseScanResponse(content, today) : null;
    if (!result) console.warn("receipt scan unusable", JSON.stringify(reply.error ?? content ?? reply).slice(0, 500));
    return result;
  } catch (e) {
    console.warn("receipt scan error", e instanceof Error ? e.name : e);
    return null;
  }
}

// Reading a receipt photo with an OpenRouter vision model.

import { Buffer } from "node:buffer";
import { parseCount } from "./form";
import { parseDateInput } from "./lib/dates";
import { parseRM } from "./lib/money";

export type ScanResult = {
  date: string | null;
  odometer_km: number | null;
  workshop: string | null;
  total_sen: number | null;
  lines: { description: string; cost_sen: number | null }[];
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** RM as a number (245.5) or a string ("RM 245.50") → sen; anything else (or negative) → null. */
function sen(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  return typeof v === "string" ? parseRM(v) : null;
}

function km(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 ? v : null;
  return typeof v === "string" ? (parseCount(v.trim(), 0, 10_000_000) ?? null) : null;
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

  const date = typeof data.date === "string" ? parseDateInput(data.date) : null;
  const lines = Array.isArray(data.lines) ? data.lines : [];
  return {
    date: date !== null && date <= today ? date : null,
    odometer_km: km(data.odometer_km),
    workshop: text(data.workshop),
    total_sen: sen(data.total),
    lines: lines.flatMap((l) => {
      const description = isRecord(l) ? text(l.description) : null;
      return description && isRecord(l) ? [{ description, cost_sen: sen(l.cost) }] : [];
    }),
  };
}


const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const SCAN_TIMEOUT_MS = 25_000;

const nullable = (type: string) => ({ type: [type, "null"] });

/** What we ask the model to return. Money in RM as numbers; parseScanResponse converts. */
const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["date", "odometer_km", "workshop", "total", "lines"],
  properties: {
    date: { ...nullable("string"), description: "Date on the receipt as YYYY-MM-DD, or null if unreadable" },
    odometer_km: { ...nullable("integer"), description: "Odometer / mileage reading in km, or null" },
    workshop: { ...nullable("string"), description: "Workshop or shop name, or null" },
    total: { ...nullable("number"), description: "Grand total in RM, or null" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "cost"],
        properties: {
          description: { type: "string", description: "The part or work as written on the receipt" },
          cost: { ...nullable("number"), description: "Line amount in RM, or null" },
        },
      },
    },
  },
} as const;

const PROMPT = `This is a photo of a vehicle workshop receipt or invoice from Malaysia, possibly in English or Malay.
Read it and return the receipt's date, the odometer (mileage) reading in km if written, the workshop name,
the grand total in RM, and each line item with its amount in RM. Dates on Malaysian receipts are usually
day/month/year; return them as YYYY-MM-DD. Use null for anything you can't read with confidence: don't guess.`;

export type ScanConfig = { apiKey: string; model: string };
export type ReceiptImage = { bytes: Uint8Array | ArrayBuffer; contentType: string };

/**
 * Asks the model to read the receipt. Returns null (never throws) on any failure: network error,
 * the ${SCAN_TIMEOUT_MS / 1000} s timeout, a non-200 reply, or a reply that isn't usable JSON.
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
        temperature: 0,
      }),
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const reply = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = reply.choices?.[0]?.message?.content;
    return typeof content === "string" ? parseScanResponse(content, today) : null;
  } catch {
    return null;
  }
}

// Categories on service lines: a label for what a line is about, for finding lines later (see GLOSSARY.md).

import { keywordPattern } from "./keywords";

/** The built-in list, in the order it's offered. */
export const CATEGORIES = [
  "Engine",
  "Filters",
  "Brakes",
  "Tyres",
  "Battery",
  "Wipers",
  "Suspension",
  "Electrical",
  "Body",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const isCategory = (s: string): s is Category => (CATEGORIES as readonly string[]).includes(s);

// The built-in schedule items (src/lib/templates.ts) by name, lowercased. Fluids and parts that keep
// the engine and drivetrain running count as Engine.
const ITEM_CATEGORIES: Record<string, Category> = {
  "engine oil": "Engine",
  "oil filter": "Filters",
  "air filter": "Filters",
  "cabin filter": "Filters",
  "atf/cvt fluid": "Engine",
  "spark plugs": "Engine",
  "spark plug": "Engine",
  "brake fluid": "Brakes",
  coolant: "Engine",
  "drive chain/belt": "Engine",
};

/** The category a line linked to this schedule item gets by default: null for an owner's own item. */
export const itemCategory = (itemName: string): Category | null =>
  ITEM_CATEGORIES[itemName.trim().toLowerCase()] ?? null;

// English and Malay keywords per category, matched as whole words with an optional plural "s". Order
// matters: filters come before Engine ("oil filter" isn't engine oil) and Brakes before Engine
// ("minyak brek" isn't "minyak hitam"). Bare "plug" and "belt" are left out, as in matchItems.ts.
const RULES: { category: Category; keywords: string[] }[] = [
  { category: "Filters", keywords: ["filter", "penapis"] },
  { category: "Brakes", keywords: ["brake", "brek", "brake pad", "disc", "disc pad", "rotor", "brake shoe"] },
  { category: "Wipers", keywords: ["wiper", "wiper blade"] },
  { category: "Battery", keywords: ["battery", "batteries", "bateri"] },
  { category: "Tyres", keywords: ["tyre", "tire", "tayar", "wheel alignment", "alignment", "balancing"] },
  { category: "Suspension", keywords: ["absorber", "shock", "suspension", "ball joint", "stabiliser", "stabilizer", "bush", "bushing"] },
  { category: "Electrical", keywords: ["bulb", "mentol", "fuse", "lampu", "headlight", "headlamp", "alternator", "starter motor"] },
  { category: "Body", keywords: ["windscreen", "cermin", "bumper", "side mirror", "paint", "dent"] },
  {
    category: "Engine",
    keywords: [
      "engine oil", "minyak hitam", "oil change", "fully synthetic", "semi synthetic", "spark plug",
      "palam pencucuh", "coolant", "radiator", "atf", "cvt", "gear oil", "minyak gear", "timing belt",
      "drive chain", "rantai",
    ],
  },
];

const COMPILED = RULES.map((r) => ({ category: r.category, pattern: keywordPattern(r.keywords) }));

// A tyre size written anywhere in the line: "205/55R16", "205/55 R16", "185/65-15".
const TYRE_SIZE = /\b\d{3}\/\d{2}\s*[R-]?\s*\d{2}\b/i;

/** The built-in category a receipt line is most likely about, from its description, or null. */
export function suggestCategory(description: string): Category | null {
  if (TYRE_SIZE.test(description)) return "Tyres";
  return COMPILED.find((r) => r.pattern.test(description))?.category ?? null;
}

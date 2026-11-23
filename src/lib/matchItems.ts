// Suggests which schedule item a receipt line is about, from English and Malay keywords.

import { keywordPattern } from "./keywords";

type Rule = { keywords: string[]; item: string };

// Order matters: more specific work comes first, so "oil filter" wins over "engine oil". Bare "plug"
// and "belt" are left out: drain plugs and fan/timing belts are common on receipts and aren't these.
// `item` matches a schedule item whose name starts with it (e.g. "Spark plug" → "Spark plugs").
const RULES: Rule[] = [
  { keywords: ["oil filter", "penapis minyak"], item: "Oil filter" },
  { keywords: ["air filter", "penapis udara"], item: "Air filter" },
  { keywords: ["cabin", "aircond filter", "penapis aircond"], item: "Cabin filter" },
  { keywords: ["atf", "cvt", "gear oil", "minyak gear"], item: "ATF/CVT fluid" },
  { keywords: ["brake fluid", "minyak brek"], item: "Brake fluid" },
  { keywords: ["spark plug", "palam pencucuh"], item: "Spark plug" },
  { keywords: ["coolant", "radiator"], item: "Coolant" },
  { keywords: ["chain", "rantai", "drive belt", "v-belt", "cvt belt", "tali sawat"], item: "Drive chain/belt" },
  { keywords: ["minyak hitam", "engine oil", "oil change", "fully synthetic", "semi synthetic"], item: "Engine oil" },
];

const COMPILED = RULES.map((r) => ({ item: r.item.toLowerCase(), pattern: keywordPattern(r.keywords) }));

/** The id of the vehicle's schedule item this line is most likely about, or null. */
export function suggestItem(description: string, items: { id: number; name: string }[]): number | null {
  for (const rule of COMPILED) {
    if (!rule.pattern.test(description)) continue;
    const item = items.find((i) => i.name.toLowerCase().startsWith(rule.item));
    if (item) return item.id;
  }
  return null;
}

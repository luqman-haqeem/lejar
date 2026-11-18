// Suggests which schedule item a receipt line is about, from English and Malay keywords.

type Rule = { keywords: string[]; item: string };

// Order matters: more specific work comes first, so "oil filter" wins over "engine oil".
// `item` matches a schedule item whose name starts with it (e.g. "Spark plug" → "Spark plugs").
const RULES: Rule[] = [
  { keywords: ["oil filter", "penapis minyak"], item: "Oil filter" },
  { keywords: ["air filter", "penapis udara"], item: "Air filter" },
  { keywords: ["cabin", "aircond filter", "penapis aircond"], item: "Cabin filter" },
  { keywords: ["atf", "cvt", "gear oil", "minyak gear"], item: "ATF/CVT fluid" },
  { keywords: ["brake fluid", "minyak brek"], item: "Brake fluid" },
  { keywords: ["spark plug", "plug"], item: "Spark plug" },
  { keywords: ["coolant", "radiator"], item: "Coolant" },
  { keywords: ["chain", "rantai", "belt"], item: "Drive chain/belt" },
  { keywords: ["minyak hitam", "engine oil", "oil change", "fully synthetic", "semi synthetic"], item: "Engine oil" },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const COMPILED = RULES.map((r) => ({
  item: r.item.toLowerCase(),
  pattern: new RegExp(`\\b(?:${r.keywords.map(escape).join("|")})\\b`, "i"),
}));

/** The id of the vehicle's schedule item this line is most likely about, or null. */
export function suggestItem(description: string, items: { id: number; name: string }[]): number | null {
  for (const rule of COMPILED) {
    if (!rule.pattern.test(description)) continue;
    const item = items.find((i) => i.name.toLowerCase().startsWith(rule.item));
    if (item) return item.id;
  }
  return null;
}

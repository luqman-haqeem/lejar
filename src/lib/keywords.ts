// Keyword matching for receipt lines, shared by schedule item and category suggestions.

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Matches any of the keywords as whole words, allowing a plural "s": "spark plugs", "oil filters". */
export const keywordPattern = (keywords: string[]) =>
  new RegExp(`\\b(?:${keywords.map(escapeRegex).join("|")})s?\\b`, "i");

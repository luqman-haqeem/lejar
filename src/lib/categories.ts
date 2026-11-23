// Categories on Service lines (see GLOSSARY.md): what a line is about, for finding it later.
// Separate from the schedule item a line resets, which drives reminders.

export const CATEGORIES = ["Engine", "Filters", "Brakes", "Tyres", "Battery", "Wipers", "Suspension", "Electrical", "Body", "Other"] as const;

export type Category = (typeof CATEGORIES)[number];

export const isCategory = (s: string): s is Category => (CATEGORIES as readonly string[]).includes(s);

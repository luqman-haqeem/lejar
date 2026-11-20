---
name: Lejar
description: The dealer service booklet from the glovebox, as a phone app. Navy covers, cream ruled pages, violet visit stamps.
colors:
  paper: "#f4efe2"
  page: "#fbf8f0"
  rule: "#d8cfbb"
  ink: "#1f2328"
  muted: "#5f5a4f"
  field-line: "#8a8270"
  navy: "#24305e"
  navy-ink: "#ffffff"
  navy-muted: "#c3c9e4"
  violet: "#6b3fa0"
  violet-ink: "#ffffff"
  violet-text: "#5d3590"
  violet-tint: "#efe8f6"
  overdue: "#a8231c"
  overdue-bg: "#f7e1dc"
  soon: "#7f4c00"
  soon-bg: "#f6e8c8"
  danger: "#a8231c"
  plate-black: "#000000"
  plate-white: "#ffffff"
  paper-dark: "#11141c"
  page-dark: "#191d28"
  rule-dark: "#303748"
  ink-dark: "#ece6d8"
  muted-dark: "#aaa392"
  field-line-dark: "#6f7890"
  navy-dark: "#1d2650"
  navy-muted-dark: "#aeb6da"
  violet-dark: "#7f52bd"
  violet-text-dark: "#c7a8ee"
  violet-tint-dark: "#2a2140"
  overdue-dark: "#ff8f84"
  overdue-bg-dark: "#3a1c1b"
  soon-dark: "#f0b660"
  soon-bg-dark: "#362a14"
typography:
  display:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.15
  cover-name:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
  body:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  body-strong:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  label:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
  tab-label:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.01em"
  plate:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
    letterSpacing: "0.06em"
  stamp-date:
    fontFamily: "Courier Prime, ui-monospace, Menlo, monospace"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.25
    fontFeature: "tnum"
  stamp-body:
    fontFamily: "Courier Prime, ui-monospace, Menlo, monospace"
    fontSize: "0.85rem"
    fontWeight: 700
    lineHeight: 1.25
    fontFeature: "tnum"
rounded:
  corner: "0.25rem"
  plate: "0.2rem"
  stamp: "0.55rem"
  pill: "1rem"
  disc: "50%"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "2rem"
  tap-min: "2.75rem"
  row-min: "2.875rem"
  column: "36rem"
  tabbar: "4.25rem"
components:
  button-primary:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.violet-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.corner}"
    padding: "0.6rem 1.15rem"
    height: "2.875rem"
  button-secondary:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.corner}"
    padding: "0.6rem 1.15rem"
    height: "2.875rem"
  button-secondary-hover:
    backgroundColor: "{colors.violet-tint}"
  button-secondary-active:
    backgroundColor: "{colors.rule}"
  cover:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.navy-ink}"
    typography: "{typography.cover-name}"
    rounded: "{rounded.corner}"
    padding: "1rem 1rem 1.05rem"
  plate:
    backgroundColor: "{colors.plate-black}"
    textColor: "{colors.plate-white}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "0.3rem 0.55rem 0.25rem"
  book-page:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.corner}"
  schedule-row:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    padding: "0.55rem 1rem"
    height: "2.875rem"
  schedule-row-overdue:
    backgroundColor: "{colors.overdue-bg}"
    textColor: "{colors.overdue}"
  schedule-row-soon:
    textColor: "{colors.soon}"
  stamp:
    backgroundColor: "{colors.page}"
    textColor: "{colors.violet-text}"
    typography: "{typography.stamp-body}"
    rounded: "{rounded.stamp}"
    padding: "0.65rem 0.7rem 0.7rem"
  stamp-active:
    backgroundColor: "{colors.violet-tint}"
  input-field:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.corner}"
    padding: "0.6rem 0.7rem"
    height: "2.875rem"
  input-field-unread:
    backgroundColor: "{colors.soon-bg}"
  pick:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.corner}"
    padding: "0 0.95rem"
    height: "2.75rem"
  pick-selected:
    backgroundColor: "{colors.violet-tint}"
    textColor: "{colors.violet-text}"
  tabbar:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.navy-muted}"
    typography: "{typography.tab-label}"
    height: "4.25rem"
  tabbar-current:
    textColor: "{colors.navy-ink}"
  scan-disc:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.violet-ink}"
    rounded: "{rounded.disc}"
    size: "3.5rem"
  segment:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    height: "2.75rem"
  segment-selected:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.navy-ink}"
  notice:
    backgroundColor: "{colors.violet-tint}"
    textColor: "{colors.violet-text}"
    rounded: "{rounded.corner}"
    padding: "0.65rem 0.85rem"
  tag:
    backgroundColor: "{colors.violet-tint}"
    textColor: "{colors.violet-text}"
    rounded: "{rounded.pill}"
    padding: "0.05rem 0.45rem"
---

# Design System: Lejar

<!-- impeccable:design-map -->
Name: Lejar
Colors: primary: violet #6b3fa0; secondary: navy #24305e; tertiary: overdue #a8231c; neutral: paper #f4efe2; primary: violet-ink #ffffff; primary: violet-text #5d3590; primary: violet-tint #efe8f6 (+28 more in the sidecar)
Fonts: Barlow (display, headline, cover-name, title, body, body-strong, label, tab-label, plate); Courier Prime (stamp-date, stamp-body)
Spacing: xs 0.25rem, sm 0.5rem, md 0.75rem, lg 1rem, xl 1.5rem, 2xl 2rem, tap-min 2.75rem, row-min 2.875rem, column 36rem, tabbar 4.25rem
Radius: corner 0.25rem, plate 0.2rem, stamp 0.55rem, pill 1rem, disc 50%
North Star: "The Stamped Service Book"
Rules:
- The One Stamp Rule. Violet is the only accent.
- The Red-Means-Late Rule. Red and amber-brown are status colours and nothing else.
- The Words-Icon-Colour Rule. A flagged status (overdue, due soon, unknown) is always colour plus an icon plus words: circle-cross for overdue, clock for due soon, pencil for unknown.
- The Typewriter-Only-In-Stamps Rule. Courier Prime appears inside a stamp and nowhere else.
- The Rem Rule. Every size, padding and target is in rem, so the Text size preference (`html[data-text-size]`: default 100%, `large` 112.5%, `larger` 125%) scales the whole booklet.
- The 44 Rule. Every touch target is at least 2.75rem (44px at 100% text size): text links, crumbs, segments, quiet links and the "more" link.
- The Ruled-Not-Raised Rule. Lists, tables, schedules, totals, facts and profile rows are ruled blocks on the page colour, headed by a 2px ink rule; they never get a drop shadow.
Elevation:
- Raised Scan disc: 0 0.35rem 0.8rem color-mix(in srgb, var(--navy) 60%, #000 40%)
- Plate edge: inset 0 0 0 1px rgba(255, 255, 255, 0.28)
Don't:
- Don't use soft floating cards or coloured status dots; status lives on a ruled line, in words.
- Don't use Courier Prime outside a visit stamp.
- Don't add a second accent; violet is the only one, and red and amber-brown mean status.
- Don't add drop shadows to blocks or rows; the raised Scan disc is the only shadow.
- Don't round beyond 4px except the stamp, the Scan disc and the small line-item tag.
- Don't size type, padding or targets in px; px is for border widths only.
Full: .impeccable/design-full.md (read a section when you need its detail)

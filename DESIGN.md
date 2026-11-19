---
name: Kereta
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

# Design System: Kereta

## Overview

**Creative North Star: "The Stamped Service Book"**

Kereta is the dealer service booklet that lives in the glovebox, rebuilt for a phone held at a workshop counter. Every vehicle opens on a navy booklet cover carrying its name and a black number plate; under it sits a cream, ruled page of schedule rows; every logged visit lands in the history as a slightly crooked rubber stamp in violet ink. The whole interface is paper, ink and one stamp colour. Depth comes from rules and covers, not from floating cards.

Density is that of a printed form: rows at least 2.875rem tall, hairline rules between them, a 2px ink rule heading each ruled block, and tabular figures wherever a number sits in a column. The type is a single sturdy grotesque (Barlow) set at medium weight, with a typewriter face (Courier Prime) reserved for the stamps alone, so the stamp reads as a different instrument from the page it is pressed onto. The world refuses the category's soft cards with coloured status dots: status is told in words, with an icon, in a colour, on a ruled line.

At night the booklet keeps its structure. The ground turns navy-black, the page a little lighter, the rules dark slate, and the ink a warm cream; navy covers, black plates and violet stamps all survive the switch.

**Key Characteristics:**
- Navy booklet cover (shell, vehicle covers, tab bar, selected segment) over a cream ruled page.
- Ruled hairlines under a 2px ink head rule for every list, table and schedule.
- Violet is the only accent: stamp ink, the primary action, links, focus, selection.
- Barlow throughout; Courier Prime uppercase only inside stamps.
- Small 4px corners; plates are black badges; stamps are the one softer, tilted shape.
- Everything sized in rem so the Text size preference scales the whole booklet.

## Colors

Cream paper, navy covers, ink-black text and a single rubber-stamp violet, with red and amber-brown kept strictly for status.

### Primary
- **Rubber-Stamp Violet** (`violet`): the primary action fill (Scan receipt, Add vehicle), the raised Scan disc, focus rings, radio and checkbox accent, caret and text selection.
- **Stamp Ink Violet** (`violet-text`): the darker violet that meets text contrast on cream. Used for stamp borders and lettering, links, the odometer prompt, "Set last done" fix links, the dashed capture face.
- **Stamp Wash** (`violet-tint`): the faint violet behind pressed rows, pressed stamps, secondary-button hover, notices and line-item tags.

### Secondary
- **Booklet-Cover Navy** (`navy`): the shell colour. Vehicle covers, the tab bar, the selected segment of a segmented control, and the PWA theme colour. Text on navy is white (`navy-ink`); secondary text and inactive tabs use **Cover Silver** (`navy-muted`).

### Tertiary (status only)
- **Overdue Red** (`overdue`, with `overdue-bg` row wash): overdue schedule rows and expired renewals; the row gets the wash and its text turns red and bold. `danger` carries the same red for errors, destructive links and invalid fields.
- **Due-Soon Amber-Brown** (`soon`, with `soon-bg`): due-soon rows (text only, no wash) and scanned fields the reader couldn't read (field gets the `soon-bg` fill and a "couldn't read" suffix on its label).

### Neutral
- **Glovebox Cream** (`paper`): the page ground behind everything.
- **Booklet Page** (`page`): the lighter sheet for ruled blocks, inputs, secondary buttons and stamps.
- **Ruled Hairline** (`rule`): 1px row dividers and block outlines.
- **Ink** (`ink`): body text, the 2px head rules, secondary-button and segmented-control borders.
- **Faded Ink** (`muted`): secondary text, field labels, inactive "ok" due dates, chevrons.
- **Field Line** (`field-line`): the 1.5px border of text inputs and selects, darker than the hairline so fields read as fields.
- **Plate Black and White** (`plate-black`, `plate-white`): the number-plate badge only, identical in both themes.

The `-dark` tokens are the same roles at night, applied when `html[data-scheme="dark"]`, on screen only. The inline `<head>` script resolves `data-scheme` from the Theme choice (`html[data-theme]`): `dark`, or `system`/unset while the phone prefers dark. It follows the phone live, so printing always uses the light tokens. `navy-ink`, `violet-ink` and the plate colours do not change.

### Named Rules
**The One Stamp Rule.** Violet is the only accent. It marks what the user can do (primary action, links, focus) and what they have done (stamps). Nothing decorative is violet.

**The Red-Means-Late Rule.** Red and amber-brown are status colours and nothing else. Errors share the red because they are also "act now"; no other surface uses them.

**The Words-Icon-Colour Rule.** A flagged status (overdue, due soon, unknown) is always colour plus an icon plus words: circle-cross for overdue, clock for due soon, pencil for unknown. Colour alone never carries a status. An "ok" row is words only, in faded ink.

## Typography

**Display Font:** Barlow (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif), self-hosted at 500, 600 and 700.
**Label/Mono Font:** Courier Prime 700 (with ui-monospace, Menlo, monospace), self-hosted, stamps only.

**Character:** Barlow is the plain, slightly condensed grotesque of a dealer's printed form, set at medium weight so it holds up on cream; Courier Prime in uppercase is the rubber stamp's typewriter die.

### Hierarchy
- **Display** (700, 2.25rem, 1.15): the sign-in title only.
- **Headline** (700, 1.625rem, 1.15, balanced wrap): page titles. On the dashboard and vehicle page the cover takes this role and the h1 is visually hidden.
- **Cover name** (700, 1.5rem, 1.1): the vehicle name on its navy cover, with a 0.9rem Cover Silver subline in tabular figures.
- **Title** (700, 1.125rem): section heads (Schedule, Spent per year) and form legends.
- **Body** (500, 1rem, 1.5): running text; paragraphs in faded ink. Row names and links step up to 600; status figures and totals to 700.
- **Label** (600, 0.9rem): field labels and segmented-control legends, in faded ink.
- **Tab label** (600, 0.75rem, 0.01em): the three tab bar captions.
- **Stamp** (Courier Prime 700, uppercase, 1rem date / 0.85rem body, 1.25): visit stamps only.

### Named Rules
**The Typewriter-Only-In-Stamps Rule.** Courier Prime appears inside a stamp and nowhere else. Every other figure, including dates, odometer readings and money in rows and totals, is Barlow with tabular numerals.

**The Rem Rule.** Every size, padding and target is in rem, so the Text size preference (`html[data-text-size]`: default 100%, `large` 112.5%, `larger` 125%) scales the whole booklet. Px is allowed only for border widths and hairlines.

## Layout

A single column, `max-width: 36rem`, centred, padded 1rem at the sides. On signed-in pages the column's bottom padding clears the fixed tab bar plus the safe-area inset plus 2.5rem. Safe-area insets pad the body top and bottom.

Vertical rhythm uses a small rem step set: 0.25, 0.5, 0.75, 1, 1.5, 1.75 and 2rem. Section heads sit 1.75rem above their block; booklets are 1.5rem apart. Primary and secondary actions sit side by side in a wrapping row, each growing from a 9rem basis, 0.6rem apart.

Each vehicle on the dashboard is a booklet: a full-width navy cover, then its ruled page (schedule rows, a "more" link, renewals under their own head rule, and the odometer prompt). On the vehicle page the cover stands alone with full 4px corners, and the schedule is a ruled page with no cover above it. Visit stamps lay out in an auto-fill grid with a 9.5rem minimum, 1rem by 0.9rem gaps.

**Responsive behaviour.**
- **Below 30rem** each booklet runs edge to edge: covers and ruled pages take negative 1rem side margins, lose their corners and side borders, so a vehicle reads as a cover and its pages, not a card. Form submit buttons span the column.
- **Wide screens** keep the tab bar's three tabs over the 36rem column by padding the bar inline (`max(0px, (100% - 36rem) / 2)`); the navy band still spans the viewport.

### Named Rules
**The 44 Rule.** Every touch target is at least 2.75rem (44px at 100% text size): text links, crumbs, segments, quiet links and the "more" link. Rows, inputs and buttons are 2.875rem; profile rows 3.25rem.

## Elevation & Depth

The booklet is flat. Depth is told by material, not by shadow: the navy cover sits above the cream page because it is a different material, the page is lighter than the ground, and blocks are held by a 2px ink head rule and 1px hairlines. Pressed states darken or wash (brightness filters, `violet-tint` fills), never lift.

### Shadow Vocabulary
- **Raised Scan disc** (`box-shadow: 0 0.35rem 0.8rem color-mix(in srgb, var(--navy) 60%, #000 40%)`, a darkened navy so the shadow follows the theme): the violet Scan disc in the tab bar, raised 1.6rem above the bar inside a 0.3rem navy collar. It is the only shadow in the system.
- **Plate edge** (`box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28)`): a faint inner rim on the black plate so it separates from the navy cover.

### Named Rules
**The Ruled-Not-Raised Rule.** Lists, tables, schedules, totals, facts and profile rows are ruled blocks on the page colour, headed by a 2px ink rule; they never get a drop shadow. The one shadow belongs to the Scan disc.

## Shapes

Corners are small and printed: 4px (`corner`) on buttons, inputs, notices, covers, ruled pages and the receipt image. A cover over a page rounds only its top; the page rounds only its bottom, so the pair reads as one booklet. Plates are tighter (0.2rem) black badges. The visit stamp is the one softer, hand-made shape: a 0.55rem radius, a 2px violet border with a 1px inner rule inset 6px (a double-ruled stamp frame), and a slight tilt that varies by position (-1.6deg, 1.3deg, 0.7deg, -0.9deg across each four). The Scan disc is a circle. The line-item tag is a small pill.

Borders carry the form language: 1px hairlines between rows, 2px ink rules heading blocks, 1.5px ink on secondary buttons and segmented controls, 1.5px field line on inputs, 2px dashed violet on the receipt capture face.

## Components

### Buttons
Solid and stamped, never glossy.
- **Shape:** printed corner (0.25rem), 2.875rem minimum height, 0.6rem by 1.15rem padding, 700 weight, 1rem.
- **Primary:** Rubber-Stamp Violet fill, white text. Hover brightens (`brightness(1.08)`), press darkens (`brightness(0.88)`), 120ms ease-out.
- **Secondary:** page fill, ink text, 1.5px ink border. Hover washes `violet-tint`; press fills `rule`. The danger variant swaps text and border to red.
- **Text links and quiet links:** 600 weight, 2.75rem tall; links in `violet-text`, quiet and back links in faded ink. Press drops opacity to 0.6.
- **Focus:** a 3px violet outline, 2px offset, 4px corners, on every focusable element.
- **Busy:** a submitting form disables its buttons (opacity 0.55) and swaps the label for the form's busy message.
- **Local dev sign-in:** on localhost with `DEV_LOGIN=1` only, the sign-in page adds a secondary "Sign in as local dev user" button (14rem minimum) under Google's, with a faded 0.88rem "Local development only" note. It never renders on a deployed host, so it is not part of the shipped surface.

### Cover (signature)
A navy band, white 1.5rem vehicle name, a Cover Silver subline (type, make and model, year, estimated km in tabular figures) and the plate pinned right. On the dashboard the whole cover is a link; press brightens it.

### Plate
A black badge, white 700 text at 0.95rem with 0.06em tracking, 0.2rem corners and a faint inner rim. Appears on covers and profile rows; prints in colour.

### Ruled schedule rows (signature)
Item name left (600), status right (tabular, 0.95rem, with its status icon). The first row sits under the 2px ink head rule; rows are separated by hairlines. Overdue rows take the red wash with red bold text; due-soon rows turn amber-brown with a bold date; unknown rows show a violet pencil link to where the missing value is filled in. Renewals (road tax, insurance) follow the same pattern under their own head rule. The odometer prompt closes the page as a violet gauge-icon link.

### Visit stamp (signature)
A double-ruled violet frame on the page colour, Courier Prime uppercase: the date over a rule, then the workshop, then km and RM. Each stamp tilts a little; pressing straightens it and washes it violet. A visit just saved (`.stamp-new`, from `?stamped=<id>` after Save) is struck onto the page once: it drops from 1.35x scale and -6deg, fades in, and settles into its tilt over 520ms with an expo ease-out and a violet wash. It is the one authored motion moment in the app. With reduced motion, stamps sit straight, the strike is off and transitions are off.

### Inputs / Fields
- **Style:** page fill, 1.5px field-line border, 4px corners, 2.875rem tall, labels above in 0.9rem 600 faded ink.
- **Focus:** violet border plus the 3px violet outline at zero offset.
- **Error:** red border plus 1px red outline, a red 600 message below, and a linked error summary (2px red frame) at the top of the form.
- **Unread (from a scan):** amber-brown border, `soon-bg` fill, "· couldn't read" after the label.
- **Receipt capture:** a large dashed-violet tap face (5rem minimum) with a 2.25rem camera icon, a 700 1.125rem title and a faded 0.9rem note, over an invisible native file input that receives every tap, key and screen-reader action. Once a photo is picked the note reads "Chosen: <file name>"; focus puts the 3px violet outline on the face, press washes it `violet-tint`, and an error turns the dashes solid red.

### Navigation
A fixed navy tab bar, 4.25rem plus the safe-area inset: Home, a raised violet Scan disc labelled "Scan receipt", and Profile. Inactive tabs are Cover Silver; the current tab turns white and its icon stroke thickens to 2.4. Deeper pages carry a back crumb (chevron plus label, faded ink) instead of a tab.

### Segmented control
Profile's Text size and Theme choices: equal segments in a 1.5px ink frame, 2.75rem tall, page fill; the selected segment fills navy with white text. Native radios sit invisibly over each segment, focus draws an inset violet outline.

### Rows (Profile)
Ruled rows on the page colour under a head rule, 3.25rem tall, title plus small faded subline, an optional plate, and a right-hand violet action cell split off by a hairline.

### Icons
Inline line icons on a 24px grid, 2px round strokes in `currentColor`, 1.25rem (status icons 1.05rem), always decorative beside words.

## Do's and Don'ts

### Do:
- **Do** open each vehicle with its navy cover and plate, then a ruled page; keep the cover-over-page radius split (top on the cover, bottom on the page).
- **Do** head every list, table or schedule with a 2px ink rule and separate rows with 1px `rule` hairlines on the `page` colour.
- **Do** show every flagged status as colour plus icon plus words: overdue red with the circle-cross, due-soon amber-brown with the clock, unknown violet with the pencil.
- **Do** keep every touch target at least 2.75rem, and rows, inputs and buttons at 2.875rem.
- **Do** size everything in rem so `html[data-text-size]` (100% / 112.5% / 125%) scales the booklet.
- **Do** theme through the tokens only: `html[data-theme]` holds the choice (`system`, `light` or `dark`), and the dark tokens hang off the resolved `html[data-scheme="dark"]`, defined once.
- **Do** let booklets run edge to edge below 30rem, and hold the tab bar's tabs to the 36rem column on wide screens.
- **Do** use tabular figures for dates, km and money in rows, totals, facts and cover sublines.

### Don't:
- **Don't** use soft floating cards or coloured status dots; status lives on a ruled line, in words.
- **Don't** use Courier Prime outside a visit stamp.
- **Don't** add a second accent; violet is the only one, and red and amber-brown mean status.
- **Don't** add drop shadows to blocks or rows; the raised Scan disc is the only shadow.
- **Don't** round beyond 4px except the stamp, the Scan disc and the small line-item tag.
- **Don't** size type, padding or targets in px; px is for border widths only.

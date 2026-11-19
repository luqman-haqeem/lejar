---
version: 1
slug: "src-views-dashboard-tsx"
primary_target: "src/views/Dashboard.tsx"
related_targets: ["src/views/Layout.tsx","src/views/VehicleHistory.tsx","src/views/ServiceForm.tsx","src/views/ServiceView.tsx","src/views/ScanPage.tsx","src/views/VehicleForm.tsx"]
---

## Scope

Signed-in app shell and screens: dashboard `/`, vehicle `/vehicles/:id`, service view and form, scan, vehicle form, archived, the new `/profile`. Mode: Operate. Mobile first (390px iPhone, one hand, Home Screen PWA).

## Task

See what's due across vehicles, log a visit (scan first), keep the history a buyer can trust. Navigation: bottom tab bar Home · Scan receipt (raised centre) · Profile. Profile holds vehicle management (list, add, archived), appearance (text size, theme) and sign out.

## Direction contract

THESIS: The app is the dealer service booklet from the glovebox: a cover per vehicle, a ruled schedule, and every logged visit stamped. Refuses the category's soft cards with coloured status dots.

OWN-WORLD: Booklet-cover navy (#24305e) for the shell (tab bar, vehicle covers), cream paper ground (#f4efe2) with a lighter page (#fbf8f0), ruled hairlines (#d8cfbb) under a 2px ink header rule, rubber-stamp violet (#6b3fa0) for visit stamps and the primary action, red for overdue, amber-brown for due soon. Barlow throughout, Courier Prime only inside stamps (dates, km, RM). Square-ish 4px corners on paper, plates as black badges. Dark theme: navy-black ground, the same structure.

STORY: The owner opens the app, reads each vehicle's ruled schedule with overdue and due-soon rows marked in words and icons, taps Scan to log the receipt in hand, and sees the visit land as a stamp in that vehicle's history.

FIRST VIEWPORT: Dashboard on 390x844: each vehicle starts with a full-width navy cover band (name, plate badge, make/model and estimated km), then a ruled paper page: schedule rows (item left, status right with icon), then road tax and insurance rows, then an odometer prompt when stale. Bottom: navy tab bar, Scan raised in violet at centre.

FORM: Stamped service book, the IMPECCABLE'S PICK card (my rank 1 of the first hand); seed: seed:84e97a7c77964419.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Malaysian car and motorbike owners who want a dependable record of their vehicles' maintenance. They usually use it on a phone (iPhone, as a Home Screen PWA), often standing at a workshop counter holding a fresh receipt, or at home typing in a backlog of old paper receipts and service-book stamps. Many own more than one vehicle, sometimes a car and a motorbike. A new user arrives with nothing in the app, so first-run clarity matters as much as speed for regular users. The builder is the first user but is not the design target.

Their jobs:
- log a workshop visit quickly, ideally by scanning the receipt;
- know what is due next (oil change, road tax, insurance) before it is overdue;
- hand a buyer a credible service history when selling the vehicle.

## Product Purpose

Kereta is a personal digital service book: every service, receipt and renewal in one place. It replaces the paper service book and the shoebox of receipts. In Phase 1, success means a user signs in with Google, scans a workshop receipt, checks and corrects the fields, and saves. The dashboard then shows which items are due soon, and the user can print or save the vehicle's full history as a PDF.

## Positioning

- **Due dates you can trust.** Every scanned receipt is confirmed by the user before it is saved, odometer mileage is estimated openly from real readings, and baselines ("last done roughly here") never pose as workshop visits.
- **Fast receipt scan.** Snap a Malaysian workshop receipt (Malay or English), and the form opens prefilled, with lines matched to schedule items (e.g. "minyak hitam" → Engine oil). Backdated entry is quick, with "Save & add another".
- **Resale-ready history.** A clean printable or PDF history that a buyer can believe, because it contains only real, confirmed visits.

## Operating Context

- Workshop receipts are often handwritten or thermal-printed and mix Malay and English.
- Road tax and insurance renew yearly and are the renewals Malaysian owners most often miss.
- The odometer comes from each service log. Users may also add manual readings, and the app prompts for one when the latest is more than 30 days old.
- Each vehicle type has its own schedule template (car vs motorbike), which the user can edit.
- The print view is used with the browser's Print / Save as PDF.

## Capabilities and Constraints

- **Phase 1:** Google sign-in (open to any verified account), vehicles (car or motorbike, archivable), editable service schedules with baselines, a manual service log with line items, receipt scan via an OpenRouter vision model, a due-status dashboard (Overdue / Due soon / OK), odometer readings, a print view, and a PWA manifest.
- **Scan caps:** 20 scans per user per day (Malaysia date) and 300 per day globally. Manual logging is never capped, and the limit message always offers the manual route.
- **Nothing from a scan is saved until the user presses Save.** Fields the AI couldn't read stay blank and are highlighted.
- **Locale:** English UI, money in RM, dates shown as DD/MM/YYYY, timezone Asia/Kuala_Lumpur.
- **Stack:** server-rendered Hono JSX on Cloudflare Workers (Free plan, about 10 ms CPU per request), D1, and R2, with only a little vanilla JS. There is no SPA or heavy build toolchain.
- **Privacy:** each user sees only their own data, and receipt images are served only through an auth-guarded route.
- **Anti-goals:** ads, a workshop marketplace, teams or shared vehicles, and surprise AI bills.
- **Phase 2 (undecided detail):** Web Push reminders, a settings page, account deletion, and data export.

## Brand Commitments

- The name **Kereta** is fixed.
- The voice is plain, direct English. Malay terms Malaysian owners actually use (e.g. road tax, minyak hitam, cukai jalan) are welcome where they read naturally.
- There are no other binding identity assets. The current teal theme colour and icons are incumbent, not committed.

## Evidence on Hand

- The product spec is at `docs/superpowers/specs/2026-10-18-kereta-design.md`.
- There are no testimonials, user counts, press or partnerships, and future work must not invent any.

## Product Principles

1. **Confirmed truth over convenience.** Never save or show data the user hasn't confirmed, and never present estimates or baselines as recorded fact.
2. **The receipt in hand is the main moment.** Logging a visit from a receipt should be the fastest path in the app.
3. **What's due comes first.** The dashboard answers "what needs attention, and when?" before anything else.
4. **Works for a stranger on day one.** An empty account should lead clearly to adding the first vehicle and its first service.
5. **The history should hold up for a buyer.** Anything that reaches print or PDF must stand up to a buyer's scrutiny.

## Accessibility & Inclusion

- Phone-first, one-handed use, with 44px tap targets (already established).
- Status (overdue, due soon, OK) must never rely on colour alone.

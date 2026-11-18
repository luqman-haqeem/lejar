# 08: Print / Save as PDF

**What to build:** A print-ready page for each vehicle that the user can save as a PDF from the browser, for example to show a buyer. It shows the vehicle header (name, plate, make, model and year, plus the date it was generated), every service with its date, odometer, workshop, line items and total, and a grand total.

**Blocked by:** 03

**Status:** done

- [x] A print stylesheet hides the navigation and the Print button. Nothing is rendered on the server as a PDF.
- [x] Baselines never appear on this page.
- [x] Another user opening this page gets 404.
- [x] Tests and the typecheck pass.

## Comments

- 2026-11-18 (implementation): Services print oldest first, as a service book reads (the vehicle page is newest first).
- The owner's private service notes are left off the print page, which is meant for buyers.
- The app's navigation isn't rendered on this page at all; the print stylesheet hides the Back link and the Print button.

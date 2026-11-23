# 02: Category on a service line

**What to build:** On the service form an owner can give each service line a category from a built-in list, independent of "Resets reminder". The category is saved with the line and shown on the service view. A line marked "No reminder" can still have a category, so a part they track without reminders (wiper blades, a DIY part bought online) is labelled.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

Parent: 01-line-categories

Decisions: one category per line; the built-in list is Engine, Filters, Brakes, Tyres, Battery, Wipers, Suspension, Electrical, Body, Other; owner-defined categories come later (07).

- [ ] Each service line row on the add and edit service forms has an optional Category choice with the built-in list and a "No category" choice, next to "Resets reminder".
- [ ] Saving stores the category on the line; editing the service shows it selected and can change or clear it.
- [ ] An unknown category value posted to the form is rejected with a field error, not saved.
- [ ] The service view shows a line's category; a line without one shows nothing extra (no bare dash).
- [ ] Lines saved before this change load, show and edit with no category.
- [ ] A D1 migration adds the column; existing rows need no backfill.
- [ ] GLOSSARY.md defines **Category** (a label for what a Service line is about, for finding lines later) and how it differs from a schedule item (which drives reminders).
- [ ] Tests cover save, edit, clear, invalid value and a pre-existing line.

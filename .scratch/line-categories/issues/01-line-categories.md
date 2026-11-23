# 01: Categories on service lines, separate from reminders

**What to build:** An owner can tag a service line with a category (e.g. Tyres, Brakes, Battery, Wipers) whether or not it resets a reminder, and see every line in a category together, so a part they track but don't want reminders for (wiper blades, a DIY part bought online) can still be found as a group.

**Blocked by:** none

**Status:** needs-triage

**Background:** "Resets reminder" links a line to a schedule item, and that is the only grouping a line has. Every schedule item needs a km or month interval, so there's no reminder-free way to label a line. Today a line marked "No reminder" can only be found by scrolling the history or searching the print view.

- [ ] A service line has an optional category, set on the service form next to "Resets reminder" and independent of it.
- [ ] A line that resets a reminder gets that item's category by default (e.g. Engine oil → Engine), and the owner can change it.
- [ ] The service view shows a line's category.
- [ ] The vehicle page can list all lines in one category across services, newest first, with date, km, cost and part details.
- [ ] Receipt scans suggest a category per line, as they already suggest a schedule item.
- [ ] Existing lines keep working with no category.
- [ ] GLOSSARY.md defines **Category** and how it differs from a schedule item.

## Open questions

- Fixed list of categories, owner-defined, or a fixed list plus "Other"?
- One category per line, or several tags?
- Where does the per-category list live: a filter on the vehicle history, or its own page?
- Does the print history group or filter by category?

## Comments

- 2026-11-23: Came from logging DIY parts bought online: the owner wants to record a specific part without a reminder for it.

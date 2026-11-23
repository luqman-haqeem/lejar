# 03: Reminder item sets a default category

**What to build:** When an owner links a service line to a schedule item via "Resets reminder" and hasn't picked a category, the line gets that item's category (e.g. Engine oil → Engine, Air filter → Filters, Brake fluid → Brakes). The owner can still choose a different category or none.

**Blocked by:** 02

**Status:** ready-for-agent

Parent: 01-line-categories

- [ ] Each built-in schedule item name (car and motorbike templates) maps to a built-in category; a renamed or owner-added item with no mapping gives no default.
- [ ] Saving a line with a linked item and no category stores the item's default category.
- [ ] Saving a line with an explicitly chosen category keeps that choice, even if it differs from the item's default.
- [ ] An owner can save a linked line with "No category" deliberately (the form distinguishes "not chosen" from "none"), or the decision that the default always applies when blank is recorded in the ticket's comments.
- [ ] Tests cover the default, an override, and an unmapped item.

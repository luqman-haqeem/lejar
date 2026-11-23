# 05: Filter the vehicle history by category

**What to build:** On the vehicle page an owner can pick a category and see every service line in it across all that vehicle's services, newest first, so they can answer "when did I last change the tyres, and which ones?" in one place.

**Blocked by:** 02

**Status:** ready-for-agent

Parent: 01-line-categories

- [ ] The vehicle history offers a category filter listing only the categories that vehicle's lines actually use.
- [ ] Choosing a category lists its lines newest first, each with the service date, odometer, workshop, line cost and part details (brand, spec, position, warranty until), linking to its service.
- [ ] The filter is in the URL, so the filtered view can be bookmarked and the back button works.
- [ ] Clearing the filter returns to the normal history.
- [ ] Lines without a category never appear in a filtered list; a category with no lines can't be chosen.
- [ ] The query is scoped to the signed-in owner's vehicle (another user's vehicle id returns not found).
- [ ] Tests cover ordering, scoping, and an empty-history vehicle.

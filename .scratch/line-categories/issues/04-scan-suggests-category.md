# 04: Receipt scans suggest a category

**What to build:** After scanning a receipt, each prefilled service line arrives with a suggested category, the same way it already arrives with a suggested schedule item. The owner reviews and can change it before saving.

**Blocked by:** 02

**Status:** ready-for-agent

Parent: 01-line-categories

- [ ] Line descriptions are matched against English and Malay keywords per built-in category (e.g. tayar/tyre/tire → Tyres, brek/brake pad/disc → Brakes, bateri/battery → Battery, wiper → Wipers, absorber/shock → Suspension, bulb/mentol/fuse → Electrical).
- [ ] When the line also gets a suggested schedule item, its category follows that item's default (03) if 03 has landed; otherwise keyword matching alone.
- [ ] Lines with no match get no category; labour-only and package lines aren't forced into one.
- [ ] Suggested categories show as preselected on the scan-prefilled form, and the owner's change is what's saved.
- [ ] Tests cover English and Malay matches, a no-match line, and a real-receipt-like set of lines (e.g. the sample Perodua lines).

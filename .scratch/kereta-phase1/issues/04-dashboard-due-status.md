# 04: The dashboard shows what's due

**What to build:** Each vehicle card on the dashboard shows the estimated current km and the most urgent schedule items, each colour-coded as overdue, due soon or OK. It also shows road tax and insurance countdowns, and a prompt to update the odometer when the last reading is stale. Items with no history link straight to setting a baseline. The due calculation is pure logic with no I/O and is fully unit-tested.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] **Estimated km:** latest reading + (average km/day × days since that reading). The average uses readings from the last 12 months, plus the latest reading before that window as an anchor. With fewer than 2 readings, the estimate is just the latest reading. With no readings at all, there is no estimate, so only date-based status applies.
- [ ] **Last done** for an item is its most recent linked service line. If there is none, the item's baseline is used. With neither, the status is "unknown".
- [ ] **Due point:** km due = last km + interval km. Date due = last date + interval months, clamped to the end of the month (31/08 + 6 months = 28/02, or 29/02 in a leap year). Whichever comes first wins.
- [ ] **Status:** overdue when km left ≤ 0 or days left < 0. Due soon when within 1,000 km (car) or 300 km (motorbike), or within 14 days. Otherwise OK.
- [ ] **Road tax / insurance:** overdue on and after the expiry date, due soon within 30 days, and "not set" when there is no date.
- [ ] **Stale odometer:** the prompt shows when the latest reading is more than 30 days old (exactly 30 days is not stale).
- [ ] Items sort by urgency: overdue, then soon, then unknown, then OK.
- [ ] A user's dashboard never shows another user's vehicles.
- [ ] Tests and the typecheck pass.

## Comments

- 2026-11-18: Ticket 03 didn't add `lastDoneByItem` (latest linked service line per schedule item); this ticket writes it alongside the due logic.

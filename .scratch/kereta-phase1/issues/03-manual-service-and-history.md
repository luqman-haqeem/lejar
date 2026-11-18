# 03: Log a service manually and see the vehicle's history

**What to build:** The user logs a workshop visit by hand: date (any past date), odometer, workshop, total and notes, plus line items with a cost each and an optional link to a schedule item. Each service also counts as an odometer reading. The vehicle page shows the history newest first, with totals per year, and lets the user add a standalone odometer reading. Services can be viewed, edited and deleted. Entering a backlog of old paper records is quick.

**Blocked by:** 02

**Status:** done

- [x] Money is stored as integer sen and shown as `RM 1,234.50`. Inputs like "RM 1,234.5" and "85" are accepted. Negative or garbage amounts are rejected.
- [x] If the total is left blank, it defaults to the sum of the line costs.
- [x] An odometer value is checked against the vehicle's earlier and later readings. If a reading dated earlier has a higher km, or one dated later has a lower km, the form shows "Odometer X km conflicts with DD/MM/YYYY reading of Y km", keeps everything the user typed, and saves nothing.
- [x] "Save & add another" returns to a new form with the vehicle and workshop already filled in.
- [x] Deleting a service also removes its lines and its odometer reading.
- [x] Another user viewing, editing or deleting a service, logging a service against someone else's vehicle, or adding a reading to someone else's vehicle gets 404, and nothing changes.
- [x] Tests and the typecheck pass.

# 02: Add a vehicle with its service schedule

**What to build:** A signed-in user can add a car or motorbike (name, plate, make, model, year, road tax expiry, insurance expiry, insurer). It starts with a default service schedule for its type, which the user can edit: change intervals, add or remove items, and set a "last done roughly here" baseline (date and/or km) per item. Vehicles appear on the user's dashboard and can be archived. Users only ever see their own vehicles.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Default car schedule (km / months): Engine oil 10000/6, Oil filter 10000/6, Air filter 20000/12, Cabin filter 20000/12, ATF/CVT fluid 40000/24, Spark plugs 40000/24, Brake fluid —/24, Coolant 40000/24.
- [ ] Default motorbike schedule: Engine oil 3000/3, Oil filter 6000/6, Spark plug 10000/12, Drive chain/belt 1000/1, Brake fluid —/24.
- [ ] Editing the schedule saves changed intervals, new items, removed items and baselines.
- [ ] Archived vehicles disappear from the dashboard.
- [ ] Another user opening, editing or archiving the vehicle by URL gets 404, and nothing changes.
- [ ] Dates are stored as ISO and shown as DD/MM/YYYY. "Today" is taken in Asia/Kuala_Lumpur.
- [ ] Tests and the typecheck pass.

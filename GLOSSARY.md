# Lejar

A vehicle owner's own service book: the record of what was done to a car or motorbike, when, where and for how much, kept so it can be shown to a buyer.

## Language

### Service record

**Service**:
One workshop visit on a date, with a total paid, and optionally an Odometer reading, its receipt photo and Receipt number. A Service whose km the owner doesn't know has no Odometer reading; that's an honest blank, not a missing field.
_Avoid_: Visit, job, invoice

**Odometer reading**:
The km shown on a vehicle's odometer on a date, recorded either with a Service or on its own.
_Avoid_: Mileage, odo

**Receipt number**:
The number a workshop prints or writes on its receipt for a Service, when it gives one. Optional: many receipts have none.
_Avoid_: Invoice number, bill no., ref

**Likely duplicate**:
A Service on the same vehicle as another with the same Receipt number, or with the same date and total paid. The owner is warned but may keep both, since two real Services can match.
_Avoid_: Duplicate, double entry

**Receipt scan**:
The app reading a receipt photo to prefill a new Service. Nothing is recorded until the owner saves that Service.
_Avoid_: OCR, import

**Service line**:
One item on a Service, such as a part fitted or a labour charge, with an optional cost.
_Avoid_: Line item, entry, row

**Category**:
A label saying what a Service line is about, so its lines can be found together later: one from the built-in list (Engine, Filters, Brakes, Tyres, Battery, Wipers, Suspension, Electrical, Body, Other) or one of the owner's own, which they name, rename and delete, and share across all their vehicles. A line has at most one. Unlike a schedule item, which a line resets and which drives reminders, a Category never reminds: a line can have a Category with no reminder (wiper blades, a DIY part). A line that resets a schedule item takes that item's Category unless the owner picks another.
_Avoid_: Tag, type, group

**Part details**:
Optional facts about the part a Service line fitted: its brand, spec, position on the vehicle and warranty until date. A Service line without them is still complete.
_Avoid_: Part info, fitment, component

**Warranty until**:
The date a fitted part's warranty ends, as stated by the workshop or maker. Lejar records it and does not remind about it.
_Avoid_: Protection, guarantee

**Vehicle photo**:
The one photo an owner chooses to represent a vehicle.
_Avoid_: Car photo, cover photo, gallery

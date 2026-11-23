# A Service may have no Odometer reading

The original spec had every Service write an Odometer reading, so a Service's km was required. Owners backfilling a paper service book often don't know the km, and a made-up number is worse than a blank: it sets due km, skews the estimated current km and trips the conflict check for later, correct readings. So a Service now has zero or one Odometer reading (`services.odometer_km` is nullable, and a km-less Service has no row in `odometer_readings`). A blank km is saved only after the owner confirms it (`no_km=1`), and the app shows it as "km not recorded".

There is no "approximate" km. Due km for an item reset by a km-less Service is worked out by straight-line interpolation between the vehicle's readings either side of its date. It isn't stored or shown on the form, and with no reading on one side the item goes by date only. Undoing this would mean deciding what km to give every Service saved without one.

See issue #20.

-- A Service may have no Odometer reading (see GLOSSARY.md): services.odometer_km becomes nullable.
-- SQLite can't drop NOT NULL in place, so the table is rebuilt. Dropping services while
-- service_lines and odometer_readings still point at it would cascade-delete their rows, so both are
-- copied into plain backup tables and dropped first, then all three are recreated and filled back
-- with their ids. A Service with no km has no row in odometer_readings.

CREATE TABLE lines_backup AS SELECT * FROM service_lines;
CREATE TABLE readings_backup AS SELECT * FROM odometer_readings;
CREATE TABLE services_backup AS SELECT * FROM services;

DROP TABLE service_lines;
DROP TABLE odometer_readings;
DROP TABLE services;

CREATE TABLE services (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles (id),
  date TEXT NOT NULL,
  -- NULL: the owner doesn't know the km for this visit.
  odometer_km INTEGER,
  workshop TEXT NOT NULL DEFAULT '',
  total_sen INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  receipt_key TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX services_by_vehicle ON services (vehicle_id, date);

CREATE TABLE service_lines (
  id INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cost_sen INTEGER,
  -- Removing an item from the schedule keeps the history line, just unlinked.
  service_item_id INTEGER REFERENCES service_items (id) ON DELETE SET NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  part_brand TEXT,
  part_spec TEXT,
  -- All, Front, Rear, Front left, Front right, Rear left or Rear right.
  part_position TEXT,
  warranty_until TEXT,
  -- A built-in category (src/lib/categories.ts) or one of the owner's own, by name; NULL for none.
  category TEXT
);
CREATE INDEX service_lines_by_service ON service_lines (service_id, sort);
CREATE INDEX service_lines_by_item ON service_lines (service_item_id);

CREATE TABLE odometer_readings (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles (id),
  date TEXT NOT NULL,
  km INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('service', 'manual')),
  -- Set for readings that came from a service; deleting the service deletes its reading.
  service_id INTEGER UNIQUE REFERENCES services (id) ON DELETE CASCADE
);
CREATE INDEX odometer_readings_by_vehicle ON odometer_readings (vehicle_id, date);

INSERT INTO services (id, vehicle_id, date, odometer_km, workshop, total_sen, notes, receipt_key, created_at)
  SELECT id, vehicle_id, date, odometer_km, workshop, total_sen, notes, receipt_key, created_at FROM services_backup;
INSERT INTO service_lines
  (id, service_id, description, cost_sen, service_item_id, sort, part_brand, part_spec, part_position, warranty_until, category)
  SELECT id, service_id, description, cost_sen, service_item_id, sort, part_brand, part_spec, part_position, warranty_until, category
  FROM lines_backup;
INSERT INTO odometer_readings (id, vehicle_id, date, km, source, service_id)
  SELECT id, vehicle_id, date, km, source, service_id FROM readings_backup;

DROP TABLE lines_backup;
DROP TABLE readings_backup;
DROP TABLE services_backup;

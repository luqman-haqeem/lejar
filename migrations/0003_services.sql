CREATE TABLE services (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles (id),
  date TEXT NOT NULL,
  odometer_km INTEGER NOT NULL,
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
  sort INTEGER NOT NULL DEFAULT 0
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

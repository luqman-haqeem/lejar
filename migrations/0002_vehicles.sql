CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  type TEXT NOT NULL CHECK (type IN ('car', 'motorbike')),
  name TEXT NOT NULL,
  plate TEXT NOT NULL DEFAULT '',
  make TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  year INTEGER,
  roadtax_expiry TEXT,
  insurance_expiry TEXT,
  insurer TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX vehicles_by_user ON vehicles (user_id, archived);

CREATE TABLE service_items (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  interval_km INTEGER,
  interval_months INTEGER,
  baseline_date TEXT,
  baseline_km INTEGER,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX service_items_by_vehicle ON service_items (vehicle_id, sort);

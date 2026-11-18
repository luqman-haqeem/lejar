-- AI receipt scans per user per Malaysia date, for the daily caps.
CREATE TABLE scan_usage (
  user_id INTEGER NOT NULL REFERENCES users (id),
  date TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (user_id, date)
);
CREATE INDEX scan_usage_by_date ON scan_usage (date);

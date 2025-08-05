CREATE TABLE IF NOT EXISTS logs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  status TEXT,
  timestamp INTEGER,
  scheduled INTEGER,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_logs_name_time ON logs(name, timestamp DESC);

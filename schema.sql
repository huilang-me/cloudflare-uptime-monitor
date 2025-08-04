CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  scheduled INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_name_time ON logs(name, timestamp DESC);
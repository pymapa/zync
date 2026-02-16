-- Initial schema migration
-- Creates sync_status and activities tables with FTS5 full-text search

CREATE TABLE IF NOT EXISTS sync_status (
  user_id INTEGER PRIMARY KEY,
  last_sync_at INTEGER NOT NULL,
  last_activity_id INTEGER,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK(sync_state IN ('pending', 'syncing', 'completed', 'error')),
  total_activities INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  distance_meters REAL NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  elevation_gain_meters REAL NOT NULL,
  start_date INTEGER NOT NULL,
  start_date_local TEXT NOT NULL,
  average_speed REAL NOT NULL,
  max_speed REAL NOT NULL,
  average_heartrate REAL,
  max_heartrate REAL,
  calories REAL,
  description TEXT,
  average_cadence REAL,
  average_watts REAL,
  kudos_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  summary_polyline TEXT,
  start_latlng TEXT,
  end_latlng TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES sync_status(user_id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_type ON activities(user_id, type);
CREATE INDEX IF NOT EXISTS idx_activities_user_type_date ON activities(user_id, type, start_date DESC);

-- FTS5 virtual table for full-text search on activity names
CREATE VIRTUAL TABLE IF NOT EXISTS activities_fts USING fts5(
  name,
  content='activities',
  content_rowid='id'
);

-- Triggers to keep FTS in sync with activities table
CREATE TRIGGER IF NOT EXISTS activities_fts_insert AFTER INSERT ON activities BEGIN
  INSERT INTO activities_fts(rowid, name) VALUES (new.id, new.name);
END;

CREATE TRIGGER IF NOT EXISTS activities_fts_update AFTER UPDATE ON activities BEGIN
  UPDATE activities_fts SET name = new.name WHERE rowid = new.id;
END;

CREATE TRIGGER IF NOT EXISTS activities_fts_delete AFTER DELETE ON activities BEGIN
  DELETE FROM activities_fts WHERE rowid = old.id;
END;

-- Auto-update timestamps
CREATE TRIGGER IF NOT EXISTS activities_updated_at AFTER UPDATE ON activities BEGIN
  UPDATE activities SET updated_at = strftime('%s', 'now') WHERE id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS sync_status_updated_at AFTER UPDATE ON sync_status BEGIN
  UPDATE sync_status SET updated_at = strftime('%s', 'now') WHERE user_id = new.user_id;
END;

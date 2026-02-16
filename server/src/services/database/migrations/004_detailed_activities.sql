-- Add support for storing detailed activity data
-- Extends activities table with scalar fields and creates tables for complex nested data

-- Add scalar detailed activity fields to activities table
ALTER TABLE activities ADD COLUMN device_name TEXT;
ALTER TABLE activities ADD COLUMN gear_id TEXT;
ALTER TABLE activities ADD COLUMN max_watts REAL;
ALTER TABLE activities ADD COLUMN weighted_average_watts REAL;
ALTER TABLE activities ADD COLUMN kilojoules REAL;
ALTER TABLE activities ADD COLUMN suffer_score REAL;
ALTER TABLE activities ADD COLUMN elev_high REAL;
ALTER TABLE activities ADD COLUMN elev_low REAL;
ALTER TABLE activities ADD COLUMN photos_json TEXT; -- JSON: PhotosSummary
ALTER TABLE activities ADD COLUMN has_detailed_data INTEGER DEFAULT 0; -- Boolean flag (nullable with default 0)

-- Index for filtering activities with detailed data
CREATE INDEX IF NOT EXISTS idx_activities_has_detailed ON activities(user_id, has_detailed_data);

-- Table for activity laps
CREATE TABLE IF NOT EXISTS activity_laps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  lap_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  distance_meters REAL NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  start_date INTEGER NOT NULL, -- Unix timestamp
  total_elevation_gain REAL,
  average_speed REAL,
  max_speed REAL,
  average_heartrate REAL,
  max_heartrate REAL,
  average_cadence REAL,
  average_watts REAL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  UNIQUE(activity_id, lap_index)
);

CREATE INDEX IF NOT EXISTS idx_laps_activity ON activity_laps(activity_id);

-- Table for metric splits (km-based)
CREATE TABLE IF NOT EXISTS activity_splits_metric (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  split INTEGER NOT NULL, -- Split number (1, 2, 3...)
  distance_meters REAL NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  elevation_difference REAL,
  average_speed REAL,
  pace_zone INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  UNIQUE(activity_id, split)
);

CREATE INDEX IF NOT EXISTS idx_splits_metric_activity ON activity_splits_metric(activity_id);

-- Table for best efforts (personal records)
CREATE TABLE IF NOT EXISTS activity_best_efforts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  strava_effort_id INTEGER NOT NULL, -- Strava's ID for this effort
  name TEXT NOT NULL, -- e.g., "400m", "1/2 mile", "1k"
  distance_meters REAL NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  start_date INTEGER NOT NULL, -- Unix timestamp
  pr_rank INTEGER, -- Personal record rank (1 = current PR)
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  UNIQUE(activity_id, strava_effort_id)
);

CREATE INDEX IF NOT EXISTS idx_best_efforts_activity ON activity_best_efforts(activity_id);
CREATE INDEX IF NOT EXISTS idx_best_efforts_pr ON activity_best_efforts(activity_id, pr_rank);

-- Table for segment efforts
CREATE TABLE IF NOT EXISTS activity_segment_efforts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  strava_effort_id INTEGER NOT NULL, -- Strava's ID for this effort
  segment_id INTEGER NOT NULL,
  segment_name TEXT NOT NULL,
  distance_meters REAL NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  start_date INTEGER NOT NULL, -- Unix timestamp
  average_heartrate REAL,
  max_heartrate REAL,
  average_cadence REAL,
  average_watts REAL,
  kom_rank INTEGER, -- King/Queen of Mountain rank
  pr_rank INTEGER, -- Personal record rank
  hidden INTEGER NOT NULL DEFAULT 0, -- Boolean: hidden from public
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  UNIQUE(activity_id, strava_effort_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_efforts_activity ON activity_segment_efforts(activity_id);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_segment ON activity_segment_efforts(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_pr ON activity_segment_efforts(activity_id, pr_rank);

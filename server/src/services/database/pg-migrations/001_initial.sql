-- Initial PostgreSQL schema for Zync
-- Consolidates all SQLite migrations (001-004) into a single PostgreSQL migration

-- Sync status table
CREATE TABLE IF NOT EXISTS sync_status (
  user_id BIGINT PRIMARY KEY,
  last_sync_at INTEGER NOT NULL,
  last_activity_id BIGINT,
  sync_state TEXT NOT NULL DEFAULT 'pending' CHECK(sync_state IN ('pending', 'syncing', 'completed', 'error')),
  total_activities INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  sync_started_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  updated_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
);

-- Activities table (includes location + detailed fields from migrations 002+004)
CREATE TABLE IF NOT EXISTS activities (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  distance_meters DOUBLE PRECISION NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  elevation_gain_meters DOUBLE PRECISION NOT NULL,
  start_date INTEGER NOT NULL,
  start_date_local TEXT NOT NULL,
  average_speed DOUBLE PRECISION NOT NULL,
  max_speed DOUBLE PRECISION NOT NULL,
  average_heartrate DOUBLE PRECISION,
  max_heartrate DOUBLE PRECISION,
  calories DOUBLE PRECISION,
  description TEXT,
  average_cadence DOUBLE PRECISION,
  average_watts DOUBLE PRECISION,
  kudos_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  summary_polyline TEXT,
  start_latlng TEXT,
  end_latlng TEXT,
  -- Location columns (from migration 002)
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lng DOUBLE PRECISION,
  geohash TEXT,
  -- Detailed activity fields (from migration 004)
  device_name TEXT,
  gear_id TEXT,
  max_watts DOUBLE PRECISION,
  weighted_average_watts DOUBLE PRECISION,
  kilojoules DOUBLE PRECISION,
  suffer_score DOUBLE PRECISION,
  elev_high DOUBLE PRECISION,
  elev_low DOUBLE PRECISION,
  photos_json TEXT,
  has_detailed_data BOOLEAN NOT NULL DEFAULT FALSE,
  -- Full-text search column
  search_vector TSVECTOR,
  created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  updated_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  FOREIGN KEY (user_id) REFERENCES sync_status(user_id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_type ON activities(user_id, type);
CREATE INDEX IF NOT EXISTS idx_activities_user_type_date ON activities(user_id, type, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_location ON activities(start_lat, start_lng);
CREATE INDEX IF NOT EXISTS idx_activities_geohash ON activities(geohash);
CREATE INDEX IF NOT EXISTS idx_activities_has_detailed ON activities(user_id, has_detailed_data);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_activities_search ON activities USING GIN(search_vector);

-- Function + trigger to keep search_vector in sync
CREATE OR REPLACE FUNCTION activities_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', COALESCE(NEW.name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activities_search_vector_trigger ON activities;
CREATE TRIGGER activities_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name ON activities
  FOR EACH ROW EXECUTE FUNCTION activities_search_vector_update();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := (EXTRACT(EPOCH FROM NOW())::INTEGER);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activities_updated_at ON activities;
CREATE TRIGGER activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS sync_status_updated_at ON sync_status;
CREATE TRIGGER sync_status_updated_at
  BEFORE UPDATE ON sync_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Activity laps
CREATE TABLE IF NOT EXISTS activity_laps (
  id SERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL,
  lap_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  distance_meters DOUBLE PRECISION NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  start_date INTEGER NOT NULL,
  total_elevation_gain DOUBLE PRECISION,
  average_speed DOUBLE PRECISION,
  max_speed DOUBLE PRECISION,
  average_heartrate DOUBLE PRECISION,
  max_heartrate DOUBLE PRECISION,
  average_cadence DOUBLE PRECISION,
  average_watts DOUBLE PRECISION,
  created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  UNIQUE(activity_id, lap_index)
);

CREATE INDEX IF NOT EXISTS idx_laps_activity ON activity_laps(activity_id);

-- Activity splits (metric / km-based)
CREATE TABLE IF NOT EXISTS activity_splits_metric (
  id SERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL,
  split INTEGER NOT NULL,
  distance_meters DOUBLE PRECISION NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  elevation_difference DOUBLE PRECISION,
  average_speed DOUBLE PRECISION,
  pace_zone INTEGER,
  created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  UNIQUE(activity_id, split)
);

CREATE INDEX IF NOT EXISTS idx_splits_metric_activity ON activity_splits_metric(activity_id);

-- Best efforts (personal records)
CREATE TABLE IF NOT EXISTS activity_best_efforts (
  id SERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL,
  strava_effort_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  distance_meters DOUBLE PRECISION NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  start_date INTEGER NOT NULL,
  pr_rank INTEGER,
  created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  UNIQUE(activity_id, strava_effort_id)
);

CREATE INDEX IF NOT EXISTS idx_best_efforts_activity ON activity_best_efforts(activity_id);
CREATE INDEX IF NOT EXISTS idx_best_efforts_pr ON activity_best_efforts(activity_id, pr_rank);

-- Segment efforts
CREATE TABLE IF NOT EXISTS activity_segment_efforts (
  id SERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL,
  strava_effort_id BIGINT NOT NULL,
  segment_id BIGINT NOT NULL,
  segment_name TEXT NOT NULL,
  distance_meters DOUBLE PRECISION NOT NULL,
  elapsed_time_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER NOT NULL,
  start_date INTEGER NOT NULL,
  average_heartrate DOUBLE PRECISION,
  max_heartrate DOUBLE PRECISION,
  average_cadence DOUBLE PRECISION,
  average_watts DOUBLE PRECISION,
  kom_rank INTEGER,
  pr_rank INTEGER,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  UNIQUE(activity_id, strava_effort_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_efforts_activity ON activity_segment_efforts(activity_id);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_segment ON activity_segment_efforts(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_pr ON activity_segment_efforts(activity_id, pr_rank);

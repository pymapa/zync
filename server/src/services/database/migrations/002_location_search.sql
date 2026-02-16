-- Add location search support
-- Separate lat/lng columns for bounding box queries
-- Geohash column for clustering and prefix-based area searches

-- Add new columns
ALTER TABLE activities ADD COLUMN start_lat REAL;
ALTER TABLE activities ADD COLUMN start_lng REAL;
ALTER TABLE activities ADD COLUMN end_lat REAL;
ALTER TABLE activities ADD COLUMN end_lng REAL;
ALTER TABLE activities ADD COLUMN geohash TEXT;

-- Indexes for location queries
CREATE INDEX IF NOT EXISTS idx_activities_location ON activities(start_lat, start_lng);
CREATE INDEX IF NOT EXISTS idx_activities_geohash ON activities(geohash);

-- Migrate existing data from JSON text to separate columns
UPDATE activities
SET
  start_lat = CAST(json_extract(start_latlng, '$[0]') AS REAL),
  start_lng = CAST(json_extract(start_latlng, '$[1]') AS REAL)
WHERE start_latlng IS NOT NULL AND start_latlng != '';

UPDATE activities
SET
  end_lat = CAST(json_extract(end_latlng, '$[0]') AS REAL),
  end_lng = CAST(json_extract(end_latlng, '$[1]') AS REAL)
WHERE end_latlng IS NOT NULL AND end_latlng != '';

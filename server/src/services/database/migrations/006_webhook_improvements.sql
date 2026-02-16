-- Webhook events improvements migration
-- Adds processing state, duplicate prevention, and better indexing

-- Step 1: Check if old table exists and migrate, or create new
-- We need to handle both fresh installs and upgrades

-- First, check if we need to migrate
-- If webhook_events doesn't exist yet, migrations 001-005 haven't run
-- This happens in new test environments

-- Create temporary flag table to track migration path
CREATE TEMP TABLE _migration_006_state (needs_migration INTEGER);

INSERT INTO _migration_006_state
SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END
FROM sqlite_master
WHERE type='table' AND name='webhook_events';

-- Create the new improved table structure
CREATE TABLE webhook_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL, -- Strava athlete ID
  object_type TEXT NOT NULL CHECK(object_type IN ('activity', 'athlete')),
  object_id INTEGER NOT NULL,
  aspect_type TEXT NOT NULL CHECK(aspect_type IN ('create', 'update', 'delete')),
  updates_json TEXT, -- JSON string of updates (for 'update' events)
  event_time INTEGER NOT NULL, -- Unix timestamp in seconds from Strava

  -- Processing state tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'processed', 'failed')),

  -- Retry tracking
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at INTEGER, -- Unix timestamp in seconds when last retry occurred

  -- Completion tracking
  processed_at INTEGER, -- Unix timestamp in seconds when event was successfully processed
  error_message TEXT, -- Error message if processing failed

  -- Timestamps (using consistent time source)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  -- Unique constraint to prevent duplicate events
  -- Strava may send the same event multiple times, especially during failures
  UNIQUE(subscription_id, object_id, aspect_type, event_time)
);

-- Migrate data if old table exists, deduplicating on the new UNIQUE constraint.
-- The old table has no such constraint so duplicates may exist.
-- Per group we keep: processed rows first, then the newest id.
INSERT INTO webhook_events_new (
  id,
  subscription_id,
  owner_id,
  object_type,
  object_id,
  aspect_type,
  updates_json,
  event_time,
  status,
  retry_count,
  last_retry_at,
  processed_at,
  error_message,
  created_at,
  updated_at
)
SELECT
  id,
  subscription_id,
  owner_id,
  object_type,
  object_id,
  aspect_type,
  updates_json,
  event_time,
  CASE
    WHEN processed = 1 AND error_message IS NULL THEN 'processed'
    WHEN processed = 1 AND error_message IS NOT NULL THEN 'failed'
    ELSE 'pending'
  END as status,
  0 as retry_count,
  NULL as last_retry_at,
  processed_at,
  error_message,
  created_at,
  created_at as updated_at
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY subscription_id, object_id, aspect_type, event_time
      ORDER BY processed DESC, id DESC
    ) as _rn
  FROM webhook_events
)
WHERE _rn = 1
  AND (SELECT needs_migration FROM _migration_006_state) = 1;

-- Drop old table if it exists
DROP TABLE IF EXISTS webhook_events;

-- Rename new table to final name
ALTER TABLE webhook_events_new RENAME TO webhook_events;

-- Create optimized indexes

-- Partial index for pending events only (high selectivity)
-- This is the primary query pattern for workers
CREATE INDEX idx_webhook_events_pending
  ON webhook_events(created_at)
  WHERE status = 'pending';

-- Index for finding events by owner and object (for activity lookup)
CREATE INDEX idx_webhook_events_owner_object
  ON webhook_events(owner_id, object_type, object_id);

-- Index for finding events by subscription
CREATE INDEX idx_webhook_events_subscription
  ON webhook_events(subscription_id);

-- Index for cleanup queries (finding old processed/failed events)
CREATE INDEX idx_webhook_events_cleanup
  ON webhook_events(status, created_at)
  WHERE status IN ('processed', 'failed');

-- Index for monitoring failed events that need manual intervention
CREATE INDEX idx_webhook_events_failed
  ON webhook_events(status, retry_count, created_at)
  WHERE status = 'failed';

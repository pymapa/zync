-- Webhook events migration
-- Creates table to store incoming webhook events from Strava

CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL, -- Strava athlete ID
  object_type TEXT NOT NULL CHECK(object_type IN ('activity', 'athlete')),
  object_id INTEGER NOT NULL,
  aspect_type TEXT NOT NULL CHECK(aspect_type IN ('create', 'update', 'delete')),
  updates_json TEXT, -- JSON string of updates (for 'update' events)
  event_time INTEGER NOT NULL, -- Unix timestamp in seconds from Strava
  processed BOOLEAN NOT NULL DEFAULT 0,
  processed_at INTEGER, -- Unix timestamp in seconds when event was processed
  error_message TEXT, -- Error message if processing failed
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Index for finding unprocessed events
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, created_at);

-- Index for finding events by owner and object
CREATE INDEX IF NOT EXISTS idx_webhook_events_owner_object ON webhook_events(owner_id, object_type, object_id);

-- Index for finding events by subscription
CREATE INDEX IF NOT EXISTS idx_webhook_events_subscription ON webhook_events(subscription_id);

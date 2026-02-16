-- Add error_message column to sync_status for better error reporting
-- Add sync_started_at to track sync duration and enable timeout detection

ALTER TABLE sync_status ADD COLUMN error_message TEXT;
ALTER TABLE sync_status ADD COLUMN sync_started_at INTEGER;

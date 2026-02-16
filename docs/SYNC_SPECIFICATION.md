# Sync System Specification

**Version:** 1.0
**Last Updated:** 2026-01-22
**Target Audience:** Testing Engineers, Backend Developers

---

## 1. Overview

The Zync sync system synchronizes Strava activities from the Strava API into a local SQLite database. This enables:

- Fast, offline-first activity browsing
- Full-text search across activities
- Location-based queries using geohashes
- Reduced API calls to Strava (respecting rate limits)
- Detailed activity caching (laps, splits, segment efforts)

### Key Design Principles

1. **Idempotent**: Sync can be run multiple times safely; duplicate activities are upserted
2. **Resumable**: If sync fails mid-process, partial progress is saved
3. **Concurrent-safe**: Atomic locks prevent simultaneous syncs for the same user
4. **Rate-limit aware**: Built-in delays between API pages (1s default)
5. **DB-first fallback**: Activity details are cached locally to minimize Strava API calls

---

## 2. Sync Flow

### 2.1 State Machine

The sync process follows a strict state transition model stored in the `sync_status` table:

```
pending → syncing → completed
                  ↘ error
```

**State Definitions:**

- **pending**: Initial state; ready to start sync
- **syncing**: Sync is actively running (lock acquired)
- **completed**: Sync finished successfully
- **error**: Sync encountered a fatal error

### 2.2 Detailed Sync Process

#### Phase 1: Lock Acquisition

```
1. User triggers POST /api/sync
2. Controller calls tryAcquireSyncLock(userId, 10min timeout)
3. Database atomically checks:
   - If no sync_status exists → create with 'pending' state, return true
   - If syncState == 'syncing':
     - Check if sync_started_at > 10 minutes ago
       - YES → Reset to 'error' state, return true (lock acquired)
       - NO → Return false (sync in progress)
   - If syncState in ('pending', 'completed', 'error') → return true
4. If lock NOT acquired → Return 409 Conflict
5. If lock acquired → Start async sync, return 202 Accepted
```

#### Phase 2: Activity Pagination

```
1. Initialize StravaClient with user's access token
2. Set syncState = 'syncing', syncStartedAt = now (ONLY after first successful API call)
3. Loop through pages (default: max 100 pages):
   a. Fetch activities: GET /athlete/activities?page={N}&per_page=200
   b. If page 1 and fetch fails → Don't update state to 'syncing' (prevent stuck state)
   c. Map Strava activities to ActivityInput format
   d. Upsert batch to database (ON CONFLICT updates existing)
   e. Update sync_status with:
      - lastActivityId (most recent activity ID)
      - totalActivities (count from DB)
   f. If fetched count < pageSize → No more pages, break loop
   g. Sleep 1000ms (rate limiting)
4. Set syncState = 'completed', lastSyncAt = now, syncStartedAt = null
```

#### Phase 3: Error Handling

```
If ANY exception occurs:
1. Set syncState = 'error'
2. Set errorMessage = error.message
3. Clear syncStartedAt (release lock)
4. Log error with context
5. Throw AppError for client response
```

### 2.3 Activity Storage

Activities are stored with **upsert semantics**:

- **Primary Key**: `activities.id` (Strava activity ID)
- **Conflict Resolution**: `ON CONFLICT(id) DO UPDATE SET ...`
- **Fields Updated**: All fields except `id`, `user_id`, timestamps
- **Geohash Computation**: Automatically computed from `start_latlng` at precision 7 (~153m)

---

## 3. API Endpoints

### 3.1 POST /api/sync

**Description**: Trigger asynchronous activity sync from Strava.

**Authentication**: Required (session-based)
**Rate Limiting**: User-scoped (prevents abuse)

**Request Body** (optional):
```json
{
  "pageSize": 200,    // 1-200, default: 200
  "maxPages": 100     // 1-500, default: 100
}
```

**Response Codes:**
- **202 Accepted**: Sync started successfully
- **409 Conflict**: Sync already in progress
- **400 Bad Request**: Invalid request body
- **401 Unauthorized**: Not authenticated

**Success Response (202)**:
```json
{
  "message": "Sync started successfully. Use GET /api/sync/status to check progress.",
  "syncStarted": true,
  "userId": 12345,
  "estimatedTimeSeconds": 30
}
```

**Conflict Response (409)**:
```json
{
  "message": "Sync already in progress. Please wait for it to complete.",
  "syncStarted": false,
  "userId": 12345,
  "syncStatus": {
    "syncState": "syncing",
    "syncStartedAt": 1737547200,
    "totalActivities": 150
  }
}
```

---

### 3.2 GET /api/sync/status

**Description**: Get current sync status for authenticated user.

**Authentication**: Required
**Rate Limiting**: User-scoped

**Response (200 OK)**:
```json
{
  "userId": 12345,
  "syncStatus": {
    "lastSyncAt": 1737547800,
    "lastActivityId": 987654321,
    "syncState": "completed",
    "totalActivities": 542,
    "errorMessage": null,
    "syncStartedAt": null,
    "createdAt": 1737540000,
    "updatedAt": 1737547800
  },
  "hasNeverSynced": false
}
```

**Field Descriptions:**
- `lastSyncAt`: Unix timestamp (seconds) of last successful sync
- `lastActivityId`: Most recent activity ID processed
- `syncState`: Current state (`pending`|`syncing`|`completed`|`error`)
- `totalActivities`: Total activity count in database
- `errorMessage`: Error details if `syncState == 'error'`, otherwise `null`
- `syncStartedAt`: When current sync started (null if not syncing)

---

### 3.3 POST /api/sync/reset

**Description**: Reset a stuck sync that has exceeded the timeout.

**Authentication**: Required
**Rate Limiting**: User-scoped

**Response Codes:**
- **200 OK**: Reset successful or no stuck sync found
- **409 Conflict**: Sync is active but hasn't timed out yet

**Success Response (200)** - Reset occurred:
```json
{
  "message": "Sync has been reset. You can now start a new sync.",
  "wasReset": true,
  "userId": 12345
}
```

**Success Response (200)** - No stuck sync:
```json
{
  "message": "No stuck sync found to reset.",
  "wasReset": false,
  "userId": 12345
}
```

**Conflict Response (409)** - Sync still active:
```json
{
  "message": "Sync is still in progress and has not timed out. Please wait.",
  "wasReset": false,
  "userId": 12345,
  "syncStatus": {
    "syncState": "syncing",
    "syncStartedAt": 1737547500
  }
}
```

---

## 4. Concurrency Control

### 4.1 Atomic Lock Acquisition

**Function**: `tryAcquireSyncLock(userId: number, timeoutMs: number = 600000): boolean`

**Implementation Details:**

```sql
-- Executed within a SQLite transaction for atomicity
BEGIN TRANSACTION;

-- Check current sync status
SELECT sync_state, sync_started_at FROM sync_status WHERE user_id = ?;

-- Decision logic:
-- 1. No record → Create with 'pending' state → ACQUIRE LOCK (return true)
-- 2. syncState == 'syncing' AND (now - sync_started_at) > timeout:
--    UPDATE SET sync_state = 'error', error_message = 'Sync timed out', sync_started_at = NULL
--    → ACQUIRE LOCK (return true)
-- 3. syncState == 'syncing' AND NOT timed out → REJECT (return false)
-- 4. syncState in ('pending', 'completed', 'error') → ACQUIRE LOCK (return true)

COMMIT;
```

**Key Properties:**

- **Atomic**: Transaction ensures no race conditions (TOCTOU prevention)
- **Timeout-aware**: Automatically resets stuck syncs that exceed 10 minutes
- **Idempotent**: Safe to call multiple times

### 4.2 Timeout Mechanism

**Default Timeout**: 10 minutes (600,000 ms)

**Rationale:**
- Average sync time: 30-60 seconds for typical users
- 10 minutes allows for:
  - Large activity counts (20,000+ activities)
  - Slow network connections
  - Strava API rate limit delays

**Timeout Behavior:**

When a sync exceeds the timeout:
1. `tryAcquireSyncLock()` detects the timeout
2. Automatically resets state to `'error'`
3. Sets `errorMessage = 'Sync timed out'`
4. Clears `syncStartedAt` (releases lock)
5. Returns `true` (lock acquired for new sync)

### 4.3 Stuck Sync Recovery

**Manual Reset Function**: `resetStuckSync(userId: number, timeoutMs?: number): boolean`

**Use Case**: Admin or user wants to manually reset a sync without waiting for automatic timeout.

**SQL Logic**:
```sql
UPDATE sync_status
SET sync_state = 'error',
    error_message = 'Sync timed out after inactivity',
    sync_started_at = NULL
WHERE user_id = ?
  AND sync_state = 'syncing'
  AND sync_started_at IS NOT NULL
  AND sync_started_at < (current_timestamp - timeout_seconds);
```

**Return Value**: `true` if a row was updated, `false` if no stuck sync found.

---

## 5. Error Handling

### 5.1 Error States

| Error Scenario | State Transition | errorMessage | syncStartedAt |
|---------------|------------------|--------------|---------------|
| Strava API fails on page 1 | No change (stays 'pending') | Not set | Not set |
| Strava API fails on page 2+ | → 'error' | API error message | Cleared (null) |
| Network timeout | → 'error' | "Network timeout" | Cleared (null) |
| Database error | → 'error' | Database error | Cleared (null) |
| Sync timeout (10min) | → 'error' | "Sync timed out" | Cleared (null) |

### 5.2 Partial Sync Handling

**Behavior**: If sync fails mid-process (e.g., page 5 of 20), all activities from pages 1-4 remain in the database.

**Resume Strategy**:
1. Check `lastActivityId` in `sync_status`
2. Next sync will upsert activities (duplicates updated, new ones inserted)
3. No manual intervention required

### 5.3 Recovery Mechanisms

#### Automatic Recovery

1. **Timeout Reset**: After 10 minutes, `tryAcquireSyncLock()` auto-resets
2. **Upsert Semantics**: Re-syncing doesn't create duplicates
3. **Idempotent Sync**: Running sync multiple times is safe

#### Manual Recovery

1. **POST /api/sync/reset**: Users can manually reset stuck syncs
2. **Database Cleanup**: Admins can directly update `sync_status` table
3. **Activity Deletion**: `DELETE FROM activities WHERE user_id = ?` (if needed)

---

## 6. Activity Details Caching

### 6.1 DB-First, Strava-Fallback Pattern

**Strategy**: Minimize Strava API calls by caching detailed activity data locally.

**Implementation** (`server/src/services/activities/index.ts`):

```
GET /api/activities/:id Flow:
1. Check local database for activity
2. If found AND hasDetailedData == true:
   → Return from DB (includes laps, splits)
3. If NOT found OR hasDetailedData == false:
   → Fetch from Strava API
   → Store detailed data in DB with hasDetailedData = true
   → Return to client
```

### 6.2 hasDetailedData Flag

**Purpose**: Indicates whether an activity has complete detailed data cached.

**Set to TRUE when**:
- Activity fetched via GET /api/activities/:id (detailed endpoint)
- Activity includes laps, splits, segment efforts, best efforts

**Set to FALSE when**:
- Activity fetched via sync (list endpoint - minimal data)
- Activity created but detailed fetch hasn't occurred

**Database Schema**:
```sql
CREATE TABLE activities (
  ...
  has_detailed_data INTEGER NOT NULL DEFAULT 0 CHECK(has_detailed_data IN (0, 1)),
  ...
);
```

### 6.3 Detailed Data Storage

**Tables Used**:

1. **activities**: Base activity data + `hasDetailedData` flag
2. **activity_laps**: Lap-by-lap breakdown
3. **activity_splits_metric**: Kilometer/mile splits
4. **activity_best_efforts**: Best efforts (e.g., 5K, 10K PRs)
5. **activity_segment_efforts**: Strava segment efforts

**Upsert Strategy**:
```typescript
upsertDetailedActivity(data: DetailedActivityData) {
  BEGIN TRANSACTION;

  // 1. Upsert main activity with hasDetailedData = true
  UPSERT INTO activities (...);

  // 2. Delete existing detailed data
  DELETE FROM activity_laps WHERE activity_id = ?;
  DELETE FROM activity_splits_metric WHERE activity_id = ?;
  DELETE FROM activity_best_efforts WHERE activity_id = ?;
  DELETE FROM activity_segment_efforts WHERE activity_id = ?;

  // 3. Insert new detailed data
  INSERT INTO activity_laps (...);
  INSERT INTO activity_splits_metric (...);
  INSERT INTO activity_best_efforts (...);
  INSERT INTO activity_segment_efforts (...);

  COMMIT;
}
```

### 6.4 Cache Invalidation

**Memory Cache** (LRUCache):
- TTL: 600 seconds (10 minutes)
- Eviction: LRU policy when capacity reached
- Scope: Per-user (keys prefixed with `userId`)

**Database Cache**:
- **No automatic expiration** (activities don't change often)
- **Manual invalidation**: Delete activity row to force re-fetch
- **Update detection**: Future enhancement (webhook-based)

---

## 7. Test Scenarios

### 7.1 Happy Path Tests

#### Test 1: First-time Sync
```
GIVEN: New user with no sync_status record
WHEN: POST /api/sync
THEN:
  - Response: 202 Accepted
  - sync_status created with syncState = 'syncing'
  - Activities fetched from Strava and stored
  - Final state: syncState = 'completed'
  - totalActivities > 0
```

#### Test 2: Incremental Sync
```
GIVEN: User with existing activities (totalActivities = 100)
WHEN: User creates new activity on Strava
  AND: POST /api/sync
THEN:
  - New activity appears in database
  - totalActivities = 101
  - Existing activities unchanged (upsert doesn't duplicate)
```

#### Test 3: Status Polling
```
GIVEN: Sync in progress (syncState = 'syncing')
WHEN: GET /api/sync/status (poll every 2 seconds)
THEN:
  - syncState transitions: 'syncing' → 'completed'
  - syncStartedAt becomes null when completed
  - lastSyncAt updated to completion time
```

#### Test 4: Activity Detail Fetch
```
GIVEN: Activity synced via list endpoint (hasDetailedData = false)
WHEN: GET /api/activities/:id
THEN:
  - Activity fetched from Strava (not DB)
  - Detailed data stored in DB
  - hasDetailedData = true
  - Subsequent fetch returns from DB (not Strava)
```

---

### 7.2 Error Scenarios

#### Test 5: Strava API Failure (Page 1)
```
GIVEN: Valid user session
WHEN: POST /api/sync
  AND: Strava API returns 500 error on page 1
THEN:
  - syncState remains 'pending' (not stuck in 'syncing')
  - Response: 500 Internal Server Error
  - errorMessage NOT set in sync_status
```

#### Test 6: Strava API Failure (Page 5)
```
GIVEN: Sync processing page 5 of 20
WHEN: Strava API returns network timeout
THEN:
  - syncState → 'error'
  - errorMessage = timeout error message
  - Activities from pages 1-4 remain in database
  - syncStartedAt cleared (lock released)
```

#### Test 7: Invalid Access Token
```
GIVEN: User session with expired access token
WHEN: POST /api/sync
THEN:
  - Response: 401 Unauthorized (from Strava)
  - syncState → 'error'
  - errorMessage = "Invalid access token" or similar
```

#### Test 8: Database Write Failure
```
GIVEN: SQLite database reaches disk quota
WHEN: Sync attempts to upsert activities
THEN:
  - syncState → 'error'
  - errorMessage = database error
  - syncStartedAt cleared
  - Partial activities may be written (depends on transaction point)
```

---

### 7.3 Edge Cases

#### Test 9: Empty Activity List
```
GIVEN: New Strava user with 0 activities
WHEN: POST /api/sync
THEN:
  - syncState → 'completed'
  - totalActivities = 0
  - No errors
```

#### Test 10: Exactly pageSize Activities (200)
```
GIVEN: User has exactly 200 activities
WHEN: POST /api/sync with pageSize = 200
THEN:
  - Fetches page 1 (200 activities)
  - Attempts page 2 (0 activities)
  - Stops pagination correctly
  - totalActivities = 200
```

#### Test 11: Max Pages Reached
```
GIVEN: User has 25,000 activities
WHEN: POST /api/sync with maxPages = 100
THEN:
  - Fetches 100 pages (20,000 activities)
  - syncState → 'completed'
  - status = 'partial' (indicated in SyncResult)
  - Remaining 5,000 activities not synced
```

#### Test 12: Activity Updated on Strava
```
GIVEN: Activity ID 123 exists in DB (name = "Morning Run")
WHEN: User edits activity on Strava (name = "Awesome Morning Run")
  AND: POST /api/sync
THEN:
  - Activity 123 updated in DB (ON CONFLICT DO UPDATE)
  - name = "Awesome Morning Run"
  - No duplicate created
```

---

### 7.4 Concurrency Tests

#### Test 13: Duplicate Sync Request
```
GIVEN: Sync in progress (syncState = 'syncing')
WHEN: POST /api/sync (second request)
THEN:
  - Response: 409 Conflict
  - syncStarted = false
  - First sync continues uninterrupted
```

#### Test 14: Sync Timeout
```
GIVEN: Sync started 11 minutes ago (exceeded 10min timeout)
WHEN: POST /api/sync (new request)
THEN:
  - tryAcquireSyncLock() detects timeout
  - Old sync reset to 'error' state
  - New sync acquires lock and starts
  - Response: 202 Accepted
```

#### Test 15: Manual Reset During Active Sync
```
GIVEN: Sync started 2 minutes ago (active, not timed out)
WHEN: POST /api/sync/reset
THEN:
  - Response: 409 Conflict
  - wasReset = false
  - Message: "Sync is still in progress and has not timed out"
```

#### Test 16: Manual Reset of Stuck Sync
```
GIVEN: Sync started 12 minutes ago (timed out)
WHEN: POST /api/sync/reset
THEN:
  - Response: 200 OK
  - wasReset = true
  - syncState → 'error'
  - syncStartedAt = null
```

#### Test 17: Race Condition on Lock Acquisition
```
GIVEN: Two concurrent POST /api/sync requests (within 10ms)
WHEN: Both hit tryAcquireSyncLock() simultaneously
THEN:
  - SQLite transaction ensures atomicity
  - One request acquires lock (202 Accepted)
  - Other request rejected (409 Conflict)
  - No duplicate syncs occur
```

---

### 7.5 Data Integrity Tests

#### Test 18: Geohash Computation
```
GIVEN: Activity with start_latlng = [40.7128, -74.0060] (New York)
WHEN: Activity synced
THEN:
  - geohash computed at precision 7
  - geohash stored in activities table
  - Can query activities by geohashPrefix
```

#### Test 19: Null Location Handling
```
GIVEN: Indoor activity (start_latlng = null)
WHEN: Activity synced
THEN:
  - start_lat, start_lng, geohash all = null
  - No errors during upsert
```

#### Test 20: Unicode in Activity Names
```
GIVEN: Activity name = "🏃 Morning Run - 日本"
WHEN: Activity synced
THEN:
  - Name stored correctly in SQLite (UTF-8)
  - Full-text search works with unicode
```

---

## 8. Future Enhancements

### 8.1 Planned Features

1. **Webhook-based Sync**
   - Listen to Strava webhooks for real-time activity updates
   - Eliminate need for full re-syncs
   - Reduce API calls to Strava

2. **Selective Sync**
   - Sync only activities after a certain date
   - Sync specific activity types (e.g., only runs)
   - User-configurable sync filters

3. **Sync Progress Streaming**
   - WebSocket/SSE for real-time progress updates
   - Show current page, activities processed in UI
   - Eliminate need for polling GET /api/sync/status

4. **Automatic Stuck Sync Detection**
   - Background job to reset syncs exceeding timeout
   - Admin dashboard for stuck sync monitoring

5. **Detailed Data Pre-caching**
   - Option to fetch detailed data during initial sync
   - Trade-off: slower sync, but faster activity detail views

### 8.2 Performance Optimizations

1. **Bulk Insert Optimization**
   - Use `INSERT INTO ... VALUES (...), (...), (...)` for batch inserts
   - Reduce transaction overhead

2. **Incremental Sync by Timestamp**
   - Track `lastSyncAt` and only fetch activities after that timestamp
   - Requires Strava API `after` parameter

3. **Parallel Page Fetching**
   - Fetch multiple pages concurrently (with rate limit awareness)
   - Requires careful rate limit management

### 8.3 Monitoring and Observability

1. **Metrics to Track**
   - Average sync duration per user
   - Sync failure rate
   - Stuck sync frequency
   - Strava API rate limit consumption

2. **Alerts**
   - Sync failure rate > 10%
   - Average sync duration > 5 minutes
   - Stuck syncs > 5 per hour

3. **Logging Enhancements**
   - Structured logs with correlation IDs
   - Request tracing across sync lifecycle

---

## Appendix A: Database Schema

### sync_status Table
```sql
CREATE TABLE sync_status (
  user_id INTEGER PRIMARY KEY,
  last_sync_at INTEGER NOT NULL,
  last_activity_id INTEGER,
  sync_state TEXT NOT NULL CHECK(sync_state IN ('pending', 'syncing', 'completed', 'error')),
  total_activities INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  sync_started_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### activities Table (Relevant Fields)
```sql
CREATE TABLE activities (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  -- ... (50+ fields)
  has_detailed_data INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_activities_user_start ON activities(user_id, start_date DESC);
CREATE INDEX idx_activities_geohash ON activities(geohash);
```

---

## Appendix B: Rate Limit Considerations

**Strava API Limits**:
- 100 requests per 15 minutes
- 1,000 requests per day

**Sync Impact**:
- Default sync: 1 request per page (200 activities/page)
- 100 pages = 100 requests (hits 15-min limit)
- Built-in 1-second delay between pages

**Mitigation Strategies**:
1. Default maxPages = 100 (prevents runaway syncs)
2. 1-second delay between pages (spreads requests over time)
3. User-scoped rate limiting on endpoints
4. Future: Track API usage in database, pause sync if nearing limits

---

## Appendix C: Key File Locations

| Component | File Path |
|-----------|-----------|
| Sync Service | `/server/src/services/sync/index.ts` |
| Sync Controller | `/server/src/controllers/sync.controller.ts` |
| Database Layer | `/server/src/services/database/sqlite.ts` |
| Sync Routes | `/server/src/routes/sync.routes.ts` |
| Activities Service | `/server/src/services/activities/index.ts` |
| Database Types | `/server/src/services/database/types.ts` |

---

**End of Specification**

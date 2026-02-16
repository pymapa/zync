# Database Service Layer

## Quick Start

```typescript
import { db } from './database';
import { transformDetailedActivity } from './database/transformers';
import type { StravaDetailedActivity } from './strava/types';

// Store detailed activity from Strava
async function storeActivityDetails(
  stravaActivity: StravaDetailedActivity,
  userId: number
) {
  const data = transformDetailedActivity(stravaActivity, userId);
  db.upsertDetailedActivity(data);
}

// Retrieve complete activity data
function getCompleteActivity(activityId: number, userId: number) {
  const activity = db.getActivityById(activityId, userId);

  if (!activity) return null;

  if (activity.hasDetailedData) {
    return {
      activity,
      laps: db.getActivityLaps(activityId),
      splits: db.getActivitySplitsMetric(activityId),
      bestEfforts: db.getActivityBestEfforts(activityId),
      segments: db.getActivitySegmentEfforts(activityId),
    };
  }

  return { activity };
}
```

## API Reference

### Transformers

#### `transformSummaryActivity(stravaActivity, userId): ActivityInput`
Converts Strava list endpoint activity to database format.
- **Use when**: Processing activities from `GET /athlete/activities`
- **Sets**: `hasDetailedData = false`

#### `transformDetailedActivity(stravaActivity, userId): DetailedActivityData`
Converts Strava detail endpoint activity to database format with all nested data.
- **Use when**: Processing activity from `GET /activities/{id}`
- **Sets**: `hasDetailedData = true`
- **Returns**: Activity + laps + splits + efforts

### Database Operations

#### `db.upsertActivity(activity: ActivityInput): void`
Inserts or updates a single activity.
- **Atomic**: Yes
- **Updates**: Overwrites existing activity with same ID
- **Detailed data**: Only if `hasDetailedData = true` in input

#### `db.upsertDetailedActivity(data: DetailedActivityData): void`
Atomically stores activity and all related detailed data.
- **Atomic**: Yes (transaction)
- **Cleanup**: Deletes existing laps/splits/efforts before insert
- **Use when**: Storing full activity details from Strava detail endpoint

#### `db.getActivityById(activityId, userId): StoredActivity | null`
Retrieves activity by ID.
- **Returns**: `null` if not found or wrong user
- **Check**: `activity.hasDetailedData` to know if details are available

#### `db.getActivityLaps(activityId): StoredActivityLap[]`
Retrieves all laps for an activity, ordered by lap index.

#### `db.getActivitySplitsMetric(activityId): StoredActivitySplitMetric[]`
Retrieves metric (km-based) splits, ordered by split number.

#### `db.getActivityBestEfforts(activityId): StoredActivityBestEffort[]`
Retrieves best efforts (PRs), ordered by distance.

#### `db.getActivitySegmentEfforts(activityId): StoredActivitySegmentEffort[]`
Retrieves segment efforts, ordered by start time.

#### `db.deleteActivityDetails(activityId): void`
Deletes all detailed data (laps, splits, efforts) for an activity.
- **Does NOT delete**: Main activity record
- **Use when**: Cleaning up or before re-fetching details

## Type Safety

### Import Types

```typescript
// Database types (storage layer)
import type {
  StoredActivity,
  ActivityInput,
  DetailedActivityData,
  StoredActivityLap,
  // ...
} from './database/types';

// Strava API types (external)
import type {
  StravaActivity,
  StravaDetailedActivity,
  // ...
} from './strava/types';
```

### Key Differences

| Strava API | Database | Notes |
|------------|----------|-------|
| `distance` | `distanceMeters` | Explicit unit in name |
| `moving_time` | `movingTimeSeconds` | Explicit unit in name |
| `start_date` | `startDate` | ISO string → Unix timestamp |
| `start_latlng` | `startLat`, `startLng` | Array → separate fields |
| `snake_case` | `camelCase` | External vs internal convention |

## Common Patterns

### Pattern 1: Sync Activities from List Endpoint

```typescript
import { getActivities } from './strava/activities';
import { transformSummaryActivities } from './database/transformers';

const stravaActivities = await getActivities(client, { page: 1, perPage: 30 });
const dbActivities = transformSummaryActivities(stravaActivities, userId);
db.upsertActivities(dbActivities);
```

### Pattern 2: Fetch and Store Activity Details

```typescript
import { getActivityById } from './strava/activities';
import { transformDetailedActivity } from './database/transformers';

const stravaActivity = await getActivityById(client, activityId);
const detailedData = transformDetailedActivity(stravaActivity, userId);
db.upsertDetailedActivity(detailedData);
```

### Pattern 3: Check if Details Need Fetching

```typescript
const activity = db.getActivityById(activityId, userId);

if (!activity) {
  // Activity doesn't exist, fetch from Strava
  const stravaActivity = await getActivityById(client, activityId);
  const data = transformDetailedActivity(stravaActivity, userId);
  db.upsertDetailedActivity(data);
} else if (!activity.hasDetailedData) {
  // Activity exists but no details, fetch details only
  const stravaActivity = await getActivityById(client, activityId);
  const data = transformDetailedActivity(stravaActivity, userId);
  db.upsertDetailedActivity(data);
} else {
  // Details already stored, use cached data
  return getCompleteActivity(activityId, userId);
}
```

### Pattern 4: Serialize for API Response

```typescript
function serializeActivity(activity: StoredActivity) {
  return {
    id: activity.id,
    name: activity.name,
    type: activity.type,
    distanceMeters: activity.distanceMeters,
    movingTimeSeconds: activity.movingTimeSeconds,
    // ... map other fields
    photos: activity.photosJson ? JSON.parse(activity.photosJson) : null,
  };
}
```

## Data Validation

### Before Insert

```typescript
// Validate required fields exist
function validateActivityInput(activity: ActivityInput): void {
  if (!activity.id || activity.id <= 0) {
    throw new Error('Invalid activity ID');
  }
  if (!activity.userId || activity.userId <= 0) {
    throw new Error('Invalid user ID');
  }
  // ... other validations
}
```

### Date Conversion

```typescript
// Always convert ISO dates to Unix seconds
import { isoToUnixSeconds } from './database/transformers';

const timestamp = isoToUnixSeconds('2024-01-15T10:30:00Z');
// → 1705318200
```

## Performance Tips

1. **Batch inserts**: Use `upsertActivities()` for multiple activities
2. **Check before fetch**: Use `hasDetailedData` flag to avoid redundant API calls
3. **Lazy load details**: Only fetch laps/splits when user requests them
4. **Cache queries**: Store query results if used repeatedly

## Error Handling

```typescript
try {
  db.upsertDetailedActivity(data);
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT') {
    // Foreign key violation or unique constraint
    logger.error('Failed to store activity', { activityId, error });
  } else {
    throw error;
  }
}
```

## Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './database';

describe('Activity Storage', () => {
  beforeEach(() => {
    // Clean up test data
    db.deleteUserActivities(testUserId);
  });

  it('stores detailed activity atomically', () => {
    const data = transformDetailedActivity(mockStravaActivity, testUserId);
    db.upsertDetailedActivity(data);

    const stored = db.getActivityById(mockStravaActivity.id, testUserId);
    expect(stored?.hasDetailedData).toBe(true);

    const laps = db.getActivityLaps(mockStravaActivity.id);
    expect(laps).toHaveLength(mockStravaActivity.laps.length);
  });
});
```

## Migration Notes

- Migration `004_detailed_activities.sql` adds all new schema
- Run migrations automatically on `db.init()`
- Backward compatible with existing activities
- No data loss on migration

## See Also

- [Full implementation details](../../DETAILED_ACTIVITY_STORAGE.md)
- [Database types](./types.ts)
- [Transformers](./transformers.ts)
- [SQLite implementation](./sqlite.ts)

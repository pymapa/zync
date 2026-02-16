# Webhook Event Processor

The webhook event processor is a background worker that processes webhook events from Strava. It continuously polls the database for unprocessed webhook events and handles them appropriately.

## Features

- **Automatic polling**: Continuously checks for new webhook events at configurable intervals
- **Rate limit handling**: Respects Strava's API rate limits (200 requests per 15 minutes, 2000 per day)
- **Token refresh**: Automatically refreshes expired access tokens
- **Retry logic**: Retries failed events with exponential backoff
- **Graceful shutdown**: Cleanly stops processing and finishes current work before shutting down
- **Monitoring**: Exposes statistics and rate limit information via health endpoint

## Architecture

### Components

1. **WebhookProcessor**: Main worker class that orchestrates event processing
2. **TokenManager**: Manages Strava access tokens with automatic refresh
3. **Database**: Stores and retrieves webhook events
4. **SessionStore**: Provides access to user tokens

### Event Types

The processor handles three types of webhook events:

#### Activity Events

- **create**: New activity created on Strava
  - Fetches full activity details from Strava API
  - Stores activity in database with all nested data (laps, splits, efforts)

- **update**: Activity modified on Strava
  - Fetches updated activity details
  - Updates existing activity record

- **delete**: Activity deleted on Strava
  - Removes activity and all related data from database

#### Athlete Events

- **deauthorization**: Athlete revoked access
  - Destroys all user sessions
  - Deletes sync status and all activities

## Configuration

The webhook processor accepts the following configuration:

```typescript
{
  database: IDatabase,              // Database instance
  sessionStore: SessionStore,       // Session store for token access
  pollIntervalMs: 5000,            // How often to poll (milliseconds)
  batchSize: 10,                   // Max events to process per batch
  maxRetries: 3,                   // Max retry attempts for failed events
  processingTimeoutSeconds: 300    // Timeout for stuck events (seconds)
}
```

## Running the Worker

### Integrated Mode (Default)

The webhook processor runs automatically when you start the main server:

```bash
npm run dev
```

The worker starts after the HTTP server is listening and stops gracefully on shutdown.

### Standalone Mode

For production deployments with dedicated worker processes:

```bash
npm run build
node dist/workers/index.js
```

This runs the worker independently of the web server, allowing you to:
- Scale workers independently
- Deploy workers on separate infrastructure
- Run multiple worker instances for high throughput

## Rate Limiting

The processor implements Strava's rate limits:

- **15-minute limit**: 200 requests per 15 minutes
- **Daily limit**: 2000 requests per day

When rate limits are reached:
1. Worker pauses processing
2. Waits until the rate limit window resets
3. Resumes processing automatically

Rate limit state is tracked in memory and resets appropriately.

## Error Handling

### Transient Errors

Errors that may resolve on retry:
- Network timeouts
- Strava API 5xx errors
- Rate limit errors

**Action**: Event is marked for retry (up to `maxRetries`)

### Permanent Errors

Errors that won't resolve with retry:
- Invalid tokens (401, 403)
- Resource not found (404)
- Missing user session

**Action**: Event is marked as failed with error message

### Stuck Events

Events stuck in "processing" state (worker crashed):
- Automatically reset on worker startup
- Configurable timeout via `processingTimeoutSeconds`

## Monitoring

### Health Endpoint

Check webhook processor status:

```bash
GET /api/health/webhook-processor
```

Response:
```json
{
  "status": "running",
  "statistics": {
    "eventsProcessed": 150,
    "eventsFailed": 5,
    "apiCallsMade": 170,
    "tokenRefreshes": 10
  },
  "rateLimits": {
    "fifteenMinute": {
      "used": 45,
      "limit": 200,
      "windowStart": "2026-01-28T10:00:00.000Z"
    },
    "daily": {
      "used": 520,
      "limit": 2000,
      "windowStart": "2026-01-28T00:00:00.000Z"
    }
  },
  "timestamp": "2026-01-28T10:15:30.000Z"
}
```

### Logs

The processor logs all important events:

- Event processing start/completion
- API calls and token refreshes
- Errors and retries
- Rate limit status

Use log aggregation tools to monitor production deployments.

## Database Operations

### Webhook Events Table

The processor uses the `webhook_events` table:

```sql
CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY,
  subscription_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  object_type TEXT NOT NULL,
  object_id INTEGER NOT NULL,
  aspect_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  -- ... timestamps
);
```

### Event States

- **pending**: Ready to process
- **processing**: Currently being processed
- **processed**: Successfully completed
- **failed**: Failed after max retries

### Cleanup

Old processed/failed events should be cleaned periodically:

```typescript
database.cleanupOldWebhookEvents(30 * 24 * 60 * 60); // Delete events older than 30 days
```

Consider running this as a scheduled job (e.g., daily cron).

## Security Considerations

### Token Storage

**Current Implementation**: Tokens are stored in the in-memory session store.

**Limitation**: If a user's session expires, webhook events for that user cannot be processed.

**Production Recommendation**: Store refresh tokens separately in the database:

```sql
CREATE TABLE user_tokens (
  user_id INTEGER PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Update the `TokenManager` to use this table instead of sessions.

### Access Control

The webhook processor has full access to:
- All user sessions
- All user data in the database
- Strava API on behalf of users

Ensure:
- Worker process runs with appropriate permissions
- Database credentials are secured
- Logs don't expose sensitive data

## Performance Tuning

### Batch Size

- **Larger batches**: Higher throughput, but longer time to complete
- **Smaller batches**: Lower throughput, but faster response to new events

Recommended: 10-50 events per batch

### Poll Interval

- **Shorter intervals**: Lower latency, higher CPU usage
- **Longer intervals**: Higher latency, lower CPU usage

Recommended: 5-10 seconds

### Multiple Workers

For high event volume, run multiple worker instances:

1. Each worker claims events atomically (no conflicts)
2. Events are marked as "processing" to prevent double-processing
3. Workers can run on separate servers/containers

## Troubleshooting

### Events Not Processing

**Check**:
1. Is worker running? (`GET /api/health/webhook-processor`)
2. Are there pending events? (Check database)
3. Are all events failing? (Check error messages in database)
4. Is rate limit reached? (Check health endpoint)

### High Failure Rate

**Possible causes**:
- Users' tokens expired (need re-authentication)
- Strava API issues (check Strava status)
- Network connectivity problems

### Memory Leaks

The worker uses minimal memory, but monitor:
- Session store size (shouldn't grow unbounded)
- Event processing doesn't accumulate state

## Testing

Run tests:

```bash
npm test src/workers/__tests__
```

The test suite covers:
- Event processing flow
- Error handling
- Rate limiting
- Statistics tracking
- Graceful shutdown

## Future Improvements

1. **Persistent token storage**: Store refresh tokens in database
2. **Event prioritization**: Process certain event types first
3. **Dead letter queue**: Move permanently failed events to separate table
4. **Metrics export**: Export metrics to Prometheus/Datadog
5. **Distributed locking**: Use Redis for multi-instance coordination
6. **Event batching**: Batch multiple events per API call where possible
7. **Circuit breaker**: Temporarily stop processing if Strava API is down

# Activity Search Specification

**Version:** 1.0
**Last Updated:** 2026-02-05
**Target Audience:** Backend Developers

---

## 1. Current State

The database already supports every filter primitive we need. Nothing new needs to be added to SQLite.

### 1.1 Full-text search (FTS5)

`activities_fts` virtual table indexes `name` and `description`. The existing
`searchActivities` method already uses it when a `query` string is provided:

```sql
id IN (SELECT rowid FROM activities_fts WHERE activities_fts MATCH ?)
```

This handles simple keyword searches ("morning ride", "Zwift") but nothing
more — it cannot interpret distance, time, location, or activity-type intent
from natural language.

### 1.2 Structured filters already wired in `searchActivities`

| Filter | Column(s) | Notes |
|--------|-----------|-------|
| Activity type | `type` | `IN (...)` |
| Date range | `start_date` | Unix epoch seconds |
| Distance range | `distance_meters` | `>=` / `<=` |
| Duration range | `moving_time_seconds` | `>=` / `<=` |
| Bounding box | `start_lat`, `start_lng` | Four-sided box |
| Geohash prefix | `geohash` | `LIKE prefix%` |

### 1.3 Geo infrastructure already in place

- Every activity stores `start_lat`, `start_lng` (parsed at upsert time).
- A precision-7 geohash (~153 m) is computed and stored in the `geohash` column.
- `geohash.ts` ships `encodeGeohash`, `decodeGeohash`, `getGeohashNeighbors`,
  and `getGeohashesForBounds`.

---

## 2. The gap

The search input on the dashboard is a plain text box. Right now it feeds
directly into FTS. A query like *"Ride that happened near Mikkeli"* matches
nothing because FTS only sees literal tokens — it does not know that "Ride"
is an activity type or that "Mikkeli" is a place at 61.69 °N, 27.67 °E.

What is needed is a layer that **parses a freetext string into the structured
filters** that `searchActivities` already accepts.

---

## 3. Approach options

### Option A — LLM intent extraction (recommended)

```
"Rides longer than 30 km near Mikkeli last month"
        │
        ▼  POST to Claude API (Anthropic)
┌─────────────────────────┐
│  { types: ["Ride",…]    │
│    minDistance: 30000     │
│    location: "Mikkeli"  │
│    dateFrom: "2026-01"  │  ◄── structured JSON
│    dateTo:   "2026-02"  │
│  }                      │
└────────────┬────────────┘
             │  geocode location string
             ▼  Nominatim (OpenStreetMap)
      { lat: 61.69, lng: 27.67 }
             │  expand to bounding box (±radius)
             ▼
      searchActivities(filters)   ◄── existing method, no changes
```

**Why this wins:**
- The DB primitives are already complete. The *only* missing piece is
  NL → structured params, which is exactly what LLMs are good at.
- Handles arbitrary phrasing: *"all my runs this year that were at least an
  hour"*, *"short swims"*, *"rides with power data"* all resolve cleanly.
- Geocoding a location name is a well-solved sub-problem (see §4.2).
- Fallback is simple: if the Claude call fails or times out, drop back to
  plain FTS on the original string. The user still gets results.

**Trade-offs:**
- ~300–800 ms added latency on the first request (Claude API round-trip).
  Mitigated by caching parsed results keyed on the query string (§4.3).
- Requires `ANTHROPIC_API_KEY` in the server environment (already present
  for Claude Code).
- Non-deterministic: identical queries may occasionally parse differently.
  Prompt engineering + a strict output schema keep this well-bounded in
  practice.

### Option B — Rule-based keyword parser

Regex patterns extract intent: `/(?:ride|cycling)/i → types`, `/(\d+)\s*km/i →
distance`, date words like "today" / "last week" → epoch ranges.

**Why it falls short:**
- Location names are indistinguishable from activity name tokens without an
  exhaustive dictionary. "Mikkeli" could be a place or part of a route name.
- Every new phrasing pattern requires a new regex. Maintenance cost grows
  linearly with coverage.
- No way to handle negation, comparisons, or compositional queries
  (*"runs longer than my average"*).

### Option C — Vector / semantic search

Embed activity names + descriptions; embed the query; cosine-similarity rank.

**Why it falls short for this use case:**
- Works well for *"find something similar to X"* but poorly for structured
  constraints. Similarity search cannot express *"near Mikkeli"* or
  *"longer than 30 km"*.
- Requires a vector index and an embedding model — significant added
  infrastructure for marginal benefit on top of the structured filters we
  already have.

---

## 4. Design details (Option A)

### 4.1 New endpoint

```
POST /api/activities/search
Body:  { "q": "Rides longer than 30 km near Mikkeli last month" }
```

Returns the same shape as `GET /api/activities` (`GetActivitiesResponse`).
No new response type needed.

The controller flow:

1. Receive raw query string `q`.
2. Call `parseSearchIntent(q)` → `SearchIntent` (§4.1.1).
3. If `intent.location` is non-null, geocode it → lat/lng → bounding box
   (§4.2).
4. Map `SearchIntent` → `ActivitySearchFilters`.
5. Call existing `searchActivities(filters)`.
6. Return response.

#### 4.1.1 SearchIntent type

```typescript
interface SearchIntent {
  /** FTS passthrough — anything that looks like a plain name search */
  textQuery:    string | null;
  /** Strava activity types inferred from the query */
  types:        ActivityType[] | null;
  /** Raw location string as extracted by the LLM (e.g. "Mikkeli") */
  location:     string | null;
  /** Search radius in metres when a location is given. Default 20 000 (20 km) */
  locationRadius: number | null;
  /** ISO date strings for date range */
  dateFrom:     string | null;
  dateTo:       string | null;
  /** Distance bounds in metres */
  minDistance:   number | null;
  maxDistance:   number | null;
  /** Duration bounds in seconds */
  minDuration:  number | null;
  maxDuration:  number | null;
}
```

#### 4.1.2 Claude prompt contract

The server sends a system prompt that:
- Lists every `ActivityType` enum value.
- Gives the current date so relative dates ("last month") can be resolved.
- Demands a single JSON object matching `SearchIntent`. No prose, no
  markdown fences.
- Instructs: if a field cannot be inferred, emit `null`.
- Instructs: `textQuery` should be set only when the query looks like a
  plain name / keyword search with no other intent detected.
- Includes 3–4 few-shot examples.

The user message is just the raw query string.

#### 4.1.3 Fallback

If the Claude API call throws (network error, timeout, rate limit):
- Log the error.
- Fall back to plain FTS: pass `q` directly as `textQuery` into
  `searchActivities`.
- Attach a `{ warning: "search parsed as keyword only" }` flag in the
  response so the frontend can optionally surface it.

### 4.2 Geocoding

Location strings like "Mikkeli", "Helsinki", "Turku lake" need to resolve
to coordinates.

**Recommended service: Nominatim (OpenStreetMap)**

```
GET https://nominatim.openstreetmap.org/search
    ?q=Mikkeli&format=json&limit=1&countrycodes=FI
```

- Free, no API key required.
- Requires a valid `User-Agent` header (use `Zync/1.0`).
- Rate-limited to 1 req/s — fine for interactive search (one geocode per
  user query).
- Returns `lat` / `lon` as strings in the first result.

**Bounding box from a point + radius:**

```typescript
function radiusToBounds(lat: number, lng: number, radiusMetres: number) {
  const dLat = radiusMetres / 111_000;                          // 1° lat ≈ 111 km
  const dLng = radiusMetres / (111_000 * Math.cos(lat * Math.PI / 180));
  return {
    minLat: lat - dLat,  maxLat: lat + dLat,
    minLng: lng - dLng,  maxLng: lng + dLng,
  };
}
```

Default radius: **20 km** (covers a city and its surroundings). The LLM can
override this if the query implies a larger or smaller area
(*"in Finland"* → 200 km, *"on my street"* → 2 km).

**Fallback:** if Nominatim fails, skip the geo filter entirely and return
results filtered only by the other extracted params.

### 4.3 Caching

Parsed intents and geocoding results are both deterministic for the same
input string. Cache both with the existing `LRUCache`:

| Key pattern | TTL | Rationale |
|-------------|-----|-----------|
| `search-intent:<hash(q)>` | 60 s | User unlikely to retype identical query within a minute |
| `geocode:<location>` | 1 h | City coordinates don't move |

### 4.4 Rate limiting

Reuse the existing `userRateLimiter` middleware on the new route. The Claude
API call is the expensive part — the LRU cache means only the first request
for a given query string actually hits the API.

---

## 5. Frontend wiring

The existing search `<input>` in `ActivityFilters` already captures a
`search` string. Currently it is local state only (dummy, not wired to any
query).

When this feature is implemented:

1. Lift `search` into the URL search params (like `page` / `perPage` already
   are), so the query is bookmarkable and shareable.
2. On change (debounced ~300 ms), issue `POST /api/activities/search` with
   the current `search` value **instead of** the normal paginated
   `GET /api/activities`.
3. When `search` is empty, revert to the normal list endpoint.
4. If the response includes the `warning` flag, show a small chip:
   *"Searched by keyword only"*.

The category pills, date/distance/duration preset rows, and HR toggle in
`ActivityFilters` remain independent client-side filters that can be
**combined** with the freetext search (ANDed together).

---

## 6. What does NOT need to change

| Layer | Status |
|-------|--------|
| SQLite schema | Complete — `start_lat`, `start_lng`, `geohash`, FTS5 all exist |
| `searchActivities` | Complete — accepts all filter types already |
| `geohash.ts` utilities | Complete |
| `ActivitySearchFilters` type | Complete — has `bounds`, `geohashPrefix`, all ranges |
| OpenAPI response schema | Reuse `GetActivitiesResponse` |

---

## 7. Implementation checklist

- [ ] Add `ANTHROPIC_API_KEY` to `.env` / `.env.example`
- [ ] Create `server/src/services/search/parseIntent.ts` — Claude API call +
      prompt + response parsing
- [ ] Create `server/src/services/search/geocode.ts` — Nominatim wrapper +
      `radiusToBounds` helper
- [ ] Create `server/src/controllers/search.controller.ts`
- [ ] Add `POST /api/activities/search` route in `activities.routes.ts`
- [ ] Add endpoint to `openapi.yaml` (request body `{ q: string }`, response
      reuses `GetActivitiesResponse` + optional `warning` field)
- [ ] Regenerate types
- [ ] Wire `ActivityFilters` search input → new endpoint (debounced, URL-param
      lifted)
- [ ] Add integration test: known queries → expected filter shapes

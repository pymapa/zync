# UI Components

All shared primitives live in `src/components/ui/` and are re-exported from the barrel (`src/components/ui/index.ts`).

Import everything from the barrel:

```tsx
import { Button, Badge, Card, CardHeader, StatItem } from '../components/ui';
```

---

## Button

General-purpose action button. Renders `<a>` when `href` is provided, otherwise `<button>`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary'` | `'primary'` | Primary = solid accent fill. Secondary = outlined. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | |
| `shape` | `'pill' \| 'rounded'` | `'rounded'` | `pill` = `rounded-full`, `rounded` = `rounded-xl` |
| `isLoading` | `boolean` | `false` | Replaces icon with `Spinner`. Keeps full color (no opacity dim). Disables the button. |
| `icon` | `ReactNode` | — | Rendered left of children. Swapped out by spinner when loading. |
| `fullWidth` | `boolean` | `false` | Sets `w-full`. |
| `href` | `string` | — | Switches element to `<a>`. |
| `target` / `rel` | `string` | — | Passed through on `<a>`. |
| `disabled` | `boolean` | — | Standard HTML. Dims to 50% opacity (unless `isLoading`). |
| `className` | `string` | — | Appended to generated classes. |

```tsx
// Primary action
<Button size="lg" fullWidth icon={<Icon />} isLoading={pending}>
  Connect Strava
</Button>

// Secondary link
<Button variant="secondary" href="/login">Back to Login</Button>

// Small pill with loading state
<Button size="sm" shape="pill" isLoading={syncing}>Sync</Button>
```

---

## Badge

Small status pill. Sized and colored by variant only — no other props besides children.

| Prop | Type | Notes |
|---|---|---|
| `variant` | `BadgeVariant` | `'success' \| 'error' \| 'accent'` |
| `children` | `ReactNode` | |

```tsx
<Badge variant="success">Synced</Badge>
<Badge variant="error">Failed</Badge>
<Badge variant="accent">Active</Badge>
```

Export the type if you need it in consumer logic:

```tsx
import { type BadgeVariant } from '../components/ui';
```

---

## Card / CardHeader

Generic content container. `Card` is the shell; `CardHeader` is an optional title row with an optional action slot.

**Card**

| Prop | Type | Default | Notes |
|---|---|---|---|
| `children` | `ReactNode` | | |
| `className` | `string` | `''` | Appended. Use for padding (`p-6`) etc. |

**CardHeader**

| Prop | Type | Notes |
|---|---|---|
| `title` | `string` | Rendered as uppercase small-caps label. |
| `action` | `ReactNode` | Floated right. Typical use: a `<Badge>` or `<Button size="sm">`. |

```tsx
<Card className="p-6">
  <CardHeader title="Recent Activity" action={<Badge variant="accent">Live</Badge>} />
  {/* content */}
</Card>
```

---

## EmptyState

Dashed-border placeholder for lists or sections with no data.

| Prop | Type | Notes |
|---|---|---|
| `title` | `string` | Required. Primary message. |
| `description` | `string` | Optional. Secondary hint below the title. |

```tsx
<EmptyState title="No activities yet" description="Sync your Strava account to get started." />
```

---

## ErrorCard

Presentational error card. Does **not** include a page wrapper — the caller provides the outer layout (`PageLayout` + centering flex, or a plain `min-h-screen` flex).

| Prop | Type | Notes |
|---|---|---|
| `title` | `string` | Heading text. |
| `message` | `string` | Body text below the heading. |
| `errorDetail` | `string` | Optional. Rendered in a red-tinted box — good for exception messages. |
| `action` | `ReactNode` | Required. Caller provides the button or link (typically a `<Button>`). |

```tsx
<div className="min-h-screen bg-base flex items-center justify-center p-8">
  <ErrorCard
    title="Something went wrong"
    message="An unexpected error occurred."
    errorDetail={error.message}
    action={<Button fullWidth onClick={() => window.location.reload()}>Reload</Button>}
  />
</div>
```

---

## Pagination

Numeric page navigator with an optional per-page selector. Designed to sit at the bottom of a card (shares the card's rounded-bottom corners via `rounded-b-xl`).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `currentPage` | `number` | | 1-based. |
| `hasMore` | `boolean` | | Whether pages beyond `currentPage` exist. |
| `perPage` | `number` | | Items per page (reflected in the selector). |
| `totalDisplayed` | `number` | | Number of items on the current page (drives the "Showing X–Y" label). |
| `totalPages` | `number` | — | Optional. When provided, enables the full page-number row with ellipsis. |
| `onPageChange` | `(page: number) => void` | | |
| `onPerPageChange` | `(perPage: number) => void` | — | Optional. When provided, the per-page `<select>` is rendered. Options: 10, 30, 50. |
| `isLoading` | `boolean` | `false` | Disables all controls. |

```tsx
<Pagination
  currentPage={page}
  hasMore={hasMore}
  perPage={perPage}
  totalDisplayed={activities.length}
  totalPages={totalPages}
  onPageChange={setPage}
  onPerPageChange={setPerPage}
/>
```

---

## SegmentedControl

Typed tab-style toggle. The generic constraint `<T extends string>` keeps the value type narrow without casting.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `options` | `SegmentedOption<T>[]` | | Each option is `{ value: T; label: string }`. |
| `value` | `T` | | Currently selected value. |
| `onChange` | `(value: T) => void` | | |
| `size` | `'sm' \| 'md'` | `'md'` | `sm` is tighter — use inside already-dense cards. |

```tsx
type Metric = 'hours' | 'distance';

const options: SegmentedOption<Metric>[] = [
  { value: 'hours',    label: 'Hours' },
  { value: 'distance', label: 'Distance' },
];

<SegmentedControl<Metric> options={options} value={metric} onChange={setMetric} />
```

Export the option type:

```tsx
import { SegmentedControl, type SegmentedOption } from '../components/ui';
```

---

## Spinner

Animated SVG loading indicator. Inherits text color from its parent (uses `currentColor`).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | sm = 16px, md = 24px, lg = 32px |
| `className` | `string` | `''` | Use for color override, e.g. `text-accent` or `text-white`. |

```tsx
<Spinner size="lg" className="text-accent" />
```

`Button` uses `Spinner` internally when `isLoading` is set — you rarely need to reach for it directly.

---

## StatItem

Single metric display: large value on top, small label below. Used in stats grids.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | `string` | | Displayed below the value in muted text. |
| `value` | `string` | | The formatted number or text. |
| `valueColor` | `string` | `'text-accent'` | Any Tailwind text-color class. |
| `large` | `boolean` | `false` | `true` → `text-2xl`. Default → `text-xl`. |

```tsx
<div className="grid grid-cols-3 gap-3">
  <StatItem label="Distance" value="42.2 km" />
  <StatItem label="Duration" value="3:45:00" valueColor="text-blue" large />
  <StatItem label="Calories" value="2,100 kcal" valueColor="text-green" />
</div>
```

---

## PageLoading

Full-page loading screen. Wraps content in `PageLayout` (sidebar + header) so the chrome stays visible while data loads. Used by route guards and lazy-loaded pages.

| Prop | Type | Default |
|---|---|---|
| `message` | `string` | `'Loading...'` |

```tsx
<PageLoading message="Fetching activities..." />
```

---

## BarChart

Vertical bar chart for daily activity stats. Renders a skeleton when loading, a dashed empty state when there's no data, and hover tooltips on each bar.

| Prop | Type | Notes |
|---|---|---|
| `data` | `DailyStatsItem[]` | Array of `{ date, hours, distanceKm }`. |
| `metric` | `ChartMetric` | `'hours' \| 'distance'` — selects which field to plot. |
| `isLoading` | `boolean` | Renders an animated skeleton instead of bars. |

```tsx
<BarChart data={weeklyStats} metric={selectedMetric} isLoading={isFetching} />
```

Export the metric type:

```tsx
import { BarChart, type ChartMetric } from '../components/ui';
```

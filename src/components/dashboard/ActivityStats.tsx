import { memo, useState } from 'react';
import { useStats } from '../../hooks/useStats';
import { useDailyStats } from '../../hooks/useDailyStats';
import { Card, BarChart, SegmentedControl, EmptyState, type ChartMetric } from '../ui';
import type { StatsPeriod } from '../../types';

const METRIC_OPTIONS: { value: ChartMetric; label: string }[] = [
  { value: 'hours', label: 'Hours' },
  { value: 'distance', label: 'Distance' },
];

const PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) {
    const mins = Math.round(seconds / 60);
    return `${mins}m`;
  }
  return `${hours.toFixed(1)}h`;
}

function formatKm(meters: number): string {
  const km = meters / 1000;
  if (km < 1) {
    return `${Math.round(meters)}m`;
  }
  return `${km.toFixed(1)}km`;
}

function formatStreak(days: number): string {
  if (days === 1) return '1 day';
  return `${days} days`;
}

function formatStreakRange(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const startDate = new Date(sy!, sm! - 1, sd!);
  const endDate = new Date(ey!, em! - 1, ed!);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sMonth = months[startDate.getMonth()]!;
  const eMonth = months[endDate.getMonth()]!;
  if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
    return `${sMonth} ${startDate.getDate()}\u2013${endDate.getDate()}, ${startDate.getFullYear()}`;
  }
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${sMonth} ${startDate.getDate()} \u2013 ${eMonth} ${endDate.getDate()}, ${startDate.getFullYear()}`;
  }
  return `${sMonth} ${startDate.getDate()}, ${startDate.getFullYear()} \u2013 ${eMonth} ${endDate.getDate()}, ${endDate.getFullYear()}`;
}

export const ActivityStats = memo(function ActivityStats() {
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const [metric, setMetric] = useState<ChartMetric>('hours');
  const { stats, isLoading } = useStats(period);
  const { dailyStats, isLoading: isDailyLoading } = useDailyStats(period);

  const longestRange = stats ? formatStreakRange(stats.longestStreakStart, stats.longestStreakEnd) : null;

  return (
    <Card>
      <div className="p-5">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
          Stats
        </h2>
        <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} size="sm" />

        <div className="mt-4">
          {isLoading ? (
            <div className="flex gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex-1 animate-pulse">
                  <div className="h-0.5 bg-border rounded-full mb-2" />
                  <div className="h-4 bg-border rounded w-10 mb-1" />
                  <div className="h-3 bg-border rounded w-12" />
                </div>
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="flex gap-4">
                <div className="flex-1 border-t-2 border-accent pt-2">
                  <div className="font-bold text-sm text-accent">{formatHours(stats.totalMovingTimeSeconds)}</div>
                  <div className="text-xs text-text-muted mt-0.5">Hours</div>
                </div>
                <div className="flex-1 border-t-2 border-blue pt-2">
                  <div className="font-bold text-sm text-blue">{formatKm(stats.cyclingDistanceMeters)}</div>
                  <div className="text-xs text-text-muted mt-0.5">Cycling</div>
                </div>
                <div className="flex-1 border-t-2 border-green pt-2">
                  <div className="font-bold text-sm text-green">{formatKm(stats.runningDistanceMeters)}</div>
                  <div className="text-xs text-text-muted mt-0.5">Running</div>
                </div>
              </div>
              <div className="flex gap-4 mt-3">
                <div className="flex-1 border-t-2 border-orange pt-2">
                  <div className="font-bold text-sm text-orange">{formatStreak(stats.currentStreak)}</div>
                  <div className="text-xs text-text-muted mt-0.5">Current Streak</div>
                </div>
                <div className="flex-1 border-t-2 border-purple pt-2">
                  <div className="font-bold text-sm text-purple">{formatStreak(stats.longestStreak)}</div>
                  <div className="text-xs text-text-muted mt-0.5">Longest Streak</div>
                  {stats.longestStreak > 0 && longestRange && (
                    <div className="text-[10px] text-text-muted mt-0.5">{longestRange}</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyState title="No stats available" />
          )}
        </div>

        {/* Chart */}
        <div className="mt-5 pt-5 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              {period === 'all' ? 'Yearly' : period === 'year' ? 'Monthly' : 'Daily'}
            </span>
            <SegmentedControl options={METRIC_OPTIONS} value={metric} onChange={setMetric} size="sm" />
          </div>
          <BarChart
            data={dailyStats?.data ?? []}
            metric={metric}
            isLoading={isDailyLoading}
          />
        </div>
      </div>
    </Card>
  );
});

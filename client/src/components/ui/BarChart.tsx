import type { DailyStatsItem } from '../../types';

export type ChartMetric = 'hours' | 'distance';

interface BarChartProps {
  data: DailyStatsItem[];
  metric: ChartMetric;
  isLoading?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate();

  // Yearly bucket (backend sets date to Jan 1)
  if (day === 1 && date.getMonth() === 0) {
    return String(date.getFullYear());
  }

  // Monthly bucket (backend sets date to 1st of month)
  if (day === 1) {
    return date.toLocaleDateString('en-US', { month: 'short' });
  }

  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
  return `${weekday} ${day}`;
}

function getValue(item: DailyStatsItem, metric: ChartMetric): number {
  switch (metric) {
    case 'hours':
      return item.hours;
    case 'distance':
      return item.distanceKm;
  }
}

function formatValue(value: number, metric: ChartMetric): string {
  switch (metric) {
    case 'hours':
      return value < 1 ? `${Math.round(value * 60)}m` : `${value.toFixed(1)}h`;
    case 'distance':
      return `${value.toFixed(1)}km`;
  }
}

const BAR_AREA_HEIGHT = 120;
const LABEL_RESERVE = 22; // h-4 (16px) + mb-1.5 (6px)

export function BarChart({ data, metric, isLoading }: BarChartProps) {
  if (isLoading) {
    return (
      <div>
        <div className="flex items-end gap-2" style={{ height: BAR_AREA_HEIGHT + LABEL_RESERVE }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
              <div className="h-3 w-8 bg-border rounded animate-pulse" />
              <div
                className="w-full rounded-t-lg bg-border animate-pulse"
                style={{ height: `${16 + (i * 14) % 55}px` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2.5">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <div className="h-3 w-10 bg-border rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center border border-dashed border-border rounded-lg"
        style={{ height: BAR_AREA_HEIGHT + LABEL_RESERVE }}
      >
        <span className="text-xs text-text-muted">No activity data</span>
      </div>
    );
  }

  const values = data.map(d => getValue(d, metric));
  const maxValue = Math.max(...values, 0.01);

  return (
    <div key={metric} className="overflow-hidden">
      <div className="flex items-end gap-2" style={{ height: BAR_AREA_HEIGHT + LABEL_RESERVE }}>
        {data.map((item, index) => {
          const value = getValue(item, metric);
          const hasActivity = value > 0;
          const barHeight = hasActivity
            ? Math.max((value / maxValue) * BAR_AREA_HEIGHT, 8)
            : 0;

          return (
            <div
              key={item.date}
              className="flex-1 flex flex-col items-center justify-end h-full"
            >
              {hasActivity && (
                <span className="text-[10px] font-semibold text-text-secondary mb-1.5">
                  {formatValue(value, metric)}
                </span>
              )}

              <div
                className={`w-full rounded-t-lg transition-opacity ${hasActivity ? 'hover:opacity-75 cursor-pointer' : ''}`}
                style={{
                  height: `${barHeight}px`,
                  background: hasActivity
                    ? 'linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent-dim) 100%)'
                    : 'transparent',
                  transformOrigin: 'bottom',
                  animation: hasActivity
                    ? `barGrow 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 60}ms both`
                    : 'none',
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-2.5">
        {data.map((item) => (
          <div key={`label-${item.date}`} className="flex-1 text-center">
            <span className="text-[10px] text-text-muted">
              {formatDate(item.date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

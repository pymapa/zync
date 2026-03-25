import { isPaceActivity, getActivityColor } from '../../lib/utils/activityTypes';
import { formatPace, formatSpeed } from '../../lib/utils/format';
import { METERS_PER_KM } from '../../lib/utils/constants';
import type { DetailedActivity, Split } from '../../types';

interface Props {
  readonly activity: DetailedActivity;
}

// Pace zone colors: 1=recovery, 2=easy, 3=tempo, 4=threshold, 5=VO2max
const ZONE_COLORS = [
  '#9CA3AF', // no zone / 0
  '#10B981', // 1 - recovery green
  '#3B82F6', // 2 - easy blue
  '#F59E0B', // 3 - tempo amber
  '#F97316', // 4 - threshold orange
  '#EF4444', // 5 - VO2max red
];

function getZoneColor(zone: number | null | undefined): string {
  if (!zone || zone < 0 || zone > 5) return ZONE_COLORS[0];
  return ZONE_COLORS[zone];
}

export function SplitsView({ activity }: Props) {
  const splits = activity.splitsMetric;
  if (!splits || splits.length === 0) return null;

  const showPace = isPaceActivity(activity.type);
  const color = getActivityColor(activity.type);

  // Calculate pace/speed values for the bar chart
  const values = splits.map(s => {
    if (!s.averageSpeed || s.averageSpeed <= 0) return 0;
    return showPace ? METERS_PER_KM / s.averageSpeed / 60 : s.averageSpeed * 3.6;
  });

  const maxVal = Math.max(...values.filter(v => v > 0));
  const minVal = Math.min(...values.filter(v => v > 0));

  // For pace (lower = faster), we invert the bar direction
  const getBarWidth = (val: number) => {
    if (val <= 0 || maxVal <= minVal) return 50;
    if (showPace) {
      // Invert: faster (lower) pace = longer bar
      return 30 + ((maxVal - val) / (maxVal - minVal)) * 70;
    }
    return 30 + ((val - minVal) / (maxVal - minVal)) * 70;
  };

  const formatValue = (split: Split) => {
    if (!split.averageSpeed || split.averageSpeed <= 0) return '-';
    return showPace
      ? formatPace(split.averageSpeed).replace(' /km', '')
      : formatSpeed(split.averageSpeed).replace(' km/h', '');
  };

  const formatElevDiff = (diff: number | null | undefined) => {
    if (diff == null) return '';
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${Math.round(diff)}m`;
  };

  return (
    <div className="space-y-5">
      {/* Bar chart */}
      <div className="space-y-1">
        {splits.map((split, i) => {
          const val = values[i];
          const width = getBarWidth(val);
          const zoneColor = getZoneColor(split.paceZone);

          return (
            <div key={split.split} className="flex items-center gap-2 group">
              <span className="w-6 text-right text-[10px] font-mono text-text-muted tabular-nums">
                {split.split}
              </span>
              <div className="flex-1 h-6 relative">
                <div
                  className="h-full rounded-r-sm transition-all duration-300"
                  style={{
                    width: `${width}%`,
                    backgroundColor: zoneColor,
                    opacity: 0.8,
                    animation: `barGrow 0.4s ease-out ${i * 0.03}s both`,
                    transformOrigin: 'left',
                  }}
                />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[11px] font-mono font-semibold tabular-nums text-text-primary">
                  {formatValue(split)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 font-medium text-text-muted uppercase tracking-wide">Km</th>
              <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">
                {showPace ? 'Pace' : 'Speed'}
              </th>
              <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">Elev</th>
              <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">Time</th>
              {splits.some(s => s.paceZone) && (
                <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">Zone</th>
              )}
            </tr>
          </thead>
          <tbody>
            {splits.map((split, i) => {
              // Highlight fastest split
              const isFastest = values[i] > 0 && (
                showPace ? values[i] === minVal : values[i] === maxVal
              );

              return (
                <tr
                  key={split.split}
                  className="border-b border-border/30 last:border-b-0"
                >
                  <td className="py-1.5 font-mono tabular-nums text-text-secondary">{split.split}</td>
                  <td
                    className="py-1.5 text-right font-mono font-semibold tabular-nums"
                    style={{ color: isFastest ? color : undefined }}
                  >
                    {formatValue(split)}
                    <span className="text-text-muted ml-1">{showPace ? '/km' : 'km/h'}</span>
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-text-secondary">
                    {formatElevDiff(split.elevationDifference)}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-text-secondary">
                    {Math.floor(split.movingTimeSeconds / 60)}:{String(split.movingTimeSeconds % 60).padStart(2, '0')}
                  </td>
                  {splits.some(s => s.paceZone) && (
                    <td className="py-1.5 text-right">
                      {split.paceZone ? (
                        <span
                          className="inline-block w-5 h-5 rounded text-[10px] font-bold leading-5 text-center text-white"
                          style={{ backgroundColor: getZoneColor(split.paceZone) }}
                        >
                          {split.paceZone}
                        </span>
                      ) : null}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

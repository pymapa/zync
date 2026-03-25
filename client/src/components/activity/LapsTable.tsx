import { isPaceActivity, isSnowActivity, getActivityColor } from '../../lib/utils/activityTypes';
import { formatDistance, formatPace, formatSpeed, formatHeartRate } from '../../lib/utils/format';
import type { DetailedActivity } from '../../types';

interface Props {
  readonly activity: DetailedActivity;
}

export function LapsTable({ activity }: Props) {
  const laps = activity.laps;
  if (!laps || laps.length === 0) return null;

  const showPace = isPaceActivity(activity.type);
  const snow = isSnowActivity(activity.type);
  const color = getActivityColor(activity.type);
  const hasHR = laps.some(l => l.averageHeartRate);
  const hasElev = laps.some(l => l.totalElevationGain && l.totalElevationGain > 0);

  // Find fastest lap by pace/speed
  let fastestIdx = -1;
  let fastestVal = showPace ? Infinity : -Infinity;
  laps.forEach((lap, i) => {
    if (!lap.averageSpeed || lap.averageSpeed <= 0) return;
    const val = showPace ? 1000 / lap.averageSpeed / 60 : lap.averageSpeed * 3.6;
    if (showPace ? val < fastestVal : val > fastestVal) {
      fastestVal = val;
      fastestIdx = i;
    }
  });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 font-medium text-text-muted uppercase tracking-wide">
              {snow ? 'Run' : 'Lap'}
            </th>
            <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">Distance</th>
            <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">Time</th>
            <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">
              {showPace ? 'Pace' : 'Speed'}
            </th>
            {hasHR && (
              <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">Avg HR</th>
            )}
            {hasElev && (
              <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">Elev</th>
            )}
          </tr>
        </thead>
        <tbody>
          {laps.map((lap, i) => {
            const isFastest = i === fastestIdx;

            return (
              <tr
                key={lap.lapIndex}
                className="border-b border-border/30 last:border-b-0"
              >
                <td className="py-1.5 font-mono tabular-nums text-text-secondary">
                  {lap.lapIndex}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums text-text-secondary">
                  {formatDistance(lap.distanceMeters)}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums text-text-secondary">
                  {formatTime(lap.movingTimeSeconds)}
                </td>
                <td
                  className="py-1.5 text-right font-mono font-semibold tabular-nums"
                  style={{ color: isFastest ? color : undefined }}
                >
                  {lap.averageSpeed && lap.averageSpeed > 0
                    ? showPace
                      ? formatPace(lap.averageSpeed)
                      : formatSpeed(lap.averageSpeed)
                    : '-'
                  }
                </td>
                {hasHR && (
                  <td className="py-1.5 text-right font-mono tabular-nums text-text-secondary">
                    {lap.averageHeartRate ? formatHeartRate(lap.averageHeartRate) : '-'}
                  </td>
                )}
                {hasElev && (
                  <td className="py-1.5 text-right font-mono tabular-nums text-text-secondary">
                    {lap.totalElevationGain ? `${Math.round(lap.totalElevationGain)}m` : '-'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import {
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
  formatElevation,
  formatCalories,
  formatHeartRate,
  formatCadence,
  formatPower,
} from '../../lib/utils/format';
import {
  isPaceActivity,
  isPowerActivity,
  isCadenceActivity,
  isIndoorActivity,
  isSnowActivity,
  getActivityColor,
} from '../../lib/utils/activityTypes';
import type { DetailedActivity } from '../../types';

interface Props {
  readonly activity: DetailedActivity;
}

interface StatRow {
  label: string;
  value: string;
  highlight?: boolean;
}

export function ActivityStatsList({ activity }: Props) {
  const color = getActivityColor(activity.type);
  const showPace = isPaceActivity(activity.type);
  const showPower = isPowerActivity(activity.type);
  const showCadence = isCadenceActivity(activity.type);
  const indoor = isIndoorActivity(activity.type);
  const snow = isSnowActivity(activity.type);

  const rows: StatRow[] = [];

  // Distance (skip for indoor)
  if (!indoor && activity.distanceMeters > 0) {
    rows.push({ label: 'Distance', value: formatDistance(activity.distanceMeters), highlight: true });
  }

  // Duration
  rows.push({ label: 'Moving Time', value: formatDuration(activity.movingTimeSeconds) });

  if (activity.elapsedTimeSeconds > activity.movingTimeSeconds + 60) {
    rows.push({ label: 'Elapsed Time', value: formatDuration(activity.elapsedTimeSeconds) });
  }

  // Pace or Speed
  if (activity.averageSpeed > 0) {
    if (showPace) {
      rows.push({ label: 'Avg Pace', value: formatPace(activity.averageSpeed) });
    } else {
      rows.push({ label: 'Avg Speed', value: formatSpeed(activity.averageSpeed) });
    }
  }
  if (activity.maxSpeed > 0) {
    if (showPace) {
      rows.push({ label: 'Max Pace', value: formatPace(activity.maxSpeed) });
    } else {
      rows.push({ label: 'Max Speed', value: formatSpeed(activity.maxSpeed) });
    }
  }

  // Elevation
  if (activity.elevationGainMeters > 0) {
    rows.push({ label: 'Elevation Gain', value: formatElevation(activity.elevationGainMeters) });
  }

  // Snowboard vertical drop
  if (snow && activity.elevHigh != null && activity.elevLow != null) {
    const drop = Math.round(activity.elevHigh - activity.elevLow);
    if (drop > 0) {
      rows.push({ label: 'Vertical Drop', value: `${drop}m`, highlight: true });
    }
    rows.push({ label: 'Elev High', value: `${Math.round(activity.elevHigh)}m` });
    rows.push({ label: 'Elev Low', value: `${Math.round(activity.elevLow)}m` });
  }

  // Heart rate
  if (activity.averageHeartRate) {
    rows.push({ label: 'Avg HR', value: formatHeartRate(activity.averageHeartRate) });
  }
  if (activity.maxHeartRate) {
    rows.push({ label: 'Max HR', value: formatHeartRate(activity.maxHeartRate) });
  }

  // Cadence
  if (showCadence && activity.averageCadence && activity.averageCadence > 0) {
    rows.push({ label: 'Avg Cadence', value: formatCadence(activity.averageCadence, activity.type) });
  }

  // Power
  if (showPower && activity.averageWatts && activity.averageWatts > 0) {
    rows.push({ label: 'Avg Power', value: formatPower(activity.averageWatts), highlight: true });
  }
  if (showPower && activity.weightedAverageWatts && activity.weightedAverageWatts > 0) {
    rows.push({ label: 'NP', value: formatPower(activity.weightedAverageWatts) });
  }
  if (showPower && activity.maxWatts && activity.maxWatts > 0) {
    rows.push({ label: 'Max Power', value: formatPower(activity.maxWatts) });
  }

  // Calories
  if (activity.calories && activity.calories > 0) {
    rows.push({ label: 'Calories', value: formatCalories(activity.calories) });
  }

  // Kilojoules
  if (activity.kilojoules && activity.kilojoules > 0) {
    rows.push({ label: 'Energy', value: `${Math.round(activity.kilojoules)} kJ` });
  }

  // Suffer score
  if (activity.sufferScore && activity.sufferScore > 0) {
    rows.push({ label: 'Suffer Score', value: String(activity.sufferScore) });
  }

  // Device
  if (activity.deviceName) {
    rows.push({ label: 'Device', value: activity.deviceName });
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-0">
      {rows.map((row, i) => (
        <div
          key={row.label}
          className="flex items-center justify-between py-2 border-b border-border/40 last:border-b-0"
          style={{ animation: `fadeIn 0.3s ease-out ${i * 0.03}s both` }}
        >
          <span className="text-xs text-text-muted uppercase tracking-wide">{row.label}</span>
          <span
            className="text-sm font-mono font-semibold tabular-nums"
            style={{ color: row.highlight ? color : undefined }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

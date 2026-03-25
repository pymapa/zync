import { Card, StatItem } from '../ui';
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatElevation,
  formatCalories,
  formatHeartRate,
  formatCadence,
  formatPower,
  formatSpeed,
} from '../../lib/utils/format';
import type { DetailedActivity, ActivityType } from '../../types';

interface ActivityStatsProps {
  readonly activity: DetailedActivity;
}

interface StatEntry {
  label: string;
  value: string;
}

const PACE_ACTIVITIES: ActivityType[] = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike'];
const CADENCE_ACTIVITIES: ActivityType[] = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike', 'Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide'];
const POWER_ACTIVITIES: ActivityType[] = ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide'];

export function ActivityStats({ activity }: ActivityStatsProps) {
  const showPace = PACE_ACTIVITIES.includes(activity.type);
  const showCadence = CADENCE_ACTIVITIES.includes(activity.type);
  const showPower = POWER_ACTIVITIES.includes(activity.type);

  const stats: StatEntry[] = [];

  if (activity.distanceMeters > 0) {
    stats.push({ label: 'Distance', value: formatDistance(activity.distanceMeters) });
  }

  stats.push({ label: 'Duration', value: formatDuration(activity.movingTimeSeconds) });

  if (activity.averageSpeed > 0) {
    stats.push(showPace
      ? { label: 'Avg Pace',  value: formatPace(activity.averageSpeed) }
      : { label: 'Avg Speed', value: formatSpeed(activity.averageSpeed) }
    );
  }

  if (activity.elevationGainMeters > 0) {
    stats.push({ label: 'Elevation', value: formatElevation(activity.elevationGainMeters) });
  }

  if (activity.calories && activity.calories > 0) {
    stats.push({ label: 'Calories', value: formatCalories(activity.calories) });
  }

  if (activity.averageHeartRate) {
    stats.push({ label: 'Avg Heart Rate', value: formatHeartRate(activity.averageHeartRate) });
  }

  if (activity.maxHeartRate) {
    stats.push({ label: 'Max Heart Rate', value: formatHeartRate(activity.maxHeartRate) });
  }

  if (showCadence && activity.averageCadence && activity.averageCadence > 0) {
    stats.push({ label: 'Avg Cadence', value: formatCadence(activity.averageCadence, activity.type) });
  }

  if (showPower && activity.averageWatts && activity.averageWatts > 0) {
    stats.push({ label: 'Avg Power', value: formatPower(activity.averageWatts) });
  }

  if (showPower && activity.weightedAverageWatts && activity.weightedAverageWatts > 0) {
    stats.push({ label: 'Normalized Power', value: formatPower(activity.weightedAverageWatts) });
  }

  return (
    <Card className="p-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
        Stats
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <StatItem key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
    </Card>
  );
}

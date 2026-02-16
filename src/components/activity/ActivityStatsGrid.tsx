import {
  formatCalories,
  formatHeartRate,
  formatCadence,
  formatPower,
} from '../../lib/utils/format';
import type { DetailedActivity, ActivityType } from '../../types';

interface ActivityStatsGridProps {
  readonly activity: DetailedActivity;
}

const CADENCE_ACTIVITIES: ActivityType[] = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike', 'Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide'];
const POWER_ACTIVITIES: ActivityType[] = ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide'];

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  delay?: number;
}

function StatCard({ label, value, unit, accent, delay = 0 }: StatCardProps) {
  return (
    <div
      className={`
        relative p-5 rounded-xl border
        ${accent
          ? 'bg-gradient-to-br from-card to-surface border-border-strong shadow-md'
          : 'bg-card/40 backdrop-blur-sm border-border/60'
        }
      `}
      style={{
        animation: `slideUp 0.4s ease-out ${delay}s both`
      }}
    >
      <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2.5 leading-none">
        {label}
      </div>
      <div className={`flex items-baseline gap-1.5 ${accent ? 'text-accent' : 'text-text-primary'}`}>
        <span className="text-2xl font-bold font-mono tabular-nums leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-xs text-text-muted font-mono">{unit}</span>
        )}
      </div>
    </div>
  );
}

export function ActivityStatsGrid({ activity }: ActivityStatsGridProps) {
  const showCadence = CADENCE_ACTIVITIES.includes(activity.type);
  const showPower = POWER_ACTIVITIES.includes(activity.type);

  const hasStats = activity.calories ||
    activity.averageHeartRate ||
    activity.maxHeartRate ||
    (showCadence && activity.averageCadence) ||
    (showPower && activity.averageWatts) ||
    (showPower && activity.weightedAverageWatts);

  if (!hasStats) return null;

  return (
    <div className="bg-gradient-to-br from-surface/30 to-base/50 rounded-2xl p-6 sm:p-8 border border-border/40">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-text-muted">
          Performance Data
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {activity.calories && activity.calories > 0 && (
          <StatCard
            label="Calories"
            value={formatCalories(activity.calories).replace(' kcal', '')}
            unit="kcal"
            accent
            delay={0.1}
          />
        )}

        {activity.averageHeartRate && (
          <StatCard
            label="Avg Heart Rate"
            value={formatHeartRate(activity.averageHeartRate).replace(' bpm', '')}
            unit="bpm"
            delay={0.15}
          />
        )}

        {activity.maxHeartRate && (
          <StatCard
            label="Max Heart Rate"
            value={formatHeartRate(activity.maxHeartRate).replace(' bpm', '')}
            unit="bpm"
            delay={0.2}
          />
        )}

        {showCadence && activity.averageCadence && activity.averageCadence > 0 && (
          <StatCard
            label="Avg Cadence"
            value={formatCadence(activity.averageCadence, activity.type).replace(' rpm', '').replace(' spm', '')}
            unit={activity.type.includes('Ride') ? 'rpm' : 'spm'}
            delay={0.25}
          />
        )}

        {showPower && activity.averageWatts && activity.averageWatts > 0 && (
          <StatCard
            label="Avg Power"
            value={formatPower(activity.averageWatts).replace(' W', '')}
            unit="W"
            accent
            delay={0.3}
          />
        )}

        {showPower && activity.weightedAverageWatts && activity.weightedAverageWatts > 0 && (
          <StatCard
            label="Normalized Power"
            value={formatPower(activity.weightedAverageWatts).replace(' W', '')}
            unit="W"
            delay={0.35}
          />
        )}
      </div>
    </div>
  );
}

import { formatFullActivityDate } from '../../lib/utils/date';
import { ACTIVITY_ICONS } from '../../lib/utils/constants';
import {
  formatDistance,
  formatDuration,
  formatSpeed,
  formatPace,
  formatElevation,
} from '../../lib/utils/format';
import type { DetailedActivity, ActivityType } from '../../types';

interface ActivityHeroProps {
  readonly activity: DetailedActivity;
}

const PACE_ACTIVITIES: ActivityType[] = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike'];

// Map activity type to color
function getActivityColor(type: ActivityType): string {
  if (type.includes('Run')) return 'var(--activity-run)';
  if (type.includes('Ride') || type.includes('Bike')) return 'var(--activity-ride)';
  if (type === 'Swim') return 'var(--activity-swim)';
  if (type === 'Walk' || type === 'Hike') return 'var(--activity-walk)';
  if (type.includes('Ski')) return 'var(--activity-ski)';
  return 'var(--activity-workout)';
}

export function ActivityHero({ activity }: ActivityHeroProps) {
  const icon = ACTIVITY_ICONS[activity.type] ?? '🏃';
  const formattedDate = formatFullActivityDate(activity.startDateLocal);
  const showPace = PACE_ACTIVITIES.includes(activity.type);
  const accentColor = getActivityColor(activity.type);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-base via-surface to-card border-b-2 border-border">
      {/* Diagonal accent bar */}
      <div
        className="absolute top-0 right-0 w-1 h-full opacity-30"
        style={{ background: accentColor }}
      />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 sm:px-8 py-12">
        {/* Header */}
        <div className="flex items-start gap-6 mb-10">
          <div
            className="text-5xl flex-shrink-0 opacity-90"
            style={{ filter: `drop-shadow(0 2px 8px ${accentColor}40)` }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-2 leading-tight">
              {activity.name}
            </h1>
            <p className="text-sm text-text-muted font-mono uppercase tracking-wider">
              {formattedDate}
            </p>
          </div>
        </div>

        {/* Primary stats - asymmetric layout */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Distance - hero stat */}
          {activity.distanceMeters > 0 && (
            <div
              className="col-span-2 lg:col-span-1 bg-card/60 backdrop-blur-sm rounded-2xl p-6 border border-border-strong/50 shadow-lg"
              style={{
                borderTopColor: accentColor,
                borderTopWidth: '3px',
                animation: 'slideUp 0.4s ease-out'
              }}
            >
              <div className="text-xs font-mono uppercase tracking-widest text-text-muted mb-2">
                Distance
              </div>
              <div
                className="text-4xl font-bold font-mono tabular-nums leading-none"
                style={{ color: accentColor }}
              >
                {formatDistance(activity.distanceMeters).replace(' km', '')}
              </div>
              <div className="text-xs text-text-muted font-mono mt-1">km</div>
            </div>
          )}

          {/* Duration */}
          <div
            className="bg-card/60 backdrop-blur-sm rounded-2xl p-6 border border-border/50"
            style={{ animation: 'slideUp 0.5s ease-out' }}
          >
            <div className="text-xs font-mono uppercase tracking-widest text-text-muted mb-2">
              Duration
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums text-text-primary">
              {formatDuration(activity.movingTimeSeconds)}
            </div>
          </div>

          {/* Speed/Pace */}
          {activity.averageSpeed > 0 && (
            <div
              className="bg-card/60 backdrop-blur-sm rounded-2xl p-6 border border-border/50"
              style={{ animation: 'slideUp 0.6s ease-out' }}
            >
              <div className="text-xs font-mono uppercase tracking-widest text-text-muted mb-2">
                {showPace ? 'Avg Pace' : 'Avg Speed'}
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-text-primary">
                {showPace
                  ? formatPace(activity.averageSpeed).replace('/km', '')
                  : formatSpeed(activity.averageSpeed).replace(' km/h', '')}
              </div>
              <div className="text-xs text-text-muted font-mono mt-1">
                {showPace ? '/km' : 'km/h'}
              </div>
            </div>
          )}

          {/* Elevation */}
          {activity.elevationGainMeters > 0 && (
            <div
              className="bg-card/60 backdrop-blur-sm rounded-2xl p-6 border border-border/50"
              style={{ animation: 'slideUp 0.7s ease-out' }}
            >
              <div className="text-xs font-mono uppercase tracking-widest text-text-muted mb-2">
                Elevation
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-text-primary">
                {formatElevation(activity.elevationGainMeters).replace('m', '')}
              </div>
              <div className="text-xs text-text-muted font-mono mt-1">m</div>
            </div>
          )}
        </div>

        {/* Description */}
        {activity.description && (
          <div
            className="mt-8 pl-6 border-l-2 text-sm text-text-secondary leading-relaxed max-w-2xl"
            style={{
              borderColor: accentColor,
              animation: 'fadeIn 0.8s ease-out'
            }}
          >
            {activity.description}
          </div>
        )}
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { ACTIVITY_ICONS } from '../../lib/utils/constants';
import { formatFullActivityDate } from '../../lib/utils/date';
import { formatDistance, formatDuration } from '../../lib/utils/format';
import { getActivityColor } from '../../lib/utils/activityTypes';
import { BackArrowIcon, StravaIcon } from '../icons';
import { ROUTES, EXTERNAL_URLS } from '../../lib/utils/routes';
import type { DetailedActivity } from '../../types';

interface Props {
  readonly activity: DetailedActivity;
}

export function ActivityDetailHeader({ activity }: Props) {
  const navigate = useNavigate();
  const icon = ACTIVITY_ICONS[activity.type] ?? '🏃';
  const color = getActivityColor(activity.type);
  const date = formatFullActivityDate(activity.startDateLocal);

  // Inline summary chips
  const chips: string[] = [];
  if (activity.distanceMeters > 0) chips.push(formatDistance(activity.distanceMeters));
  chips.push(formatDuration(activity.movingTimeSeconds));

  return (
    <header className="border-b border-border/60">
      {/* Top bar */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors text-sm group"
          >
            <BackArrowIcon className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="text-xs font-medium">Back</span>
          </button>

          <a
            href={EXTERNAL_URLS.STRAVA_ACTIVITY(activity.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:border-accent hover:text-accent transition-colors"
          >
            <StravaIcon className="w-3.5 h-3.5" />
            Strava
          </a>
        </div>

        {/* Title row */}
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0 mt-0.5">{icon}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight leading-tight">
              {activity.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              <span className="text-sm text-text-secondary">{date}</span>
              <span className="hidden sm:inline text-text-muted">·</span>
              <div className="flex items-center gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="text-sm font-mono font-semibold"
                    style={{ color }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
            {activity.description && (
              <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-2xl">
                {activity.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

import { Link } from 'react-router-dom';
import { formatDistance, formatDuration, formatPace, formatSpeed, formatHeartRate } from '../../lib/utils/format';
import { formatActivityDate } from '../../lib/utils/date';
import { ACTIVITY_ICONS } from '../../lib/utils/constants';
import type { Activity, ActivityType } from '../../types';

const PACE_ACTIVITIES: ActivityType[] = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike'];

interface ActivityListItemProps {
  readonly activity: Activity;
  readonly number?: number;
}

export function ActivityListItem({ activity, number }: ActivityListItemProps) {
  const icon = ACTIVITY_ICONS[activity.type] ?? '>';
  const showPace = PACE_ACTIVITIES.includes(activity.type);

  return (
    <Link
      to={`/activity/${activity.id}`}
      className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:shadow-sm hover:border-border-strong transition-all cursor-pointer group"
    >
      {number !== undefined && (
        <div className="text-text-muted text-xs w-8 text-right"># {number}</div>
      )}
      <div className="text-xl w-8 text-center text-accent">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-text-primary font-medium truncate group-hover:text-accent transition-colors">
          {activity.name}
        </div>
        <div className="text-text-muted text-xs">
          {formatActivityDate(activity.startDate)}
        </div>
      </div>
      <div className="text-right">
        <div className="text-text-primary text-sm font-medium">{formatDistance(activity.distanceMeters)}</div>
        <div className="text-text-muted text-xs">
          {formatDuration(activity.movingTimeSeconds)}
        </div>
      </div>
      <div className="text-right hidden sm:block">
        <div className="text-blue text-sm font-medium">
          {showPace ? formatPace(activity.averageSpeed) : formatSpeed(activity.averageSpeed)}
        </div>
        {activity.averageHeartRate && (
          <div className="text-accent text-xs">{formatHeartRate(activity.averageHeartRate)}</div>
        )}
      </div>
    </Link>
  );
}

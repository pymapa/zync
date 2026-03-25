import { Card } from '../ui/Card';
import { formatFullActivityDate } from '../../lib/utils/date';
import { ACTIVITY_ICONS } from '../../lib/utils/constants';
import type { DetailedActivity } from '../../types';

interface ActivityHeaderProps {
  readonly activity: DetailedActivity;
}

export function ActivityHeader({ activity }: ActivityHeaderProps) {
  const icon = ACTIVITY_ICONS[activity.type] ?? '>';
  const formattedDate = formatFullActivityDate(activity.startDateLocal);

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="text-3xl text-accent">{icon}</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text-primary truncate">
            {activity.name}
          </h1>
          <p className="text-text-muted mt-1 text-sm">{formattedDate}</p>
          {activity.description && (
            <p className="text-text-secondary mt-3 whitespace-pre-wrap text-sm border-l-2 border-accent pl-3">
              {activity.description}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

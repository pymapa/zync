import { useParams, useNavigate } from 'react-router-dom';
import { useActivity } from '../hooks/useActivities';
import { PageLoading } from '../components/ui';
import { PageLayout } from '../components/layout';
import { ActivityDetailHeader } from '../components/activity/ActivityDetailHeader';
import { ActivityStatsList } from '../components/activity/ActivityStatsList';
import { ActivityMap } from '../components/activity/ActivityMap';
import { ActivityTabs } from '../components/activity/ActivityTabs';
import { ActivityPhotos } from '../components/activity/ActivityPhotos';
import { isIndoorActivity } from '../lib/utils/activityTypes';
import { ROUTES } from '../lib/utils/routes';

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activity, isLoading, error } = useActivity(id ?? '');

  if (!id) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center">
            <p className="text-red text-sm mb-4">Invalid activity ID</p>
            <button
              onClick={() => navigate(ROUTES.DASHBOARD)}
              className="text-accent hover:underline text-sm font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (isLoading) {
    return <PageLoading />;
  }

  if (error || !activity) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center">
            <p className="text-red text-sm mb-4">
              {error ? 'Failed to load activity' : 'Activity not found'}
            </p>
            <button
              onClick={() => navigate(ROUTES.DASHBOARD)}
              className="text-accent hover:underline text-sm font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const indoor = isIndoorActivity(activity.type);
  const hasMap = !indoor && !!activity.map?.summaryPolyline;
  const hasPhotos = (activity.photos?.count ?? 0) > 0;

  return (
    <PageLayout>
      {/* Compact header */}
      <ActivityDetailHeader activity={activity} />

      {/* Photos — always visible at top if they exist */}
      {hasPhotos && (
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-6">
          <ActivityPhotos activity={activity} />
        </section>
      )}

      {/* Stats + Map row */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
        <div className={`grid gap-6 ${hasMap ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : ''}`}>
          {/* Stats panel */}
          <div className="bg-card rounded-xl border border-border/60 p-5">
            <ActivityStatsList activity={activity} />
          </div>

          {/* Map */}
          {hasMap && (
            <div>
              <ActivityMap activity={activity} height={380} />
            </div>
          )}
        </div>
      </section>

      {/* Tabbed data sections */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-10">
        <ActivityTabs activity={activity} />
      </section>
    </PageLayout>
  );
}

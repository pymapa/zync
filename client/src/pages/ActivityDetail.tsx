import { useParams, useNavigate } from 'react-router-dom';
import { useActivity } from '../hooks/useActivities';
import { PageLoading } from '../components/ui';
import { PageLayout } from '../components/layout';
import { ActivityHero, ActivityStatsGrid, ActivityStreamsGraph, ActivityMap } from '../components/activity';
import { BackArrowIcon, StravaIcon } from '../components/icons';
import { ROUTES, EXTERNAL_URLS } from '../lib/utils/routes';

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  const { activity, isLoading, error } = useActivity(id);

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

  return (
    <PageLayout>
      {/* Minimal header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 py-4">
          <button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="flex items-center gap-2 text-text-secondary hover:text-accent transition-all duration-200 text-sm font-medium group"
          >
            <BackArrowIcon className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="font-mono uppercase tracking-wider text-xs">Back</span>
          </button>
        </div>
      </header>

      {/* Hero section with primary stats */}
      <ActivityHero activity={activity} />

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 sm:px-8 py-8 space-y-8">
        {/* Map */}
        {!['Workout', 'WeightTraining', 'Yoga'].includes(activity.type) && (
          <ActivityMap activity={activity} />
        )}

        {/* Secondary stats */}
        <ActivityStatsGrid activity={activity} />

        {/* Performance chart */}
        <ActivityStreamsGraph activity={activity} />

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <a
            href={EXTERNAL_URLS.STRAVA_ACTIVITY(activity.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-6 py-3 bg-accent text-white text-xs font-bold font-mono uppercase tracking-wider rounded-xl hover:bg-accent-dim transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
          >
            <StravaIcon className="w-4 h-4" />
            <span>View on Strava</span>
          </a>
        </div>
      </main>
    </PageLayout>
  );
}

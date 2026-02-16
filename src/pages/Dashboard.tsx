import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useInfiniteActivities } from '../hooks/useInfiniteActivities';
import { DashboardLayout } from '../components/layout';
import { ActivitySearchBar, ActivityFilters, ActivityList, ActivityStats, SyncButton, QuickLinks } from '../components/dashboard';
import type { CategoryId, DatePreset, DistancePreset, DurationPreset } from '../components/dashboard/ActivityFilters';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------------------------------------------------------------------------
  // Filter state from URL params (shared between SearchBar and advanced Filters)
  // ---------------------------------------------------------------------------
  const search       = searchParams.get('search') || '';
  const category     = (searchParams.get('category') as CategoryId) || 'all';
  const date         = (searchParams.get('date') as DatePreset) || 'all';
  const distance     = (searchParams.get('distance') as DistancePreset) || 'any';
  const duration     = (searchParams.get('duration') as DurationPreset) || 'any';
  const hasHeartRate = searchParams.get('hasHeartRate') === 'true';

  const updateParam = useCallback((key: string, value: string | boolean) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value || value === 'all' || value === 'any' || value === false) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      return next;
    });
  }, [setSearchParams]);

  const handleClearAll = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const { activities, totalCount, hasMore, isLoading, isLoadingMore, fetchNextPage } = useInfiniteActivities({
    search: search || undefined,
    category: category !== 'all' ? category : undefined,
    date: date !== 'all' ? date : undefined,
    distance: distance !== 'any' ? distance : undefined,
    duration: duration !== 'any' ? duration : undefined,
    hasHeartRate: hasHeartRate || undefined,
  });

  // ---------------------------------------------------------------------------
  // Refresh / logout
  // ---------------------------------------------------------------------------
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['activities'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['dailyStats'] });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const userName = user ? `${user.firstName} ${user.lastName}` : '';

  return (
    <DashboardLayout
      userName={userName}
      onRefresh={handleRefresh}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        {/* Search bar + category pills — full width above the grid */}
        <ActivitySearchBar
          search={search}
          category={category}
          onSearch={v => updateParam('search', v)}
          onCategory={v => updateParam('category', v)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
            <ActivityFilters
              date={date}
              distance={distance}
              duration={duration}
              hasHeartRate={hasHeartRate}
              onDate={v => updateParam('date', v)}
              onDistance={v => updateParam('distance', v)}
              onDuration={v => updateParam('duration', v)}
              onHasHeartRate={v => updateParam('hasHeartRate', v)}
              onClearAll={handleClearAll}
            />
            <ActivityStats />
            <QuickLinks />
          </aside>

          {/* Main */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-text-primary">
                Your Activities
              </h2>
              <SyncButton onSyncComplete={handleRefresh} />
            </div>
            <ActivityList
              activities={activities}
              totalCount={totalCount}
              hasMore={hasMore}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              onLoadMore={fetchNextPage}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

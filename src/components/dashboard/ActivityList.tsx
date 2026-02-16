import { useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, EmptyState, Spinner } from '../ui';
import { ActivityListItem } from './ActivityListItem';
import type { Activity } from '../../types';

interface ActivityListProps {
  readonly activities: Activity[];
  readonly totalCount?: number;
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  readonly onLoadMore: () => void;
}

export function ActivityList({
  activities,
  totalCount,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
}: ActivityListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleObserver, { threshold: 0, rootMargin: '0px 0px 400px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <CardHeader title="Recent Activities" />
        {isLoading && activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size="lg" />
            <p className="text-sm text-text-muted mt-4">Loading activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <EmptyState title="No activities found" description="Sync your data to see activities here" />
        ) : (
          <div className="space-y-2">
            {activities.map((activity, index) => (
              <ActivityListItem
                key={activity.id}
                activity={activity}
                number={totalCount !== undefined ? totalCount - index : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scroll sentinel — invisible, triggers next page when it enters the viewport */}
      <div ref={sentinelRef} className="h-1" />

      {isLoadingMore && (
        <div className="px-6 py-12 flex justify-center text-text-muted">
          <Spinner size="sm" />
        </div>
      )}

      {!hasMore && activities.length > 0 && (
        <div className="px-6 py-3 text-center text-xs text-text-muted">
          All {activities.length} activities loaded
        </div>
      )}
    </Card>
  );
}

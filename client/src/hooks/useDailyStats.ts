import { useQuery } from '@tanstack/react-query';
import { activitiesApi } from '../lib/api/activities.api';
import type { StatsPeriod } from '../types';

/**
 * Hook for fetching daily activity stats for charts using React Query.
 */
export function useDailyStats(period: StatsPeriod = 'week') {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dailyStats', period],
    queryFn: () => activitiesApi.getDailyStats(period),
  });

  return {
    dailyStats: data ?? null,
    isLoading,
    error,
    refetch,
  };
}

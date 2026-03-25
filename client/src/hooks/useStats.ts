import { useQuery } from '@tanstack/react-query';
import { activitiesApi } from '../lib/api/activities.api';
import type { StatsPeriod } from '../types';

/**
 * Hook for fetching activity stats using React Query.
 */
export function useStats(period: StatsPeriod = 'week') {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stats', period],
    queryFn: () => activitiesApi.getStats(period),
  });

  return {
    stats: data ?? null,
    isLoading,
    error,
    refetch,
  };
}

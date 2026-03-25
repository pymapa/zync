import { useQuery } from '@tanstack/react-query';
import { activitiesApi } from '../lib/api/activities.api';

/**
 * Hook for fetching activity stream data using React Query.
 */
export function useActivityStreams(id: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['activityStreams', id],
    queryFn: () => activitiesApi.getActivityStreams(id!),
    enabled: !!id,
  });

  return {
    streams: data ?? null,
    isLoading,
    error,
  };
}

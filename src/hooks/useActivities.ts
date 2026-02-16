import { useQuery } from '@tanstack/react-query';
import { activitiesApi } from '../lib/api/activities.api';
import type { GetActivitiesParams } from '../lib/api/types';

/**
 * Hook for fetching activities using React Query.
 */
export function useActivities(params: GetActivitiesParams = {}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['activities', params],
    queryFn: () => activitiesApi.getActivities(params),
  });

  const perPage = data?.perPage ?? 10;
  const totalCount = data?.totalCount;
  const totalPages = totalCount !== undefined ? Math.ceil(totalCount / perPage) : undefined;

  return {
    activities: data?.activities ?? [],
    hasMore: data?.hasMore ?? false,
    page: data?.page ?? 1,
    perPage,
    totalCount,
    totalPages,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching a single activity by ID.
 */
export function useActivity(id: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => activitiesApi.getActivity(id!),
    enabled: !!id,
  });

  return {
    activity: data?.activity ?? null,
    isLoading,
    error,
  };
}

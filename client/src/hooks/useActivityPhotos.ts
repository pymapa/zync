import { useQuery } from '@tanstack/react-query';
import { activitiesApi } from '../lib/api/activities.api';

/**
 * Hook for fetching all activity photos from Strava.
 * Only fetches when enabled (e.g., when Photos tab is active).
 */
export function useActivityPhotos(id: string | undefined, enabled: boolean = false) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['activityPhotos', id],
    queryFn: () => activitiesApi.getActivityPhotos(id!),
    enabled: !!id && enabled,
  });

  return {
    photos: data?.photos ?? [],
    isLoading,
    error,
  };
}

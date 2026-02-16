import { useInfiniteQuery } from '@tanstack/react-query';
import { activitiesApi } from '../lib/api/activities.api';
import type { GetActivitiesParams } from '../lib/api/types';

const PER_PAGE = 20;

export interface ActivityFilters {
  search?: string;
  category?: string;
  date?: string;
  distance?: string;
  duration?: string;
  hasHeartRate?: boolean;
}

export function useInfiniteActivities(filters?: ActivityFilters) {
  const { data, isLoading, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage, isPlaceholderData } = useInfiniteQuery({
    queryKey: ['activities', filters],
    queryFn: async ({ pageParam }) => {
      const params: GetActivitiesParams = {
        page: pageParam,
        perPage: PER_PAGE,
        ...filters,
      };
      return activitiesApi.getActivities(params);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length + 1;
    },
    placeholderData: (previousData) => previousData,
  });

  const activities = data?.pages.flatMap(page => page.activities) ?? [];
  const totalCount = data?.pages[0]?.totalCount;

  return {
    activities,
    totalCount,
    isLoading,
    isFetching,
    hasMore: hasNextPage ?? false,
    isLoadingMore: isFetchingNextPage,
    fetchNextPage,
  };
}

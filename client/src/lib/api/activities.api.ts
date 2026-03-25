import { apiClient } from './client';
import type { GetActivitiesParams } from './types';
import type { GetActivitiesResponse, GetActivityResponse, GetActivityStatsResponse, GetDailyStatsResponse, GetActivityStreamsResponse, StatsPeriod } from '../../types';

export const activitiesApi = {
  getActivities: async (params: GetActivitiesParams = {}): Promise<GetActivitiesResponse> => {
    const { data } = await apiClient.get<GetActivitiesResponse>('/activities', { params });
    return data;
  },

  getActivity: async (id: string): Promise<GetActivityResponse> => {
    const { data } = await apiClient.get<GetActivityResponse>(`/activities/${id}`);
    return data;
  },

  getStats: async (period: StatsPeriod = 'week'): Promise<GetActivityStatsResponse> => {
    const { data } = await apiClient.get<GetActivityStatsResponse>('/activities/stats', {
      params: { period },
    });
    return data;
  },

  getDailyStats: async (period: StatsPeriod = 'week'): Promise<GetDailyStatsResponse> => {
    const { data } = await apiClient.get<GetDailyStatsResponse>('/activities/stats/daily', {
      params: { period },
    });
    return data;
  },

  getActivityStreams: async (id: string): Promise<GetActivityStreamsResponse> => {
    const { data } = await apiClient.get<GetActivityStreamsResponse>(`/activities/${id}/streams`);
    return data;
  },
};

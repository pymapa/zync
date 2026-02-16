import { apiClient } from './client';
import type { GetAuthUrlResponse, GetMeResponse } from '../../types';

export const authApi = {
  getAuthUrl: async (redirectUri: string): Promise<GetAuthUrlResponse> => {
    const { data } = await apiClient.post<GetAuthUrlResponse>('/auth/strava/url', {
      redirectUri,
    });
    return data;
  },

  getMe: async (): Promise<GetMeResponse> => {
    const { data } = await apiClient.get<GetMeResponse>('/auth/me');
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  refresh: async (): Promise<void> => {
    await apiClient.post('/auth/refresh');
  },
};

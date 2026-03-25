import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api/auth.api';
import type { AxiosError } from 'axios';

const AUTH_QUERY_KEY = ['auth', 'me'];

/**
 * Hook for authentication operations using React Query.
 * Fetches current user from backend /auth/me endpoint.
 */
export function useAuthQuery() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: authApi.getMe,
    retry: (failureCount, error) => {
      // Don't retry on 401 (unauthenticated is a valid state)
      if ((error as AxiosError)?.response?.status === 401) {
        return false;
      }
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, { user: null });
      queryClient.clear();
    },
  });

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
    error,
    logout: logoutMutation.mutateAsync,
  };
}

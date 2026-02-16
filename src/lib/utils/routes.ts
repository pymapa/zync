/**
 * Application route constants
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ACTIVITY_DETAIL: '/activity/:id',
  CALLBACK: '/callback',
} as const;

/**
 * External URL helpers
 */
export const EXTERNAL_URLS = {
  STRAVA_ACTIVITY: (id: number | string) => `https://www.strava.com/activities/${id}`,
} as const;

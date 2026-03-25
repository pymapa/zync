/**
 * API Request Types
 *
 * Response types are generated from OpenAPI and live in src/types/
 * This file only contains request parameter types.
 */

export interface GetActivitiesParams {
  page?: number;
  perPage?: number;
  before?: number;
  after?: number;
  // Filters
  search?: string;
  category?: string;
  date?: string;
  distance?: string;
  duration?: string;
  hasHeartRate?: boolean;
}

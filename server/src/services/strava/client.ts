/**
 * Strava API client
 * Handles authenticated requests to Strava API
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { StravaAPIError, AppError, ErrorCode } from '../../utils/errors';

export class StravaClient {
  private client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: config.strava.apiBaseUrl,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15000,
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        return this.handleError(error);
      }
    );
  }

  /**
   * Handle API errors with proper logging and error types
   */
  private handleError(error: AxiosError): never {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      logger.error('Strava API authentication failed', error, {
        status,
        endpoint: error.config?.url,
      });
      throw new AppError(
        401,
        ErrorCode.INVALID_TOKEN,
        'Strava access token is invalid or expired',
        data
      );
    }

    if (status === 403) {
      logger.error('Strava API authorization failed', error, {
        status,
        endpoint: error.config?.url,
      });
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        'Access to this Strava resource is forbidden',
        data
      );
    }

    if (status === 404) {
      logger.error('Strava API resource not found', error, {
        status,
        endpoint: error.config?.url,
      });
      throw new AppError(
        404,
        ErrorCode.NOT_FOUND,
        'Strava resource not found',
        data
      );
    }

    if (status === 429) {
      logger.error('Strava API rate limit exceeded', error, {
        status,
        endpoint: error.config?.url,
      });
      throw new AppError(
        429,
        ErrorCode.RATE_LIMIT_EXCEEDED,
        'Strava API rate limit exceeded',
        data
      );
    }

    if (status && status >= 500) {
      logger.error('Strava API server error', error, {
        status,
        endpoint: error.config?.url,
      });
      throw new StravaAPIError('Strava API is currently unavailable', data);
    }

    logger.error('Strava API request failed', error, {
      status,
      endpoint: error.config?.url,
    });
    throw new StravaAPIError('Failed to communicate with Strava API', data);
  }

  /**
   * Generic GET request
   */
  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(endpoint, { params });
    return response.data;
  }

  /**
   * Generic POST request
   */
  async post<T>(
    endpoint: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    const response = await this.client.post<T>(endpoint, data);
    return response.data;
  }

  /**
   * Generic PUT request
   */
  async put<T>(
    endpoint: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    const response = await this.client.put<T>(endpoint, data);
    return response.data;
  }

  /**
   * Generic DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    const response = await this.client.delete<T>(endpoint);
    return response.data;
  }
}

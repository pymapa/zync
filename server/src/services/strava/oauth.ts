/**
 * Strava OAuth flow with PKCE
 */

import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { StravaAPIError, AppError, ErrorCode } from '../../utils/errors';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateStateToken,
} from '../../utils/crypto';
import { StravaTokenResponse } from './types';

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

export interface AuthorizationUrlParams {
  redirectUri: string;
}

export interface TokenExchangeParams {
  code: string;
  codeVerifier: string;
}

/**
 * Generate PKCE challenge and authorization URL
 */
export function generateAuthorizationUrl(
  params: AuthorizationUrlParams
): { url: string; pkce: PKCEChallenge } {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateStateToken();

  const url = new URL(config.strava.authorizationUrl);
  url.searchParams.set('client_id', config.strava.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'read,activity:read_all,profile:read_all');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  logger.info('Generated authorization URL', {
    redirectUri: params.redirectUri,
    state,
  });

  return {
    url: url.toString(),
    pkce: {
      codeVerifier,
      codeChallenge,
      state,
    },
  };
}

/**
 * Exchange authorization code for access token using PKCE
 */
export async function exchangeCodeForToken(
  params: TokenExchangeParams
): Promise<StravaTokenResponse> {
  try {
    logger.info('Exchanging authorization code for token');

    // NOTE: Strava uses a non-standard PKCE implementation
    // Standard PKCE is for public clients (no client_secret)
    // However, Strava requires BOTH client_secret AND code_verifier
    // This is Strava-specific behavior and not standard OAuth 2.0 + PKCE
    const response = await axios.post<StravaTokenResponse>(
      config.strava.tokenUrl,
      {
        client_id: config.strava.clientId,
        client_secret: config.strava.clientSecret,
        code: params.code,
        code_verifier: params.codeVerifier,
        grant_type: 'authorization_code',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    logger.info('Successfully exchanged code for token', {
      athleteId: response.data.athlete.id,
      expiresAt: response.data.expires_at,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;

      logger.error('Strava OAuth token exchange failed', error, {
        status,
        data,
      });

      if (status === 400) {
        throw new AppError(
          400,
          ErrorCode.OAUTH_ERROR,
          'Invalid authorization code or code verifier',
          data
        );
      }

      throw new StravaAPIError('Failed to exchange authorization code', data);
    }

    logger.error('Unexpected error during token exchange', error);
    throw new StravaAPIError('Unexpected error during token exchange');
  }
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<StravaTokenResponse> {
  try {
    logger.info('Refreshing access token');

    const response = await axios.post<StravaTokenResponse>(
      config.strava.tokenUrl,
      {
        client_id: config.strava.clientId,
        client_secret: config.strava.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    logger.info('Successfully refreshed access token', {
      expiresAt: response.data.expires_at,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;

      logger.error('Strava token refresh failed', error, {
        status,
        data,
      });

      if (status === 400 || status === 401) {
        throw new AppError(
          401,
          ErrorCode.INVALID_TOKEN,
          'Invalid or expired refresh token',
          data
        );
      }

      throw new StravaAPIError('Failed to refresh access token', data);
    }

    logger.error('Unexpected error during token refresh', error);
    throw new StravaAPIError('Unexpected error during token refresh');
  }
}

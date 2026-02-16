/**
 * Cryptographic utilities for PKCE and secure token generation
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureRandomString(length: number): string {
  const buffer = crypto.randomBytes(length);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .substring(0, length);
}

/**
 * Generate PKCE code_verifier (43-128 characters)
 */
export function generateCodeVerifier(): string {
  return generateSecureRandomString(128);
}

/**
 * Generate PKCE code_challenge from code_verifier using SHA256
 */
export function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return hash
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate OAuth state token for CSRF protection
 */
export function generateStateToken(): string {
  return generateSecureRandomString(32);
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  return generateSecureRandomString(32);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api/auth.api';
import { Button } from '../components/ui';

const StravaIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
  </svg>
);

export default function Login() {
  const [searchParams] = useSearchParams();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(errorParam);
    }
  }, [searchParams]);

  const handleOAuthLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const redirectUri = `${apiUrl}/auth/strava/callback`;
      const { url } = await authApi.getAuthUrl(redirectUri);
      console.log('Redirecting to auth URL:', url);
      globalThis.location.href = url;
    } catch (err) {
      console.error('Failed to get auth URL:', err);
      setError('Failed to connect to authentication service');
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <Link
          to="/"
          className="inline-flex items-center text-text-muted hover:text-accent mb-8 transition-colors text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Link>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text-primary">
              Welcome back
            </h1>
            <p className="text-text-secondary text-sm mt-2">
              Sign in to access your dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red/10 border border-red/30">
              <p className="text-red text-sm">
                {error}
              </p>
            </div>
          )}

          <Button
            onClick={handleOAuthLogin}
            isLoading={isLoggingIn}
            size="lg"
            fullWidth
            icon={<StravaIcon />}
          >
            {isLoggingIn ? 'Connecting…' : 'Continue with Strava'}
          </Button>
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

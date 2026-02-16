import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageLayout } from '../components/layout';
import { Spinner, Button, ErrorCard } from '../components/ui';

/**
 * OAuth callback page.
 * Backend handles the token exchange via the callback URL.
 * This page just shows loading state and redirects to dashboard.
 */
export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`Strava authorization failed: ${errorParam}`);
      return;
    }

    const timer = setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 1500);

    return () => clearTimeout(timer);
  }, [searchParams, navigate]);

  if (error) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen p-8">
          <ErrorCard
            title="Authentication Error"
            message={error}
            action={<Button href="/login">Try again</Button>}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size="lg" className="text-accent mx-auto mb-4" />
          <p className="text-text-secondary font-medium text-sm">Connecting to Strava…</p>
        </div>
      </div>
    </PageLayout>
  );
}

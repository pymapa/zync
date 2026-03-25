import { Spinner } from './Spinner';
import { PageLayout } from '../layout';

interface PageLoadingProps {
  readonly message?: string;
}

export function PageLoading({ message = 'Loading...' }: PageLoadingProps) {
  return (
    <PageLayout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <Spinner size="md" className="text-accent" />
          <span className="text-text-secondary font-medium text-sm">
            {message}
          </span>
        </div>
      </div>
    </PageLayout>
  );
}

import { Component, type ReactNode } from 'react';
import { ErrorCard } from '../components/ui/ErrorCard';
import { Button } from '../components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-base flex items-center justify-center p-8">
          <ErrorCard
            title="Something went wrong"
            message="An unexpected error occurred. Please try refreshing the page."
            errorDetail={this.state.error?.message}
            action={
              <Button onClick={() => window.location.reload()} fullWidth>
                Reload Page
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

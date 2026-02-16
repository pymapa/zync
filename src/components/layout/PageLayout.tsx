import type { ReactNode } from 'react';

interface PageLayoutProps {
  readonly children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-base">
      {children}
    </div>
  );
}

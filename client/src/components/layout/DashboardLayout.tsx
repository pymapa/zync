import type { ReactNode } from 'react';
import { DashboardHeader } from './DashboardHeader';

interface DashboardLayoutProps {
  readonly children: ReactNode;
  readonly userName: string;
  readonly onRefresh: () => void;
  readonly onLogout: () => void;
}

export function DashboardLayout({
  children,
  userName,
  onRefresh,
  onLogout,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-base">
      <DashboardHeader
        userName={userName}
        onRefresh={onRefresh}
        onLogout={onLogout}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

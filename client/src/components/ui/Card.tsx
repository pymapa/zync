import type { ReactNode } from 'react';

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`border border-border bg-card rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  readonly title: string;
  readonly action?: ReactNode;
}

export function CardHeader({ title, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest">
        {title}
      </h2>
      {action}
    </div>
  );
}

import type { ReactNode } from 'react';

export type BadgeVariant = 'success' | 'error' | 'accent';

interface BadgeProps {
  readonly variant: BadgeVariant;
  readonly children: ReactNode;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-green/10  text-green  border-green/30',
  error:   'bg-red/10    text-red    border-red/30',
  accent:  'bg-accent/10 text-accent border-accent/30',
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`text-xs px-3 py-1 rounded-full border ${VARIANT_STYLES[variant]}`}>
      {children}
    </span>
  );
}

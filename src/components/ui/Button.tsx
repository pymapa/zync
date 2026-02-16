import type { ComponentProps, ReactNode } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  readonly variant?: 'primary' | 'secondary';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly shape?: 'pill' | 'rounded';
  readonly isLoading?: boolean;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
  /** Renders as <a> when provided */
  readonly href?: string;
  readonly target?: string;
  readonly rel?: string;
  readonly fullWidth?: boolean;
}

const SIZE = {
  sm: 'px-5 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-6 py-4 text-sm',
} as const;

const SHAPE = {
  pill: 'rounded-full',
  rounded: 'rounded-xl',
} as const;

export function Button({
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  isLoading = false,
  icon,
  children,
  className = '',
  disabled,
  href,
  target,
  rel,
  fullWidth = false,
  ...props
}: ButtonProps) {
  const classes = [
    'flex items-center justify-center gap-2',
    'font-semibold transition-colors',
    SIZE[size],
    SHAPE[shape],
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-accent-dim'
      : 'border border-border text-text-secondary hover:border-border-strong hover:text-text-primary',
    disabled && !isLoading && 'opacity-50 cursor-not-allowed',
    isLoading && 'cursor-not-allowed',
    fullWidth && 'w-full',
    className,
  ].filter(Boolean).join(' ');

  const content = (
    <>
      {isLoading
        ? <Spinner size="sm" className={variant === 'primary' ? 'text-white' : 'text-text-muted'} />
        : icon}
      {children}
    </>
  );

  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={classes}>
        {content}
      </a>
    );
  }

  return (
    <button disabled={disabled || isLoading} className={classes} {...props}>
      {content}
    </button>
  );
}

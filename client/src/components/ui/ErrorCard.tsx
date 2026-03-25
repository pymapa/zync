import type { ReactNode } from 'react';

interface ErrorCardProps {
  readonly title: string;
  readonly message: string;
  /** Optional technical detail displayed in a red box */
  readonly errorDetail?: string;
  /** Action element (button or link) rendered below the message */
  readonly action: ReactNode;
}

export function ErrorCard({ title, message, errorDetail, action }: ErrorCardProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-8 max-w-md w-full text-center">
      <div className="w-12 h-12 bg-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9.303 3.376a12 12 0 11-15.94-14.753m15.94 14.753L12 12.75" />
        </svg>
      </div>
      <h1 className="text-lg font-bold text-text-primary mb-2">{title}</h1>
      <p className="text-text-secondary text-sm mb-4">{message}</p>
      {errorDetail && (
        <p className="text-sm text-red bg-red/5 border border-red/20 rounded-lg p-3 text-left mb-4">
          {errorDetail}
        </p>
      )}
      {action}
    </div>
  );
}

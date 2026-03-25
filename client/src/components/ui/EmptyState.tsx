interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="text-text-muted text-center py-8 border border-dashed border-border rounded-lg">
      <p className="text-sm">{title}</p>
      {description && <p className="text-xs mt-2">{description}</p>}
    </div>
  );
}

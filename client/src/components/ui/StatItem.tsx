const BORDER_BY_VALUE_COLOR: Record<string, string> = {
  'text-accent': 'border-accent',
  'text-blue':   'border-blue',
  'text-green':  'border-green',
  'text-red':    'border-red',
};

interface StatItemProps {
  readonly label: string;
  readonly value: string;
  /** Tailwind text-color class for the value. Defaults to text-accent. */
  readonly valueColor?: string;
  /** Larger value text (text-2xl). Defaults to text-xl. */
  readonly large?: boolean;
}

export function StatItem({ label, value, valueColor = 'text-accent', large = false }: StatItemProps) {
  const borderColor = BORDER_BY_VALUE_COLOR[valueColor] ?? 'border-accent';

  return (
    <div className={`bg-surface rounded-lg p-4 border-t-2 ${borderColor}`}>
      <div className={`font-bold ${large ? 'text-2xl' : 'text-xl'} ${valueColor}`}>{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  );
}

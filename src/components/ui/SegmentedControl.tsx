export interface SegmentedOption<T> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  readonly options: SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** sm = tighter padding + smaller text, md = default */
  readonly size?: 'sm' | 'md';
}

const SIZE = {
  sm: { container: 'p-0.5', button: 'px-2.5 py-1 text-[10px]' },
  md: { container: 'p-1',   button: 'px-3 py-1.5 text-xs'     },
} as const;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: SegmentedControlProps<T>) {
  const { container, button } = SIZE[size];

  return (
    <div className={`bg-surface rounded-lg ${container} flex gap-0.5`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`${button} font-medium rounded-md transition-all ${
            value === option.value
              ? 'bg-card shadow-sm text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

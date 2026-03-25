import { formatPace } from '../../lib/utils/format';
import type { DetailedActivity } from '../../types';

interface Props {
  readonly activity: DetailedActivity;
}

const MEDAL_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#FCD34D', text: '#92400E' }, // gold
  2: { bg: '#D1D5DB', text: '#374151' }, // silver
  3: { bg: '#FDBA74', text: '#7C2D12' }, // bronze
};

function formatEffortTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function BestEffortsTable({ activity }: Props) {
  const efforts = activity.bestEfforts;
  if (!efforts || efforts.length === 0) return null;

  // Sort by distance ascending
  const sorted = [...efforts].sort((a, b) => a.distanceMeters - b.distanceMeters);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 font-medium text-text-muted uppercase tracking-wide">Distance</th>
            <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">Time</th>
            <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">Pace</th>
            <th className="text-right py-2 font-medium text-text-muted uppercase tracking-wide">PR</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((effort) => {
            const paceSpeed = effort.distanceMeters > 0
              ? effort.distanceMeters / effort.movingTimeSeconds
              : 0;
            const medal = effort.prRank && effort.prRank <= 3 ? MEDAL_COLORS[effort.prRank] : null;

            return (
              <tr
                key={effort.name}
                className="border-b border-border/30 last:border-b-0"
              >
                <td className="py-2 font-medium text-text-primary">{effort.name}</td>
                <td className="py-2 text-right font-mono font-semibold tabular-nums text-text-primary">
                  {formatEffortTime(effort.elapsedTimeSeconds)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-text-secondary">
                  {paceSpeed > 0 ? formatPace(paceSpeed) : '-'}
                </td>
                <td className="py-2 text-right">
                  {medal ? (
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: medal.bg, color: medal.text }}
                    >
                      {effort.prRank}
                    </span>
                  ) : effort.prRank ? (
                    <span className="text-text-muted font-mono">#{effort.prRank}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

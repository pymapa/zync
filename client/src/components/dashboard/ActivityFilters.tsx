import { useState, useMemo } from 'react';
import type { ActivityType } from '../../types';

// ---------------------------------------------------------------------------
// Types — exported so ActivitySearchBar and Dashboard can share them
// ---------------------------------------------------------------------------

export type CategoryId     = 'all' | 'running' | 'cycling' | 'water' | 'outdoor' | 'alpine' | 'xc' | 'fitness';
export type DatePreset     = 'all' | 'today' | 'week' | 'month' | 'year';
export type DistancePreset = 'any' | 'short' | 'medium' | 'long' | 'ultra';
export type DurationPreset = 'any' | 'quick' | 'medium' | 'long' | 'ultra';

export interface CategoryDef {
  id:    CategoryId;
  label: string;
  icon:  string;
  color: string;
  types: ActivityType[];
}

interface PresetOption<T extends string> {
  value: T;
  label: string;
}

// ---------------------------------------------------------------------------
// Static data — CATEGORIES exported for ActivitySearchBar
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export const CATEGORIES: CategoryDef[] = [
  { id: 'all',      label: 'All',      icon: '✦',  color: '#0D9488', types: [] },
  { id: 'running', label: 'Running',  icon: '🏃', color: '#EF4444', types: ['Run', 'TrailRun', 'VirtualRun'] },
  { id: 'cycling', label: 'Cycling',  icon: '🚴', color: '#3B82F6', types: ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide'] },
  { id: 'water',   label: 'Swim',     icon: '🏊', color: '#06B6D4', types: ['Swim'] },
  { id: 'outdoor', label: 'Outdoor',  icon: '🥾', color: '#10B981', types: ['Walk', 'Hike'] },
  { id: 'alpine',  label: 'Alpine',   icon: '🏔️', color: '#8B5CF6', types: ['AlpineSki', 'BackcountrySki', 'Snowboard', 'Snowshoe', 'IceSkate'] },
  { id: 'xc',      label: 'XC Ski',   icon: '⛷️', color: '#A78BFA', types: ['NordicSki', 'RollerSki'] },
  { id: 'fitness', label: 'Fitness',  icon: '💪', color: '#F59E0B', types: ['Workout', 'WeightTraining', 'Yoga'] },
];

const DATE_OPTIONS: PresetOption<DatePreset>[] = [
  { value: 'all',   label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year',  label: 'This year' },
];

const DISTANCE_OPTIONS: PresetOption<DistancePreset>[] = [
  { value: 'any',    label: 'Any' },
  { value: 'short',  label: '< 5 km' },
  { value: 'medium', label: '5–15 km' },
  { value: 'long',   label: '15–30 km' },
  { value: 'ultra',  label: '30+ km' },
];

const DURATION_OPTIONS: PresetOption<DurationPreset>[] = [
  { value: 'any',    label: 'Any' },
  { value: 'quick',  label: '< 30 min' },
  { value: 'medium', label: '30–60 min' },
  { value: 'long',   label: '1–2 h' },
  { value: 'ultra',  label: '2+ h' },
];

// ---------------------------------------------------------------------------
// Component — advanced filters (sidebar panel)
// ---------------------------------------------------------------------------

interface ActivityFiltersProps {
  readonly date:           DatePreset;
  readonly distance:       DistancePreset;
  readonly duration:       DurationPreset;
  readonly hasHeartRate:   boolean;
  readonly onDate:         (v: DatePreset) => void;
  readonly onDistance:      (v: DistancePreset) => void;
  readonly onDuration:     (v: DurationPreset) => void;
  readonly onHasHeartRate: (v: boolean) => void;
  readonly onClearAll:     () => void;
}

export function ActivityFilters({
  date, distance, duration, hasHeartRate,
  onDate, onDistance, onDuration, onHasHeartRate,
  onClearAll,
}: ActivityFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const activeChips = useMemo(() => {
    const out: { id: string; label: string; onClear: () => void }[] = [];

    if (date !== 'all') {
      const d = DATE_OPTIONS.find(o => o.value === date);
      if (d) out.push({ id: 'date', label: d.label, onClear: () => onDate('all') });
    }
    if (distance !== 'any') {
      const d = DISTANCE_OPTIONS.find(o => o.value === distance);
      if (d) out.push({ id: 'distance', label: `dist: ${d.label}`, onClear: () => onDistance('any') });
    }
    if (duration !== 'any') {
      const d = DURATION_OPTIONS.find(o => o.value === duration);
      if (d) out.push({ id: 'duration', label: `dur: ${d.label}`, onClear: () => onDuration('any') });
    }
    if (hasHeartRate) {
      out.push({ id: 'hr', label: '❤️ Has HR', onClear: () => onHasHeartRate(false) });
    }
    return out;
  }, [date, distance, duration, hasHeartRate, onDate, onDistance, onDuration, onHasHeartRate]);

  // Collapsed + no active chips → bare toggle, no card chrome
  if (!expanded && activeChips.length === 0) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-accent transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        More filters
      </button>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4 space-y-3">

      {/* toggle */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-accent transition-colors"
      >
        <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>

        {expanded ? 'Less' : 'More'} filters

        {activeChips.length > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full
                           text-[9px] font-bold bg-accent text-white">
            {activeChips.length}
          </span>
        )}
      </button>

      {/* expanded filter rows */}
      {expanded && (
        <div className="pt-3 border-t border-border space-y-2.5">
          <PresetRow label="Date"     options={DATE_OPTIONS}     value={date}     onChange={onDate}     />
          <PresetRow label="Distance" options={DISTANCE_OPTIONS} value={distance} onChange={onDistance} />
          <PresetRow label="Duration" options={DURATION_OPTIONS} value={duration} onChange={onDuration} />

          {/* heart-rate toggle */}
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-xs font-medium text-text-secondary">Heart rate data only</span>
            <button
              onClick={() => onHasHeartRate(!hasHeartRate)}
              aria-label="Toggle heart rate filter"
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${hasHeartRate ? 'bg-red' : 'bg-border'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm
                                transition-transform duration-200 ${hasHeartRate ? 'translate-x-4' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* active-filter chips */}
      {activeChips.length > 0 && (
        <div className={`flex flex-wrap items-center gap-1.5 ${expanded ? 'pt-2.5 border-t border-border' : ''}`}>
          {activeChips.map(chip => (
            <span key={chip.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                         text-[11px] font-medium bg-accent/10 text-accent border border-accent/20">
              {chip.label}
              <button onClick={chip.onClear} aria-label={`Remove ${chip.label} filter`}
                className="text-accent/50 hover:text-accent transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}

          <button onClick={onClearAll} className="text-xs text-text-muted hover:text-accent transition-colors ml-1">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetRow — reusable row of mutually-exclusive chip buttons
// ---------------------------------------------------------------------------

function PresetRow<T extends string>({
  label, options, value, onChange,
}: {
  label:    string;
  options:  PresetOption<T>[];
  value:    T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-text-muted w-16 shrink-0 text-right">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => {
          const on = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all duration-150 ${
                on
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-surface text-text-secondary border border-border hover:border-border-strong hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

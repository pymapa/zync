import { useState, useMemo } from 'react';
import { isRunningActivity, isIndoorActivity, isSnowActivity } from '../../lib/utils/activityTypes';
import { ActivityStreamsGraph } from './ActivityStreamsGraph';
import { SplitsView } from './SplitsView';
import { LapsTable } from './LapsTable';
import { BestEffortsTable } from './BestEffortsTable';
import type { DetailedActivity } from '../../types';

interface Props {
  readonly activity: DetailedActivity;
}

interface Tab {
  id: string;
  label: string;
}

export function ActivityTabs({ activity }: Props) {
  const indoor = isIndoorActivity(activity.type);
  const running = isRunningActivity(activity.type);
  const snow = isSnowActivity(activity.type);

  // Build available tabs based on data
  const tabs = useMemo(() => {
    const t: Tab[] = [{ id: 'overview', label: 'Overview' }];

    // Splits: for distance-based activities, not snow
    if (!indoor && !snow && activity.splitsMetric && activity.splitsMetric.length > 0) {
      t.push({ id: 'splits', label: 'Splits' });
    }

    // Laps
    if (activity.laps && activity.laps.length > 0) {
      t.push({ id: 'laps', label: snow ? 'Runs' : 'Laps' });
    }

    // Best efforts for running
    if (running && activity.bestEfforts && activity.bestEfforts.length > 0) {
      t.push({ id: 'efforts', label: 'Best Efforts' });
    }

    return t;
  }, [activity, indoor, running, snow]);

  const [activeTab, setActiveTab] = useState('overview');

  // If only one tab, just render overview without tab bar
  if (tabs.length === 1) {
    return (
      <div>
        <ActivityStreamsGraph activity={activity} height={400} />
      </div>
    );
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/60 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-medium tracking-wide whitespace-nowrap transition-colors relative cursor-pointer ${
              activeTab === tab.id
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ animation: 'fadeIn 0.2s ease-out' }} key={activeTab}>
        {activeTab === 'overview' && (
          <ActivityStreamsGraph activity={activity} height={400} />
        )}
        {activeTab === 'splits' && <SplitsView activity={activity} />}
        {activeTab === 'laps' && <LapsTable activity={activity} />}
        {activeTab === 'efforts' && <BestEffortsTable activity={activity} />}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Spinner } from '../ui';
import { useActivityStreams } from '../../hooks/useActivityStreams';
import type { Activity, ActivityType } from '../../types';

interface ActivityStreamsGraphProps {
  readonly activity: Activity;
}

type StreamType = 'heartrate' | 'pace' | 'altitude' | 'power';

interface StreamConfig {
  key: StreamType;
  label: string;
  color: string;
  unit: string;
  yAxis: 'left' | 'right';
}

const RIDE_TYPES: ActivityType[] = [
  'Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide',
];

// Base configs — pace label/unit and power visibility resolved per-render
const BASE_CONFIGS: StreamConfig[] = [
  { key: 'heartrate', label: 'Heart Rate', color: '#EF4444', unit: 'bpm',   yAxis: 'left'  },
  { key: 'pace',      label: 'Pace',       color: '#3B82F6', unit: 'min/km', yAxis: 'right' },
  { key: 'altitude',  label: 'Elevation',  color: '#8B5CF6', unit: 'm',     yAxis: 'right' },
  { key: 'power',     label: 'Power',      color: '#F59E0B', unit: 'W',     yAxis: 'left'  },
];

export function ActivityStreamsGraph({ activity }: ActivityStreamsGraphProps) {
  const { streams, isLoading } = useActivityStreams(String(activity.id));
  const isRide = RIDE_TYPES.includes(activity.type);

  // Resolve configs: pace label/unit for rides, power only for rides
  const configs: StreamConfig[] = useMemo(() => {
    return BASE_CONFIGS
      .filter(c => c.key !== 'power' || isRide)
      .map(c =>
        c.key === 'pace'
          ? { ...c, label: isRide ? 'Speed' : 'Pace', unit: isRide ? 'km/h' : 'min/km' }
          : c
      );
  }, [isRide]);

  const available = (key: StreamType): boolean => {
    if (!streams) return false;
    if (key === 'heartrate') return !!streams.heartrate?.length;
    if (key === 'pace')      return !!streams.velocity?.length;
    if (key === 'altitude')  return !!streams.altitude?.length;
    if (key === 'power')     return !!streams.power?.length;
    return false;
  };

  const availableConfigs = configs.filter(c => available(c.key));

  // Multi-select state: defaults to heartrate if available, else first available
  const [selected, setSelected] = useState<StreamType[]>(['heartrate']);

  useEffect(() => {
    if (!streams) return;
    // Filter current selection down to what's actually available
    const still = selected.filter(s => available(s));
    if (still.length > 0) {
      setSelected(still);
    } else {
      // Nothing available from current selection — pick first available
      const first = availableConfigs[0]?.key;
      if (first) setSelected([first]);
    }
  }, [streams]);

  const toggleStream = (key: StreamType) => {
    setSelected(prev => {
      const has = prev.includes(key);
      if (has && prev.length === 1) return prev; // keep at least one
      return has ? prev.filter(s => s !== key) : [...prev, key];
    });
  };

  // --- chart data: one key per selected stream ---
  const chartData = useMemo(() => {
    if (!streams?.time?.length) return [];

    return streams.time.map((t, i) => {
      const point: Record<string, number> = { time: t };

      for (const key of selected) {
        let raw: number | null = null;
        switch (key) {
          case 'heartrate': raw = streams.heartrate?.[i] ?? null; break;
          case 'pace':      raw = streams.velocity?.[i]  ?? null; break;
          case 'altitude':  raw = streams.altitude?.[i]  ?? null; break;
          case 'power':     raw = streams.power?.[i]     ?? null; break;
        }
        if (raw == null) continue;

        if (key === 'pace' && raw > 0) {
          raw = isRide ? raw * 3.6 : (1000 / 60) / raw;
        }
        point[key] = Math.round(raw * 10) / 10;
      }

      return point;
    });
  }, [streams, selected, isRide]);

  // --- formatters ---
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (value: number) => {
    const mins = Math.floor(value);
    const secs = Math.round((value - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Which axes are in use
  const hasLeft  = selected.some(s => configs.find(c => c.key === s)?.yAxis === 'left');
  const hasRight = selected.some(s => configs.find(c => c.key === s)?.yAxis === 'right');
  const hasPaceRunning = selected.includes('pace') && !isRide;

  // Axis tick formatters
  const leftFormatter  = (value: number) => value.toFixed(0);
  const rightFormatter = (value: number) => {
    // If running pace is the only right-axis stream, format as M:SS
    if (hasPaceRunning && selected.filter(s => configs.find(c => c.key === s)?.yAxis === 'right').length === 1) {
      return formatPace(value);
    }
    return value.toFixed(0);
  };

  // --- loading / empty states ---
  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-center h-64">
          <Spinner size="md" className="text-accent" />
        </div>
      </div>
    );
  }

  if (availableConfigs.length === 0) {
    return null;
  }

  // Tooltip formatter: per-dataKey
  const tooltipFormatter = (value: number, name: string) => {
    const cfg = configs.find(c => c.label === name);
    if (!cfg) return [value, name];
    if (cfg.key === 'pace' && !isRide) {
      return [`${formatPace(value)} ${cfg.unit}`, cfg.label];
    }
    return [`${value.toFixed(1)} ${cfg.unit}`, cfg.label];
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest">Activity Data</h3>

        {/* Toggle pills */}
        <div className="flex items-center gap-1.5">
          {availableConfigs.map(cfg => {
            const on = selected.includes(cfg.key);
            return (
              <button
                key={cfg.key}
                onClick={() => toggleStream(cfg.key)}
                className="relative flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-150"
                style={{
                  backgroundColor: on ? `${cfg.color}18` : 'transparent',
                  color: on ? cfg.color : '#9CA3AF',
                  border: `1.5px solid ${on ? cfg.color : '#E5E7EB'}`,
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-surface rounded-lg p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke="#9CA3AF"
              style={{ fontSize: '12px' }}
            />
            {hasLeft && (
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                tickFormatter={leftFormatter}
              />
            )}
            {hasRight && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                tickFormatter={rightFormatter}
                reversed={hasPaceRunning && selected.filter(s => configs.find(c => c.key === s)?.yAxis === 'right').length === 1}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                fontSize: '12px',
              }}
              labelFormatter={(label) => `Time: ${formatTime(label as number)}`}
              formatter={tooltipFormatter}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />

            {selected.map(key => {
              const cfg = configs.find(c => c.key === key);
              if (!cfg) return null;
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  yAxisId={cfg.yAxis}
                  stroke={cfg.color}
                  strokeWidth={2}
                  dot={false}
                  name={cfg.label}
                  animationDuration={500}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

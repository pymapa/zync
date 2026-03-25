import { StravaIcon, GarminIcon, IntervalsIcon } from '../icons';
import type { ReactNode } from 'react';

interface Link {
  name: string;
  url: string;
  icon: ReactNode;
  description: string;
}

export function QuickLinks() {
  const links: Link[] = [
    {
      name: 'Strava',
      url: 'https://www.strava.com',
      icon: <StravaIcon className="w-5 h-5" />,
      description: 'Activity feed',
    },
    {
      name: 'Intervals.icu',
      url: 'https://intervals.icu',
      icon: <IntervalsIcon className="w-5 h-5" />,
      description: 'Training analytics',
    },
    {
      name: 'Garmin Connect',
      url: 'https://connect.garmin.com',
      icon: <GarminIcon className="w-5 h-5" />,
      description: 'Device sync',
    },
  ];

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-4">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
        Platforms
      </h3>
      <div className="space-y-2">
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface transition-colors group"
          >
            <span className="flex-shrink-0 text-text-secondary group-hover:text-accent transition-all group-hover:scale-110">
              {link.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                {link.name}
              </div>
              <div className="text-xs text-text-muted">
                {link.description}
              </div>
            </div>
            <svg
              className="w-4 h-4 text-text-muted group-hover:text-accent transition-all group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}

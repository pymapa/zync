import { CATEGORIES } from './ActivityFilters';
import type { CategoryId } from './ActivityFilters';

interface ActivitySearchBarProps {
  readonly search:     string;
  readonly category:   CategoryId;
  readonly onSearch:   (v: string)     => void;
  readonly onCategory: (v: CategoryId) => void;
}

export function ActivitySearchBar({
  search, category, onSearch, onCategory,
}: ActivitySearchBarProps) {
  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative flex items-center bg-card border border-border rounded-xl px-3 py-2 focus-within:border-accent/40 transition-colors duration-200">
        <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <input
          type="text"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search activities…"
          className="ml-2 flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none focus-visible:outline-none"
        />

        {search && (
          <button
            onClick={() => onSearch('')}
            aria-label="Clear search"
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => {
          const active = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 border ${
                active
                  ? 'text-white shadow-sm border-transparent'
                  : 'bg-surface text-text-secondary border-border hover:border-border-strong hover:text-text-primary'
              }`}
              style={active ? { backgroundColor: cat.color } : undefined}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

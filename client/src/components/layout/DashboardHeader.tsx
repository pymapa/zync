import { Link } from 'react-router-dom';
import { RefreshIcon } from '../icons';
import { ROUTES } from '../../lib/utils/routes';

interface DashboardHeaderProps {
  readonly userName: string;
  readonly onRefresh: () => void;
  readonly onLogout: () => void;
}

export function DashboardHeader({
  userName,
  onRefresh,
  onLogout,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link
          to={ROUTES.DASHBOARD}
          className="text-xl font-bold text-accent hover:opacity-80 transition-opacity"
        >
          ZYNC
        </Link>
        <div className="flex items-center gap-4">
          <button
            onClick={onRefresh}
            className="text-text-muted hover:text-accent transition-colors p-2 rounded-lg hover:bg-surface"
            title="Refresh data"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
          <span className="text-text-secondary text-sm font-medium">
            {userName}
          </span>
          <button
            onClick={onLogout}
            className="text-text-muted hover:text-red transition-colors text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

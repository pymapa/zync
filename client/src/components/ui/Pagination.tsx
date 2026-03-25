const PER_PAGE_OPTIONS = [10, 30, 50] as const;

interface PaginationProps {
  readonly currentPage: number;
  readonly hasMore: boolean;
  readonly perPage: number;
  readonly totalDisplayed: number;
  readonly totalPages?: number;
  readonly onPageChange: (page: number) => void;
  readonly onPerPageChange?: (perPage: number) => void;
  readonly isLoading?: boolean;
}

export function Pagination({
  currentPage,
  hasMore,
  perPage,
  totalDisplayed,
  totalPages,
  onPageChange,
  onPerPageChange,
  isLoading = false,
}: PaginationProps) {
  const startItem = (currentPage - 1) * perPage + 1;
  const endItem = (currentPage - 1) * perPage + totalDisplayed;

  const handlePerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPerPage = Number(e.target.value);
    onPerPageChange?.(newPerPage);
  };

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const lastPage = totalPages;

    pages.push(1);

    if (currentPage > 3) {
      pages.push('ellipsis');
    }

    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && (!lastPage || i < lastPage)) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
    }

    if (lastPage) {
      const lastShown = pages[pages.length - 1];
      if (typeof lastShown === 'number' && lastShown < lastPage - 1) {
        pages.push('ellipsis');
      }
      if (!pages.includes(lastPage)) {
        pages.push(lastPage);
      }
    } else if (hasMore) {
      pages.push('ellipsis');
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  const PageButton = ({ page }: { page: number }) => {
    const isActive = page === currentPage;
    const isDisabled = isLoading || (page > currentPage && !hasMore && !totalPages);

    return (
      <button
        onClick={() => !isDisabled && onPageChange(page)}
        disabled={isDisabled}
        className={`
          w-8 h-8 text-xs font-semibold rounded-lg transition-colors
          ${isActive
            ? 'bg-accent text-white'
            : 'text-text-secondary hover:bg-surface hover:text-text-primary'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {page}
      </button>
    );
  };

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-surface rounded-b-xl">
      <div className="flex items-center gap-4 text-xs text-text-muted">
        {totalDisplayed > 0 ? (
          <>
            Showing <span className="text-accent font-semibold">{startItem}</span> – <span className="text-accent font-semibold">{endItem}</span>
          </>
        ) : (
          <span>No results</span>
        )}

        {onPerPageChange && (
          <div className="flex items-center gap-2">
            <span>per page:</span>
            <select
              value={perPage}
              onChange={handlePerPageChange}
              disabled={isLoading}
              className="bg-card text-text-primary text-xs px-2 py-1 border border-border rounded-md focus:outline-none focus:border-accent disabled:opacity-50 cursor-pointer"
            >
              {PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        {pageNumbers.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="w-8 h-8 flex items-center justify-center text-text-muted">
              …
            </span>
          ) : (
            <PageButton key={item} page={item} />
          )
        )}
      </div>
    </div>
  );
}

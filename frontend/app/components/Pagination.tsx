import { Button } from '~/components/Button';
import { useLanguage } from '~/providers/LanguageProvider';

interface PaginationProps {
  page: number;
  total: number;
  resultsPerPage: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

// Example usage of the Pagination component:

/*
import { useState } from 'react';
import { Pagination } from '~/components/Pagination';

function ExamplePaginationUsage() {
  const [page, setPage] = useState(1);
  const [total] = useState(100);
  const [resultsPerPage] = useState(10);
  const [loading] = useState(false);

  function fetchNewPage(newPage: number) {
    // ...
  }

  return (
    <Pagination
      page={page}
      total={total}
      resultsPerPage={resultsPerPage}
      onPageChange={(newPage) => fetchNewPage(newPage)}
      disabled={loading}
    />
  );
}
*/

export function Pagination({ page, total, resultsPerPage, onPageChange, disabled = false }: PaginationProps) {
  const { t } = useLanguage();
  const totalPages = Math.ceil(total / resultsPerPage);
  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages, page + 1);
  const pageNumbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  if (total <= 0) return null;

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
      <p className="text-sm text-muted">
        {t('pagination.showing')} {(page - 1) * resultsPerPage + 1}-{Math.min(page * resultsPerPage, total)}{' '}
        {t('pagination.of')} {total}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 && (
          <Button
            variant="tertiary"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled}
          >
            {t('pagination.prev')}
          </Button>
        )}
        {start > 1 && <span className="px-2 text-muted">…</span>}
        {pageNumbers.map((pageNum) => (
          <Button
            key={pageNum}
            variant={page === pageNum ? 'primary' : 'tertiary'}
            onClick={() => onPageChange(pageNum)}
            disabled={disabled}
            className="min-w-[2.25rem]"
          >
            {pageNum}
          </Button>
        ))}
        {end < totalPages && <span className="px-2 text-muted">…</span>}
        {page < totalPages && (
          <Button
            variant="tertiary"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled}
          >
            {t('pagination.next')}
          </Button>
        )}
      </div>
    </div>
  );
}

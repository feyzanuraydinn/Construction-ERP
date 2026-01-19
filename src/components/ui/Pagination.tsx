import React, { memo } from 'react';
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
  pageNumbers: number[];
  canPrevPage: boolean;
  canNextPage: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  /** Always show pagination even if only one page */
  alwaysShow?: boolean;
  className?: string;
}

export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  startIndex,
  endIndex,
  pageNumbers,
  canPrevPage,
  canNextPage,
  onPageChange,
  onPageSizeChange,
  onFirstPage,
  onLastPage,
  onPrevPage,
  onNextPage,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector = true,
  alwaysShow = true,
  className = '',
}: PaginationProps) {
  // Hide pagination if total items is 0 (or if alwaysShow is false and only one page)
  if (totalItems === 0) {
    return null;
  }
  if (!alwaysShow && totalItems <= pageSize) {
    return null;
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border-t border-gray-200 ${className}`}
    >
      {/* Left side - empty for spacing (same width as right side for centering) */}
      <div className="hidden sm:flex sm:items-center sm:gap-4 sm:invisible">
        <span className="text-sm">0 - 0 / 0 kayıt</span>
        {showPageSizeSelector && (
          <select className="px-2 py-1 border rounded-md text-sm">
            <option>10</option>
          </select>
        )}
      </div>

      {/* Center - pagination controls */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          onClick={onFirstPage}
          disabled={!canPrevPage}
          className={`p-2 rounded-md transition-colors ${
            canPrevPage
              ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title="İlk Sayfa"
        >
          <FiChevronsLeft size={18} />
        </button>

        {/* Previous page */}
        <button
          onClick={onPrevPage}
          disabled={!canPrevPage}
          className={`p-2 rounded-md transition-colors ${
            canPrevPage
              ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Önceki Sayfa"
        >
          <FiChevronLeft size={18} />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-2">
          {pageNumbers[0] > 1 && (
            <>
              <PageButton page={1} currentPage={currentPage} onClick={onPageChange} />
              {pageNumbers[0] > 2 && <span className="px-2 text-gray-400">...</span>}
            </>
          )}

          {pageNumbers.map((page) => (
            <PageButton key={page} page={page} currentPage={currentPage} onClick={onPageChange} />
          ))}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                <span className="px-2 text-gray-400">...</span>
              )}
              <PageButton page={totalPages} currentPage={currentPage} onClick={onPageChange} />
            </>
          )}
        </div>

        {/* Next page */}
        <button
          onClick={onNextPage}
          disabled={!canNextPage}
          className={`p-2 rounded-md transition-colors ${
            canNextPage
              ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Sonraki Sayfa"
        >
          <FiChevronRight size={18} />
        </button>

        {/* Last page */}
        <button
          onClick={onLastPage}
          disabled={!canNextPage}
          className={`p-2 rounded-md transition-colors ${
            canNextPage
              ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Son Sayfa"
        >
          <FiChevronsRight size={18} />
        </button>
      </div>

      {/* Right side - info and page size */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>
          <span className="font-medium">{startIndex + 1}</span>
          {' - '}
          <span className="font-medium">{endIndex}</span>
          {' / '}
          <span className="font-medium">{totalItems}</span>
          {' kayıt'}
        </span>

        {showPageSizeSelector && onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
});

interface PageButtonProps {
  page: number;
  currentPage: number;
  onClick: (page: number) => void;
}

const PageButton = memo(function PageButton({ page, currentPage, onClick }: PageButtonProps) {
  const isActive = page === currentPage;

  return (
    <button
      onClick={() => onClick(page)}
      className={`min-w-[32px] h-8 px-2 rounded-md text-sm font-medium transition-colors ${
        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {page}
    </button>
  );
});

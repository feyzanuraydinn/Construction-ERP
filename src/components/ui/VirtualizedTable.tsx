import React, { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualColumn<T> {
  key: string;
  header: string;
  width?: string;
  minWidth?: string;
  render: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: VirtualColumn<T>[];
  rowHeight?: number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  emptyMessage?: string;
  getRowKey: (item: T, index: number) => string | number;
  maxHeight?: string;
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 52,
  className = '',
  onRowClick,
  emptyMessage = 'Veri bulunamadı',
  getRowKey,
  maxHeight = '600px',
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10, // Render 10 extra rows above/below viewport
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Grid template for columns
  const gridTemplate = useMemo(() => {
    return columns.map((col) => col.width || '1fr').join(' ');
  }, [columns]);

  if (data.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
        {/* Header */}
        <div
          className="grid border-b border-gray-200 bg-gray-50 sticky top-0 z-10"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className || ''}`}
              style={{ minWidth: col.minWidth }}
            >
              {col.header}
            </div>
          ))}
        </div>
        {/* Empty state */}
        <div className="flex items-center justify-center py-12 text-gray-500">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Header - sticky */}
      <div
        className="grid border-b border-gray-200 bg-gray-50 sticky top-0 z-10"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className || ''}`}
            style={{ minWidth: col.minWidth }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtualized rows container */}
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const item = data[virtualItem.index];
            const rowKey = getRowKey(item, virtualItem.index);

            return (
              <div
                key={rowKey}
                data-index={virtualItem.index}
                ref={rowVirtualizer.measureElement}
                className={`grid border-b border-gray-100 hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                style={{
                  gridTemplateColumns: gridTemplate,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${rowHeight}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                onClick={() => onRowClick?.(item, virtualItem.index)}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={`px-4 py-3 flex items-center text-sm text-gray-900 ${col.className || ''}`}
                    style={{ minWidth: col.minWidth }}
                  >
                    {col.render(item, virtualItem.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for easy virtualized table setup
 */
export function useVirtualizedTable<T>(
  data: T[],
  options?: {
    rowHeight?: number;
    overscan?: number;
  }
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { rowHeight = 52, overscan = 10 } = options || {};

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}

export default VirtualizedTable;

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination, paginateArray } from '../../hooks/usePagination';

describe('paginateArray Helper', () => {
  const testArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('should return first page items', () => {
    const result = paginateArray(testArray, 1, 3);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should return second page items', () => {
    const result = paginateArray(testArray, 2, 3);
    expect(result).toEqual([4, 5, 6]);
  });

  it('should return last page with remaining items', () => {
    const result = paginateArray(testArray, 4, 3);
    expect(result).toEqual([10]);
  });

  it('should return empty array for page beyond data', () => {
    const result = paginateArray(testArray, 10, 3);
    expect(result).toEqual([]);
  });

  it('should handle page size larger than array', () => {
    const result = paginateArray(testArray, 1, 20);
    expect(result).toEqual(testArray);
  });

  it('should handle empty array', () => {
    const result = paginateArray([], 1, 10);
    expect(result).toEqual([]);
  });

  it('should work with objects', () => {
    const objects = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ];
    const result = paginateArray(objects, 1, 2);
    expect(result).toEqual([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
  });
});

describe('usePagination Hook', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePagination(100));

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.totalItems).toBe(100);
    expect(result.current.totalPages).toBe(10);
  });

  it('should initialize with custom page size', () => {
    const { result } = renderHook(() => usePagination(100, 20));

    expect(result.current.pageSize).toBe(20);
    expect(result.current.totalPages).toBe(5);
  });

  it('should initialize with custom initial page', () => {
    const { result } = renderHook(() => usePagination(100, 10, 3));

    expect(result.current.currentPage).toBe(3);
  });

  describe('Navigation', () => {
    it('should go to next page', () => {
      const { result } = renderHook(() => usePagination(100));

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(2);
    });

    it('should not go beyond last page', () => {
      const { result } = renderHook(() => usePagination(25, 10, 3));

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.currentPage).toBe(3);
    });

    it('should go to previous page', () => {
      const { result } = renderHook(() => usePagination(100, 10, 5));

      act(() => {
        result.current.prevPage();
      });

      expect(result.current.currentPage).toBe(4);
    });

    it('should not go before first page', () => {
      const { result } = renderHook(() => usePagination(100));

      act(() => {
        result.current.prevPage();
      });

      expect(result.current.currentPage).toBe(1);
    });

    it('should go to specific page', () => {
      const { result } = renderHook(() => usePagination(100));

      act(() => {
        result.current.goToPage(5);
      });

      expect(result.current.currentPage).toBe(5);
    });

    it('should clamp page to valid range', () => {
      const { result } = renderHook(() => usePagination(100));

      act(() => {
        result.current.goToPage(15);
      });

      expect(result.current.currentPage).toBe(10);

      act(() => {
        result.current.goToPage(0);
      });

      expect(result.current.currentPage).toBe(1);

      act(() => {
        result.current.goToPage(-5);
      });

      expect(result.current.currentPage).toBe(1);
    });

    it('should go to first page', () => {
      const { result } = renderHook(() => usePagination(100, 10, 5));

      act(() => {
        result.current.goToFirst();
      });

      expect(result.current.currentPage).toBe(1);
    });

    it('should go to last page', () => {
      const { result } = renderHook(() => usePagination(100, 10, 1));

      act(() => {
        result.current.goToLast();
      });

      expect(result.current.currentPage).toBe(10);
    });
  });

  describe('Page Size Changes', () => {
    it('should change page size', () => {
      const { result } = renderHook(() => usePagination(100));

      act(() => {
        result.current.setPageSize(25);
      });

      expect(result.current.pageSize).toBe(25);
      expect(result.current.totalPages).toBe(4);
    });

    it('should reset to first page when page size changes', () => {
      const { result } = renderHook(() => usePagination(100, 10, 5));

      act(() => {
        result.current.setPageSize(25);
      });

      expect(result.current.currentPage).toBe(1);
    });
  });

  describe('Computed Values', () => {
    it('should calculate start index correctly', () => {
      const { result } = renderHook(() => usePagination(100, 10, 3));
      expect(result.current.startIndex).toBe(20);
    });

    it('should calculate end index correctly', () => {
      const { result } = renderHook(() => usePagination(100, 10, 3));
      expect(result.current.endIndex).toBe(30);
    });

    it('should calculate end index for last page correctly', () => {
      const { result } = renderHook(() => usePagination(95, 10, 10));
      expect(result.current.endIndex).toBe(95);
    });

    it('should identify first page', () => {
      const { result } = renderHook(() => usePagination(100));
      expect(result.current.isFirstPage).toBe(true);
      expect(result.current.isLastPage).toBe(false);
    });

    it('should identify last page', () => {
      const { result } = renderHook(() => usePagination(100, 10, 10));
      expect(result.current.isFirstPage).toBe(false);
      expect(result.current.isLastPage).toBe(true);
    });

    it('should check if has next page', () => {
      const { result } = renderHook(() => usePagination(100, 10, 5));
      expect(result.current.hasNextPage).toBe(true);

      act(() => {
        result.current.goToLast();
      });

      expect(result.current.hasNextPage).toBe(false);
    });

    it('should check if has previous page', () => {
      const { result } = renderHook(() => usePagination(100, 10, 5));
      expect(result.current.hasPrevPage).toBe(true);

      act(() => {
        result.current.goToFirst();
      });

      expect(result.current.hasPrevPage).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero total items', () => {
      const { result } = renderHook(() => usePagination(0));

      expect(result.current.totalPages).toBe(0);
      expect(result.current.currentPage).toBe(1);
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(0);
    });

    it('should handle single item', () => {
      const { result } = renderHook(() => usePagination(1));

      expect(result.current.totalPages).toBe(1);
      expect(result.current.isFirstPage).toBe(true);
      expect(result.current.isLastPage).toBe(true);
    });

    it('should recalculate when total items changes', () => {
      const { result, rerender } = renderHook(
        ({ total }) => usePagination(total, 10, 5),
        { initialProps: { total: 100 } }
      );

      expect(result.current.totalPages).toBe(10);

      rerender({ total: 50 });

      expect(result.current.totalPages).toBe(5);
      // Should stay on page 5 if still valid
      expect(result.current.currentPage).toBe(5);
    });

    it('should adjust current page when it becomes invalid', () => {
      const { result, rerender } = renderHook(
        ({ total }) => usePagination(total, 10, 10),
        { initialProps: { total: 100 } }
      );

      expect(result.current.currentPage).toBe(10);

      rerender({ total: 30 });

      // Page 10 is now invalid, should adjust
      expect(result.current.totalPages).toBe(3);
    });
  });
});

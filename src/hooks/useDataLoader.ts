/**
 * Data Loading Hooks
 *
 * Provides hooks for fetching async data with loading/error states.
 * Handles the common pattern of loading data on component mount.
 *
 * @module useDataLoader
 *
 * @example
 * ```tsx
 * // Single data source
 * const { data: companies, loading, error, reload } = useDataLoader(
 *   () => window.api.company.getAll()
 * );
 *
 * // Multiple data sources
 * const { data, loading } = useMultiDataLoader({
 *   companies: () => window.api.company.getAll(),
 *   projects: () => window.api.project.getAll(),
 * });
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

/** Result returned by useDataLoader hook */
interface UseDataLoaderResult<T> {
  /** The fetched data (null while loading or on error) */
  data: T | null;
  /** Whether the data is currently being fetched */
  loading: boolean;
  /** Error if the fetch failed */
  error: Error | null;
  /** Function to manually trigger a reload */
  reload: () => void;
}

/**
 * Hook for loading async data with automatic state management
 *
 * @param fetchFn - Async function that fetches the data
 * @param deps - Dependencies that trigger a refetch when changed
 * @returns Object containing data, loading state, error, and reload function
 */
export function useDataLoader<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList = []
): UseDataLoaderResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFnRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      logger.error('Data loading error', 'useDataLoader', err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // deps passed externally for flexibility
  }, [load, ...deps]);

  return { data, loading, error, reload: load };
}

/** Result returned by useMultiDataLoader hook */
interface UseMultiDataLoaderResult<T extends Record<string, unknown>> {
  /** Object containing all fetched data keyed by fetcher name */
  data: T;
  /** Whether any data is currently being fetched */
  loading: boolean;
  /** Error if any fetch failed */
  error: Error | null;
  /** Function to manually trigger a reload of all data */
  reload: () => void;
}

/**
 * Hook for loading multiple async data sources in parallel
 *
 * @param fetchers - Object mapping keys to fetch functions
 * @param deps - Dependencies that trigger a refetch when changed
 * @returns Object containing all data, loading state, error, and reload function
 */
export function useMultiDataLoader<T extends Record<string, unknown>>(
  fetchers: { [K in keyof T]: () => Promise<T[K]> },
  deps: React.DependencyList = []
): UseMultiDataLoaderResult<T> {
  const [data, setData] = useState<T>({} as T);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchersRef = useRef(fetchers);
  fetchersRef.current = fetchers;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const keys = Object.keys(fetchersRef.current) as (keyof T)[];
      const promises = keys.map((key) => fetchersRef.current[key]());
      const results = await Promise.all(promises);

      const newData = {} as T;
      keys.forEach((key, index) => {
        newData[key] = results[index];
      });
      setData(newData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      logger.error('Multi data loading error', 'useMultiDataLoader', err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // deps passed externally for flexibility
  }, [load, ...deps]);

  return { data, loading, error, reload: load };
}

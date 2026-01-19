export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export { useDebounce } from './useDebounce';
export { useDataLoader, useMultiDataLoader } from './useDataLoader';
export { useFormValidation } from './useFormValidation';
export { usePagination, paginateArray } from './usePagination';
export {
  useDataCache,
  useMultiDataCache,
  invalidateCache,
  invalidateCachePattern,
  clearAllCache,
} from './useDataCache';

// TanStack Query hooks
export {
  // Query hooks
  useCompanies,
  useCompany,
  useProjects,
  useProject,
  useTransactions,
  useMaterials,
  useLowStockMaterials,
  useDashboardStats,
  useMonthlyStats,
  useTopDebtors,
  useTopCreditors,
  useCategories,
  useTrash,
  // Mutation hooks
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useCreateMaterial,
  useCreateStockMovement,
  useRestoreFromTrash,
  // Query client
  createQueryClient,
  QueryClientProvider,
  useQueryClient,
  queryKeys,
  // Types
  type TransactionFilters,
  type StockMovementFilters,
} from './useQuery';

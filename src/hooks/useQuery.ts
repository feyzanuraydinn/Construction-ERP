/**
 * TanStack Query Hooks
 *
 * Custom hooks built on TanStack Query for data fetching and caching.
 * These hooks provide automatic caching, background refetching, and
 * optimistic updates for the ERP application.
 *
 * @module useQuery
 *
 * @example
 * ```typescript
 * // Fetching companies
 * const { data: companies, isLoading } = useCompanies();
 *
 * // Fetching with filters
 * const { data: transactions } = useTransactions({ company_id: 1 });
 *
 * // Mutations
 * const createCompany = useCreateCompany();
 * createCompany.mutate({ name: 'Acme Corp', type: 'company' });
 * ```
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import type {
  CompanyWithBalance,
  Company,
  CompanyFormData,
  ProjectWithSummary,
  Project,
  ProjectFormData,
  TransactionWithDetails,
  Transaction,
  TransactionFormData,
  TransactionFilters,
  Material,
  MaterialFormData,
  StockMovementFormData,
  StockMovementFilters,
  Category,
  TrashItem,
  DashboardStats,
  DebtorCreditor,
  MonthlyStats,
} from '../types';

// Query keys for cache management
export const queryKeys = {
  // Companies
  companies: ['companies'] as const,
  companiesWithBalance: ['companies', 'withBalance'] as const,
  company: (id: number) => ['companies', id] as const,

  // Projects
  projects: ['projects'] as const,
  projectsWithSummary: ['projects', 'withSummary'] as const,
  project: (id: number) => ['projects', id] as const,
  projectParties: (id: number) => ['projects', id, 'parties'] as const,

  // Transactions
  transactions: (filters?: TransactionFilters) => ['transactions', filters ?? {}] as const,
  transactionsByCompany: (companyId: number) => ['transactions', { company_id: companyId }] as const,
  transactionsByProject: (projectId: number) => ['transactions', { project_id: projectId }] as const,

  // Materials
  materials: ['materials'] as const,
  material: (id: number) => ['materials', id] as const,
  lowStockMaterials: ['materials', 'lowStock'] as const,
  stockMovements: (filters?: StockMovementFilters) => ['stockMovements', filters ?? {}] as const,

  // Categories
  categories: (type?: string) => ['categories', type ?? 'all'] as const,

  // Analytics
  dashboardStats: ['analytics', 'dashboard'] as const,
  monthlyStats: (year: number) => ['analytics', 'monthly', year] as const,
  topDebtors: ['analytics', 'topDebtors'] as const,
  topCreditors: ['analytics', 'topCreditors'] as const,

  // Trash
  trash: ['trash'] as const,
};

// Re-export filter types from types module
export type { TransactionFilters, StockMovementFilters };

// ==================== COMPANY HOOKS ====================

/**
 * Fetch all companies with their balances
 */
export function useCompanies(options?: Omit<UseQueryOptions<CompanyWithBalance[], Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.companiesWithBalance,
    queryFn: () => window.electronAPI.company.getWithBalance(),
    staleTime: 30000, // 30 seconds
    ...options,
  });
}

/**
 * Fetch a single company by ID
 */
export function useCompany(id: number, options?: Omit<UseQueryOptions<Company | undefined, Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.company(id),
    queryFn: () => window.electronAPI.company.getById(id),
    enabled: id > 0,
    ...options,
  });
}

/**
 * Create a new company
 */
export function useCreateCompany(options?: UseMutationOptions<Company, Error, CompanyFormData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CompanyFormData) => window.electronAPI.company.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    },
    ...options,
  });
}

/**
 * Update a company
 */
export function useUpdateCompany(options?: UseMutationOptions<Company, Error, { id: number; data: CompanyFormData }>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CompanyFormData }) =>
      window.electronAPI.company.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
      queryClient.invalidateQueries({ queryKey: queryKeys.company(variables.id) });
    },
    ...options,
  });
}

/**
 * Delete a company
 */
export function useDeleteCompany(options?: UseMutationOptions<{ success: boolean }, Error, number>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => window.electronAPI.company.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.trash });
    },
    ...options,
  });
}

// ==================== PROJECT HOOKS ====================

/**
 * Fetch all projects with summary
 */
export function useProjects(options?: Omit<UseQueryOptions<ProjectWithSummary[], Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.projectsWithSummary,
    queryFn: () => window.electronAPI.project.getWithSummary(),
    staleTime: 30000,
    ...options,
  });
}

/**
 * Fetch a single project by ID
 */
export function useProject(id: number, options?: Omit<UseQueryOptions<ProjectWithSummary | undefined, Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => window.electronAPI.project.getById(id),
    enabled: id > 0,
    ...options,
  });
}

/**
 * Create a new project
 */
export function useCreateProject(options?: UseMutationOptions<Project, Error, ProjectFormData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProjectFormData) => window.electronAPI.project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    },
    ...options,
  });
}

/**
 * Update a project
 */
export function useUpdateProject(options?: UseMutationOptions<Project, Error, { id: number; data: ProjectFormData }>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProjectFormData }) =>
      window.electronAPI.project.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(variables.id) });
    },
    ...options,
  });
}

/**
 * Delete a project
 */
export function useDeleteProject(options?: UseMutationOptions<{ success: boolean }, Error, number>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => window.electronAPI.project.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.trash });
    },
    ...options,
  });
}

// ==================== TRANSACTION HOOKS ====================

/**
 * Fetch transactions with optional filters
 */
export function useTransactions(
  filters?: TransactionFilters,
  options?: Omit<UseQueryOptions<TransactionWithDetails[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => window.electronAPI.transaction.getAll(filters),
    staleTime: 15000, // 15 seconds
    ...options,
  });
}

/**
 * Create a new transaction
 */
export function useCreateTransaction(options?: UseMutationOptions<Transaction, Error, TransactionFormData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TransactionFormData) => window.electronAPI.transaction.create(data),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });

      if (variables.company_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.companies });
        queryClient.invalidateQueries({ queryKey: queryKeys.company(Number(variables.company_id)) });
      }
      if (variables.project_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects });
        queryClient.invalidateQueries({ queryKey: queryKeys.project(Number(variables.project_id)) });
      }
    },
    ...options,
  });
}

/**
 * Update a transaction
 */
export function useUpdateTransaction(options?: UseMutationOptions<Transaction, Error, { id: number; data: TransactionFormData }>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TransactionFormData }) =>
      window.electronAPI.transaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    },
    ...options,
  });
}

/**
 * Delete a transaction
 */
export function useDeleteTransaction(options?: UseMutationOptions<{ success: boolean }, Error, number>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => window.electronAPI.transaction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.trash });
    },
    ...options,
  });
}

// ==================== MATERIAL HOOKS ====================

/**
 * Fetch all materials
 */
export function useMaterials(options?: Omit<UseQueryOptions<Material[], Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.materials,
    queryFn: () => window.electronAPI.material.getAll(),
    staleTime: 30000,
    ...options,
  });
}

/**
 * Fetch low stock materials
 */
export function useLowStockMaterials(options?: Omit<UseQueryOptions<Material[], Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.lowStockMaterials,
    queryFn: () => window.electronAPI.material.getLowStock(),
    staleTime: 60000, // 1 minute
    ...options,
  });
}

/**
 * Create a new material
 */
export function useCreateMaterial(options?: UseMutationOptions<Material, Error, MaterialFormData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MaterialFormData) => window.electronAPI.material.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materials });
      queryClient.invalidateQueries({ queryKey: queryKeys.lowStockMaterials });
    },
    ...options,
  });
}

/**
 * Create a stock movement
 */
export function useCreateStockMovement(options?: UseMutationOptions<unknown, Error, StockMovementFormData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StockMovementFormData) => window.electronAPI.stock.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materials });
      queryClient.invalidateQueries({ queryKey: queryKeys.lowStockMaterials });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    },
    ...options,
  });
}

// ==================== ANALYTICS HOOKS ====================

/**
 * Fetch dashboard statistics
 */
export function useDashboardStats(options?: Omit<UseQueryOptions<DashboardStats, Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => window.electronAPI.dashboard.getStats(),
    staleTime: 10000, // 10 seconds
    refetchInterval: 60000, // Refetch every minute
    ...options,
  });
}

/**
 * Fetch monthly statistics
 */
export function useMonthlyStats(
  year: number,
  options?: Omit<UseQueryOptions<MonthlyStats[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.monthlyStats(year),
    queryFn: () => window.electronAPI.analytics.getMonthlyStats(year),
    staleTime: 60000,
    ...options,
  });
}

/**
 * Fetch top debtors
 */
export function useTopDebtors(limit = 5, options?: Omit<UseQueryOptions<DebtorCreditor[], Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.topDebtors,
    queryFn: () => window.electronAPI.dashboard.getTopDebtors(limit),
    staleTime: 30000,
    ...options,
  });
}

/**
 * Fetch top creditors
 */
export function useTopCreditors(limit = 5, options?: Omit<UseQueryOptions<DebtorCreditor[], Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.topCreditors,
    queryFn: () => window.electronAPI.dashboard.getTopCreditors(limit),
    staleTime: 30000,
    ...options,
  });
}

// ==================== CATEGORY HOOKS ====================

/**
 * Fetch categories by type
 */
export function useCategories(
  type?: string,
  options?: Omit<UseQueryOptions<Category[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.categories(type),
    queryFn: () => window.electronAPI.category.getAll(type),
    staleTime: 300000, // 5 minutes (categories rarely change)
    ...options,
  });
}

// ==================== TRASH HOOKS ====================

/**
 * Fetch trash items
 */
export function useTrash(options?: Omit<UseQueryOptions<TrashItem[], Error>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: queryKeys.trash,
    queryFn: () => window.electronAPI.trash.getAll(),
    staleTime: 30000,
    ...options,
  });
}

/**
 * Restore from trash
 */
export function useRestoreFromTrash(options?: UseMutationOptions<{ success: boolean; error?: string }, Error, number>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trashId: number) => window.electronAPI.trash.restore(trashId),
    onSuccess: () => {
      // Invalidate all major queries as we don't know what type was restored
      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.materials });
      queryClient.invalidateQueries({ queryKey: queryKeys.trash });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    },
    ...options,
  });
}

// ==================== QUERY CLIENT SETUP ====================

/**
 * Create a configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 30000, // 30 seconds default
        gcTime: 300000, // 5 minutes (formerly cacheTime)
        refetchOnWindowFocus: false, // Electron app doesn't need this
        refetchOnReconnect: false, // Local database doesn't need this
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

// Re-export for convenience
export { QueryClientProvider, useQueryClient };
export type { QueryClient };

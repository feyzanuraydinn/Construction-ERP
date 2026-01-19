/**
 * Database Repositories
 *
 * This module exports all repository classes for database operations.
 * Repositories provide a clean abstraction layer over raw SQL queries.
 *
 * @module repositories
 *
 * @example
 * ```typescript
 * import { CompanyRepository, ProjectRepository } from './repositories';
 *
 * const companyRepo = new CompanyRepository(db);
 * const companies = companyRepo.getWithBalance();
 *
 * const projectRepo = new ProjectRepository(db);
 * const projects = projectRepo.getWithSummary();
 * ```
 */

// Base
export { BaseRepository, type BaseEntity, type RunResult } from './BaseRepository';

// Company
export {
  CompanyRepository,
  type Company,
  type CompanyWithBalance,
} from './CompanyRepository';

// Project
export {
  ProjectRepository,
  type Project,
  type ProjectWithSummary,
  type ProjectParty,
  type ProjectStatus,
  type ProjectType,
  type OwnershipType,
} from './ProjectRepository';

// Transaction
export {
  TransactionRepository,
  type Transaction,
  type TransactionFilters,
  type TransactionType,
  type TransactionScope,
  type Currency,
} from './TransactionRepository';

// Material
export {
  MaterialRepository,
  type Material,
  type MaterialWithStock,
  type StockMovement,
  type StockMovementFilters,
  type MovementType,
} from './MaterialRepository';

// Category
export {
  CategoryRepository,
  type Category,
  type CategoryWithStats,
} from './CategoryRepository';

// Analytics
export {
  AnalyticsRepository,
  type DashboardStats,
  type CompanyBalance,
  type MonthlyStats,
} from './AnalyticsRepository';

// Trash
export {
  TrashRepository,
  type TrashItem,
  type TrashItemParsed,
} from './TrashRepository';

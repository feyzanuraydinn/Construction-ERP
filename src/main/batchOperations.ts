/**
 * Batch IPC Operations
 * Execute multiple operations in a single IPC call for better performance
 */

import { ipcMain } from 'electron';
import type ERPDatabase from '../database/database';

interface BatchOperation {
  id: string;
  type: string;
  params: unknown[];
}

interface BatchResult {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Initialize batch operation handlers
 */
export function initBatchOperations(db: ERPDatabase): void {
  /**
   * Execute multiple read operations in a single IPC call
   * Useful for loading dashboard data, initial page load, etc.
   */
  ipcMain.handle(
    'batch:read',
    async (_event, operations: BatchOperation[]): Promise<BatchResult[]> => {
      const results: BatchResult[] = [];

      for (const op of operations) {
        try {
          let data: unknown;

          switch (op.type) {
            case 'company:getAll':
              data = db.getCompaniesWithBalance();
              break;
            case 'company:getById':
              data = db.getCompanyById(op.params[0] as number);
              break;
            case 'project:getAll':
              data = db.getProjectsWithSummary();
              break;
            case 'project:getById':
              data = db.getProjectById(op.params[0] as number);
              break;
            case 'transaction:getAll':
              data = db.getAllTransactions();
              break;
            case 'transaction:getByCompany':
              data = db.getTransactionsByCompany(op.params[0] as number);
              break;
            case 'transaction:getByProject':
              data = db.getTransactionsByProject(op.params[0] as number);
              break;
            case 'category:getAll':
              data = db.getAllCategories();
              break;
            case 'material:getAll':
              data = db.getAllMaterials();
              break;
            case 'analytics:getDashboardStats':
              data = db.getDashboardStats();
              break;
            case 'analytics:getProjectCategoryBreakdown':
              data = db.getProjectCategoryBreakdown(op.params[0] as number);
              break;
            default:
              throw new Error(`Unknown operation type: ${op.type}`);
          }

          results.push({ id: op.id, success: true, data });
        } catch (error) {
          results.push({
            id: op.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    }
  );

  /**
   * Execute multiple write operations in a transaction
   * All operations succeed or all fail
   */
  ipcMain.handle(
    'batch:write',
    async (_event, operations: BatchOperation[]): Promise<BatchResult[]> => {
      const results: BatchResult[] = [];

      // Execute in transaction (all or nothing)
      try {
        db.beginTransaction();

        for (const op of operations) {
          try {
            let data: unknown;

            switch (op.type) {
              case 'company:create':
                data = db.createCompany(op.params[0] as Record<string, unknown>);
                break;
              case 'company:update':
                db.updateCompany(op.params[0] as number, op.params[1] as Record<string, unknown>);
                data = true;
                break;
              case 'project:create':
                data = db.createProject(op.params[0] as Record<string, unknown>);
                break;
              case 'project:update':
                db.updateProject(op.params[0] as number, op.params[1] as Record<string, unknown>);
                data = true;
                break;
              case 'transaction:create':
                data = db.createTransaction(op.params[0] as Record<string, unknown>);
                break;
              case 'transaction:update':
                db.updateTransaction(
                  op.params[0] as number,
                  op.params[1] as Record<string, unknown>
                );
                data = true;
                break;
              case 'material:create':
                data = db.createMaterial(op.params[0] as Record<string, unknown>);
                break;
              case 'material:update':
                db.updateMaterial(op.params[0] as number, op.params[1] as Record<string, unknown>);
                data = true;
                break;
              default:
                throw new Error(`Unknown operation type: ${op.type}`);
            }

            results.push({ id: op.id, success: true, data });
          } catch (error) {
            // If any operation fails, rollback and return error
            db.rollback();
            results.push({
              id: op.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            return results;
          }
        }

        db.commit();
      } catch (error) {
        db.rollback();
        return [
          {
            id: 'batch',
            success: false,
            error: error instanceof Error ? error.message : 'Transaction failed',
          },
        ];
      }

      return results;
    }
  );

  /**
   * Execute multiple delete operations in a transaction
   */
  ipcMain.handle(
    'batch:delete',
    async (_event, operations: BatchOperation[]): Promise<BatchResult[]> => {
      const results: BatchResult[] = [];

      try {
        db.beginTransaction();

        for (const op of operations) {
          try {
            switch (op.type) {
              case 'company:delete':
                db.deleteCompany(op.params[0] as number);
                break;
              case 'project:delete':
                db.deleteProject(op.params[0] as number);
                break;
              case 'transaction:delete':
                db.deleteTransaction(op.params[0] as number);
                break;
              case 'category:delete':
                db.deleteCategory(op.params[0] as number);
                break;
              case 'material:delete':
                db.deleteMaterial(op.params[0] as number);
                break;
              default:
                throw new Error(`Unknown operation type: ${op.type}`);
            }

            results.push({ id: op.id, success: true });
          } catch (error) {
            db.rollback();
            results.push({
              id: op.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            return results;
          }
        }

        db.commit();
      } catch (error) {
        db.rollback();
        return [
          {
            id: 'batch',
            success: false,
            error: error instanceof Error ? error.message : 'Transaction failed',
          },
        ];
      }

      return results;
    }
  );
}

export default initBatchOperations;

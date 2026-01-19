/**
 * Trash Repository
 *
 * Handles all database operations related to the trash/recycle bin.
 * Provides restore functionality for soft-deleted entities.
 *
 * @module TrashRepository
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import { dbLogger } from '../../utils/logger';

/** Trash item entity interface */
export interface TrashItem {
  id: number;
  entity_type: 'company' | 'project' | 'transaction' | 'material' | 'category';
  entity_id: number;
  data: string;
  deleted_at: string;
}

/** Parsed trash item with original data */
export interface TrashItemParsed<T = unknown> extends Omit<TrashItem, 'data'> {
  data: T;
}

/**
 * Repository for trash/recycle bin operations
 */
export class TrashRepository {
  private db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  /**
   * Execute a query and return results
   */
  private query<T>(sql: string, params: unknown[] = []): T[] {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);

      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return results;
    } catch (error) {
      dbLogger.error(`Query failed: ${sql}`, error);
      throw error;
    }
  }

  /**
   * Execute a query and return first result
   */
  private queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
    const results = this.query<T>(sql, params);
    return results[0];
  }

  /**
   * Execute a SQL statement
   */
  private run(sql: string, params: unknown[] = []): void {
    try {
      this.db.run(sql, params);
    } catch (error) {
      dbLogger.error(`Run failed: ${sql}`, error);
      throw error;
    }
  }

  /**
   * Get all items in trash
   */
  getAll(): TrashItem[] {
    return this.query<TrashItem>(
      'SELECT * FROM trash ORDER BY deleted_at DESC'
    );
  }

  /**
   * Get all items with parsed data
   */
  getAllParsed<T = unknown>(): TrashItemParsed<T>[] {
    const items = this.getAll();
    return items.map(item => ({
      ...item,
      data: JSON.parse(item.data) as T,
    }));
  }

  /**
   * Get trash items by entity type
   */
  getByType(entityType: TrashItem['entity_type']): TrashItem[] {
    return this.query<TrashItem>(
      'SELECT * FROM trash WHERE entity_type = ? ORDER BY deleted_at DESC',
      [entityType]
    );
  }

  /**
   * Get a single trash item by ID
   */
  getById(id: number): TrashItem | undefined {
    return this.queryOne<TrashItem>(
      'SELECT * FROM trash WHERE id = ?',
      [id]
    );
  }

  /**
   * Restore an item from trash
   */
  restore(id: number): { success: boolean; error?: string } {
    const trashItem = this.getById(id);
    if (!trashItem) {
      return { success: false, error: 'Çöp kutusu öğesi bulunamadı' };
    }

    try {
      const data = JSON.parse(trashItem.data);

      // Restore based on entity type
      switch (trashItem.entity_type) {
        case 'company':
          this.restoreCompany(data);
          break;
        case 'project':
          this.restoreProject(data);
          break;
        case 'transaction':
          this.restoreTransaction(data);
          break;
        case 'material':
          this.restoreMaterial(data);
          break;
        case 'category':
          this.restoreCategory(data);
          break;
        default:
          return { success: false, error: 'Bilinmeyen öğe türü' };
      }

      // Remove from trash
      this.run('DELETE FROM trash WHERE id = ?', [id]);

      return { success: true };
    } catch (error) {
      dbLogger.error('Restore failed', error);
      return { success: false, error: 'Geri yükleme başarısız oldu' };
    }
  }

  /**
   * Permanently delete an item from trash
   */
  permanentDelete(id: number): { success: boolean } {
    const trashItem = this.getById(id);
    if (!trashItem) return { success: false };

    this.run('DELETE FROM trash WHERE id = ?', [id]);
    return { success: true };
  }

  /**
   * Empty all trash (permanent delete all)
   */
  emptyTrash(): { success: boolean; deletedCount: number } {
    const count = this.count();
    this.run('DELETE FROM trash');
    return { success: true, deletedCount: count };
  }

  /**
   * Count items in trash
   */
  count(): number {
    const result = this.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM trash'
    );
    return result?.count ?? 0;
  }

  /**
   * Count items by entity type
   */
  countByType(entityType: TrashItem['entity_type']): number {
    const result = this.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM trash WHERE entity_type = ?',
      [entityType]
    );
    return result?.count ?? 0;
  }

  // ==================== PRIVATE RESTORE METHODS ====================

  private restoreCompany(data: Record<string, unknown>): void {
    this.run(
      `INSERT INTO companies (id, name, type, account_type, tax_number, tax_office, address, phone, email, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        data.id,
        data.name,
        data.type,
        data.account_type,
        data.tax_number || null,
        data.tax_office || null,
        data.address || null,
        data.phone || null,
        data.email || null,
        data.notes || null,
        data.is_active ?? 1,
        data.created_at,
      ]
    );
  }

  private restoreProject(data: Record<string, unknown>): void {
    this.run(
      `INSERT INTO projects (id, code, name, type, status, ownership, address, start_date, end_date, budget, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        data.id,
        data.code,
        data.name,
        data.type,
        data.status,
        data.ownership,
        data.address || null,
        data.start_date || null,
        data.end_date || null,
        data.budget || null,
        data.notes || null,
        data.is_active ?? 1,
        data.created_at,
      ]
    );
  }

  private restoreTransaction(data: Record<string, unknown>): void {
    this.run(
      `INSERT INTO transactions (id, date, type, scope, company_id, project_id, category_id, amount, currency, description, document_no, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        data.id,
        data.date,
        data.type,
        data.scope,
        data.company_id || null,
        data.project_id || null,
        data.category_id || null,
        data.amount,
        data.currency,
        data.description || null,
        data.document_no || null,
        data.notes || null,
        data.created_at,
      ]
    );
  }

  private restoreMaterial(data: Record<string, unknown>): void {
    this.run(
      `INSERT INTO materials (id, code, name, unit, stock_quantity, min_stock, unit_price, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        data.id,
        data.code,
        data.name,
        data.unit,
        data.stock_quantity ?? 0,
        data.min_stock ?? 0,
        data.unit_price ?? 0,
        data.notes || null,
        data.is_active ?? 1,
        data.created_at,
      ]
    );
  }

  private restoreCategory(data: Record<string, unknown>): void {
    this.run(
      `INSERT INTO categories (id, name, parent_id, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        data.id,
        data.name,
        data.parent_id || null,
        data.description || null,
        data.is_active ?? 1,
        data.created_at,
      ]
    );
  }
}

export default TrashRepository;

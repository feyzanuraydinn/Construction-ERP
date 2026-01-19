/**
 * Base Repository Class
 *
 * Provides common database operations for all repositories.
 * Uses sql.js (SQLite in WebAssembly) for database operations.
 *
 * @module BaseRepository
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import { dbLogger } from '../../utils/logger';

/** Result of a database run operation */
export interface RunResult {
  lastInsertRowid: number | undefined;
}

/** Base interface for entities with timestamps */
export interface BaseEntity {
  id: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Abstract base repository with common CRUD operations
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected db: SqlJsDatabase;
  protected abstract tableName: string;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  /**
   * Execute a SQL query and return results as an array of objects
   */
  protected query<R = T>(sql: string, params: unknown[] = []): R[] {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);

      const results: R[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as R);
      }
      stmt.free();
      return results;
    } catch (error) {
      dbLogger.error(`Query failed: ${sql}`, error as Error);
      throw error;
    }
  }

  /**
   * Execute a SQL query and return the first result
   */
  protected queryOne<R = T>(sql: string, params: unknown[] = []): R | undefined {
    const results = this.query<R>(sql, params);
    return results[0];
  }

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE)
   */
  protected run(sql: string, params: unknown[] = []): RunResult {
    try {
      this.db.run(sql, params);
      const result = this.db.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid =
        result.length > 0 && result[0].values.length > 0
          ? (result[0].values[0][0] as number)
          : undefined;
      return { lastInsertRowid };
    } catch (error) {
      dbLogger.error(`Run failed: ${sql}`, error as Error);
      throw error;
    }
  }

  /**
   * Get all records from the table
   */
  getAll(includeInactive = false): T[] {
    const sql = includeInactive
      ? `SELECT * FROM ${this.tableName} ORDER BY id DESC`
      : `SELECT * FROM ${this.tableName} WHERE is_active = 1 ORDER BY id DESC`;
    return this.query(sql);
  }

  /**
   * Get a record by ID
   */
  getById(id: number): T | undefined {
    return this.queryOne(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  /**
   * Delete a record by ID (soft delete by moving to trash)
   */
  abstract delete(id: number): { success: boolean };

  /**
   * Count records in the table
   */
  count(where?: string, params: unknown[] = []): number {
    const sql = where
      ? `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${where}`
      : `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const result = this.queryOne<{ count: number }>(sql, params);
    return result?.count ?? 0;
  }

  /**
   * Check if a record exists
   */
  exists(id: number): boolean {
    const result = this.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return (result?.count ?? 0) > 0;
  }
}

export default BaseRepository;

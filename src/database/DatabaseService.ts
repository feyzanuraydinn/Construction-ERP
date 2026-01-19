/**
 * Database Service
 *
 * A unified service that provides access to all database repositories.
 * This serves as the main entry point for database operations.
 *
 * @module DatabaseService
 *
 * @example
 * ```typescript
 * import { DatabaseService } from './DatabaseService';
 *
 * // Initialize
 * const dbService = new DatabaseService();
 * await dbService.init(userDataPath);
 *
 * // Use repositories
 * const companies = dbService.companies.getWithBalance();
 * const projects = dbService.projects.getWithSummary();
 * const stats = dbService.analytics.getDashboardStats();
 * ```
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { dbLogger } from '../utils/logger';

// Import repositories
import {
  CompanyRepository,
  ProjectRepository,
  TransactionRepository,
  MaterialRepository,
  CategoryRepository,
  AnalyticsRepository,
  TrashRepository,
} from './repositories';

/**
 * Unified database service with repository access
 */
export class DatabaseService {
  private db: SqlJsDatabase | null = null;
  private dbPath: string | null = null;
  private initialized = false;

  // Repositories
  private _companies: CompanyRepository | null = null;
  private _projects: ProjectRepository | null = null;
  private _transactions: TransactionRepository | null = null;
  private _materials: MaterialRepository | null = null;
  private _categories: CategoryRepository | null = null;
  private _analytics: AnalyticsRepository | null = null;
  private _trash: TrashRepository | null = null;

  /**
   * Company repository for customer/supplier operations
   */
  get companies(): CompanyRepository {
    this.ensureInitialized();
    return this._companies!;
  }

  /**
   * Project repository for project management
   */
  get projects(): ProjectRepository {
    this.ensureInitialized();
    return this._projects!;
  }

  /**
   * Transaction repository for financial operations
   */
  get transactions(): TransactionRepository {
    this.ensureInitialized();
    return this._transactions!;
  }

  /**
   * Material repository for inventory management
   */
  get materials(): MaterialRepository {
    this.ensureInitialized();
    return this._materials!;
  }

  /**
   * Category repository for transaction categories
   */
  get categories(): CategoryRepository {
    this.ensureInitialized();
    return this._categories!;
  }

  /**
   * Analytics repository for dashboard and reports
   */
  get analytics(): AnalyticsRepository {
    this.ensureInitialized();
    return this._analytics!;
  }

  /**
   * Trash repository for deleted items
   */
  get trash(): TrashRepository {
    this.ensureInitialized();
    return this._trash!;
  }

  /**
   * Raw database access (for advanced operations)
   */
  get rawDb(): SqlJsDatabase {
    this.ensureInitialized();
    return this.db!;
  }

  /**
   * Initialize the database service
   */
  async init(userDataPath: string): Promise<void> {
    if (this.initialized) return;

    const dbDir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = path.join(dbDir, 'insaat-erp.db');

    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
      dbLogger.info('Database loaded from file', 'DatabaseService');
    } else {
      this.db = new SQL.Database();
      dbLogger.info('New database created', 'DatabaseService');
    }

    // Initialize repositories
    this._companies = new CompanyRepository(this.db);
    this._projects = new ProjectRepository(this.db);
    this._transactions = new TransactionRepository(this.db);
    this._materials = new MaterialRepository(this.db);
    this._categories = new CategoryRepository(this.db);
    this._analytics = new AnalyticsRepository(this.db);
    this._trash = new TrashRepository(this.db);

    this.initialized = true;
    dbLogger.info('DatabaseService initialized successfully', 'DatabaseService');
  }

  /**
   * Save database to disk
   */
  save(): void {
    if (this.db && this.dbPath) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
      dbLogger.debug('Database saved to disk', 'DatabaseService');
    }
  }

  /**
   * Begin a transaction
   */
  beginTransaction(): void {
    this.ensureInitialized();
    this.db!.run('BEGIN TRANSACTION');
  }

  /**
   * Commit a transaction
   */
  commit(): void {
    this.ensureInitialized();
    this.db!.run('COMMIT');
    this.save();
  }

  /**
   * Rollback a transaction
   */
  rollback(): void {
    this.ensureInitialized();
    this.db!.run('ROLLBACK');
  }

  /**
   * Execute a callback within a transaction
   */
  async withTransaction<T>(callback: () => T | Promise<T>): Promise<T> {
    this.beginTransaction();
    try {
      const result = await callback();
      this.commit();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  /**
   * Check database integrity
   */
  checkIntegrity(): { ok: boolean; error?: string } {
    this.ensureInitialized();
    try {
      const result = this.db!.exec('PRAGMA integrity_check');
      if (result.length > 0 && result[0].values.length > 0) {
        const status = result[0].values[0][0] as string;
        if (status === 'ok') {
          return { ok: true };
        }
        return { ok: false, error: status };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Get database statistics
   */
  getStats(): { tables: Record<string, number>; size: number } {
    this.ensureInitialized();
    const tables: Record<string, number> = {};
    const tableNames = [
      'companies',
      'projects',
      'transactions',
      'materials',
      'stock_movements',
      'categories',
      'project_parties',
      'trash',
    ];

    for (const table of tableNames) {
      try {
        const result = this.db!.exec(`SELECT COUNT(*) FROM ${table}`);
        tables[table] = result[0]?.values[0]?.[0] as number ?? 0;
      } catch {
        tables[table] = 0;
      }
    }

    let size = 0;
    if (this.db) {
      const data = this.db.export();
      size = data.length;
    }

    return { tables, size };
  }

  /**
   * Create a backup
   */
  createBackup(backupDir: string): string {
    this.ensureInitialized();

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = path.join(backupDir, 'latest_backup.db');
    const data = this.db!.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(backupPath, buffer);

    const metaPath = path.join(backupDir, 'backup_meta.json');
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          lastBackup: new Date().toISOString(),
          size: buffer.length,
        },
        null,
        2
      )
    );

    dbLogger.info(`Backup created: ${backupPath}`, 'DatabaseService');
    return backupPath;
  }

  /**
   * Close the database
   */
  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      this.initialized = false;
      dbLogger.info('Database closed', 'DatabaseService');
    }
  }

  /**
   * Ensure the database is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('DatabaseService not initialized. Call init() first.');
    }
  }
}

// Singleton instance
let serviceInstance: DatabaseService | null = null;

/**
 * Get the singleton DatabaseService instance
 */
export function getDatabaseService(): DatabaseService {
  if (!serviceInstance) {
    serviceInstance = new DatabaseService();
  }
  return serviceInstance;
}

export default DatabaseService;

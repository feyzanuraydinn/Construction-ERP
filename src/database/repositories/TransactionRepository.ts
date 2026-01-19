/**
 * Transaction Repository
 *
 * Handles all database operations related to financial transactions.
 *
 * @module TransactionRepository
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import { BaseRepository, BaseEntity } from './BaseRepository';
import { createSafeLikePattern } from '../../utils/security';

/** Transaction type */
export type TransactionType = 'invoice_out' | 'payment_in' | 'invoice_in' | 'payment_out';

/** Transaction scope */
export type TransactionScope = 'cari' | 'project' | 'company';

/** Currency type */
export type Currency = 'TRY' | 'USD' | 'EUR';

/** Transaction entity interface */
export interface Transaction extends BaseEntity {
  date: string;
  type: TransactionType;
  scope: TransactionScope;
  company_id?: number;
  project_id?: number;
  category_id?: number;
  amount: number;
  currency: Currency;
  description?: string;
  document_no?: string;
  notes?: string;
  company_name?: string;
  project_name?: string;
  category_name?: string;
}

/** Transaction filter options */
export interface TransactionFilters {
  scope?: string;
  type?: string;
  company_id?: number;
  project_id?: number;
  start_date?: string;
  end_date?: string;
  search?: string;
  limit?: number;
}

/**
 * Repository for transaction operations
 */
export class TransactionRepository extends BaseRepository<Transaction> {
  protected tableName = 'transactions';

  constructor(db: SqlJsDatabase) {
    super(db);
  }

  /**
   * Get all transactions with filters
   * Note: Override signature differs from base - use getAllFiltered for typed filters
   */
  getAllFiltered(filters: TransactionFilters = {}): Transaction[] {
    let sql = `
      SELECT t.*,
             c.name as company_name,
             p.name as project_name,
             cat.name as category_name
      FROM transactions t
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN categories cat ON t.category_id = cat.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.scope) {
      sql += ' AND t.scope = ?';
      params.push(filters.scope);
    }
    if (filters.type) {
      sql += ' AND t.type = ?';
      params.push(filters.type);
    }
    if (filters.company_id) {
      sql += ' AND t.company_id = ?';
      params.push(filters.company_id);
    }
    if (filters.project_id) {
      sql += ' AND t.project_id = ?';
      params.push(filters.project_id);
    }
    if (filters.start_date) {
      sql += ' AND t.date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      sql += ' AND t.date <= ?';
      params.push(filters.end_date);
    }
    if (filters.search) {
      const pattern = createSafeLikePattern(filters.search);
      sql += ' AND (t.description LIKE ? OR t.document_no LIKE ? OR c.name LIKE ?)';
      params.push(pattern, pattern, pattern);
    }

    sql += ' ORDER BY t.date DESC, t.id DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return this.query(sql, params);
  }

  /**
   * Get transactions by company
   */
  getByCompany(companyId: number, filters: TransactionFilters = {}): Transaction[] {
    return this.getAllFiltered({ ...filters, company_id: companyId });
  }

  /**
   * Get transactions by project
   */
  getByProject(projectId: number, filters: TransactionFilters = {}): Transaction[] {
    return this.getAllFiltered({ ...filters, project_id: projectId });
  }

  /**
   * Create a new transaction
   */
  create(data: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'company_name' | 'project_name' | 'category_name'>): Transaction {
    const sql = `
      INSERT INTO transactions (date, type, scope, company_id, project_id, category_id, amount, currency, description, document_no, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.date,
      data.type,
      data.scope,
      data.company_id || null,
      data.project_id || null,
      data.category_id || null,
      data.amount,
      data.currency || 'TRY',
      data.description || null,
      data.document_no || null,
      data.notes || null,
    ];

    const result = this.run(sql, params);
    return this.getById(result.lastInsertRowid!)!;
  }

  /**
   * Update a transaction
   */
  update(id: number, data: Partial<Omit<Transaction, 'id'>>): Transaction | undefined {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.date !== undefined) {
      fields.push('date = ?');
      params.push(data.date);
    }
    if (data.type !== undefined) {
      fields.push('type = ?');
      params.push(data.type);
    }
    if (data.scope !== undefined) {
      fields.push('scope = ?');
      params.push(data.scope);
    }
    if (data.company_id !== undefined) {
      fields.push('company_id = ?');
      params.push(data.company_id);
    }
    if (data.project_id !== undefined) {
      fields.push('project_id = ?');
      params.push(data.project_id);
    }
    if (data.category_id !== undefined) {
      fields.push('category_id = ?');
      params.push(data.category_id);
    }
    if (data.amount !== undefined) {
      fields.push('amount = ?');
      params.push(data.amount);
    }
    if (data.currency !== undefined) {
      fields.push('currency = ?');
      params.push(data.currency);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      params.push(data.description);
    }
    if (data.document_no !== undefined) {
      fields.push('document_no = ?');
      params.push(data.document_no);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      params.push(data.notes);
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`;
    this.run(sql, params);

    return this.getById(id);
  }

  /**
   * Delete a transaction (move to trash)
   */
  delete(id: number): { success: boolean } {
    const transaction = this.getById(id);
    if (!transaction) return { success: false };

    // Move to trash
    this.run(
      `INSERT INTO trash (entity_type, entity_id, data) VALUES (?, ?, ?)`,
      ['transaction', id, JSON.stringify(transaction)]
    );

    // Delete from transactions
    this.run('DELETE FROM transactions WHERE id = ?', [id]);

    return { success: true };
  }

  /**
   * Get recent transactions
   */
  getRecent(limit = 10): Transaction[] {
    return this.getAllFiltered({ limit });
  }

  /**
   * Get monthly statistics for a year
   */
  getMonthlyStats(year: number): { month: string; income: number; expense: number }[] {
    const sql = `
      SELECT
        strftime('%m', date) as month,
        SUM(CASE WHEN type = 'invoice_out' THEN amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END ELSE 0 END) as income,
        SUM(CASE WHEN type = 'invoice_in' THEN amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END ELSE 0 END) as expense
      FROM transactions
      WHERE strftime('%Y', date) = ?
      GROUP BY strftime('%m', date)
      ORDER BY month
    `;
    return this.query(sql, [String(year)]);
  }

  /**
   * Get company monthly statistics
   */
  getCompanyMonthlyStats(companyId: number, year: number): { month: string; debit: number; credit: number }[] {
    const sql = `
      SELECT
        strftime('%m', date) as month,
        SUM(CASE WHEN type IN ('invoice_out', 'payment_out') THEN amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END ELSE 0 END) as debit,
        SUM(CASE WHEN type IN ('invoice_in', 'payment_in') THEN amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END ELSE 0 END) as credit
      FROM transactions
      WHERE company_id = ? AND strftime('%Y', date) = ?
      GROUP BY strftime('%m', date)
      ORDER BY month
    `;
    return this.query(sql, [companyId, String(year)]);
  }

  /**
   * Get project category breakdown
   */
  getProjectCategoryBreakdown(projectId: number): { category: string; amount: number }[] {
    const sql = `
      SELECT
        COALESCE(cat.name, 'Kategorisiz') as category,
        SUM(t.amount * CASE t.currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END) as amount
      FROM transactions t
      LEFT JOIN categories cat ON t.category_id = cat.id
      WHERE t.project_id = ? AND t.type = 'invoice_in'
      GROUP BY COALESCE(cat.name, 'Kategorisiz')
      ORDER BY amount DESC
    `;
    return this.query(sql, [projectId]);
  }
}

export default TransactionRepository;

/**
 * Company Repository
 *
 * Handles all database operations related to companies (customers, suppliers, etc.)
 *
 * @module CompanyRepository
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import { BaseRepository, BaseEntity } from './BaseRepository';

/** Company entity interface */
export interface Company extends BaseEntity {
  name: string;
  type: 'person' | 'company';
  account_type: 'customer' | 'supplier' | 'subcontractor' | 'investor';
  tax_number?: string;
  tax_office?: string;
  address?: string;
  phone?: string;
  email?: string;
  notes?: string;
  is_active: boolean;
}

/** Company with calculated balance */
export interface CompanyWithBalance extends Company {
  balance: number;
  transaction_count: number;
}

/**
 * Repository for company operations
 */
export class CompanyRepository extends BaseRepository<Company> {
  protected tableName = 'companies';

  constructor(db: SqlJsDatabase) {
    super(db);
  }

  /**
   * Get all companies with their calculated balances
   */
  getWithBalance(): CompanyWithBalance[] {
    const sql = `
      SELECT
        c.*,
        COALESCE(
          (SELECT SUM(CASE
            WHEN t.type = 'invoice_out' THEN t.amount * CASE t.currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
            WHEN t.type = 'payment_in' THEN -t.amount * CASE t.currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
            WHEN t.type = 'invoice_in' THEN -t.amount * CASE t.currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
            WHEN t.type = 'payment_out' THEN t.amount * CASE t.currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
            ELSE 0 END)
          FROM transactions t WHERE t.company_id = c.id), 0
        ) as balance,
        (SELECT COUNT(*) FROM transactions WHERE company_id = c.id) as transaction_count
      FROM companies c
      WHERE c.is_active = 1
      ORDER BY c.name
    `;
    return this.query<CompanyWithBalance>(sql);
  }

  /**
   * Create a new company
   */
  create(data: Omit<Company, 'id' | 'created_at' | 'updated_at'>): Company {
    const sql = `
      INSERT INTO companies (name, type, account_type, tax_number, tax_office, address, phone, email, notes, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.name,
      data.type,
      data.account_type,
      data.tax_number || null,
      data.tax_office || null,
      data.address || null,
      data.phone || null,
      data.email || null,
      data.notes || null,
      data.is_active !== false ? 1 : 0,
    ];

    const result = this.run(sql, params);
    return this.getById(result.lastInsertRowid!)!;
  }

  /**
   * Update a company
   */
  update(id: number, data: Partial<Omit<Company, 'id'>>): Company | undefined {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.type !== undefined) {
      fields.push('type = ?');
      params.push(data.type);
    }
    if (data.account_type !== undefined) {
      fields.push('account_type = ?');
      params.push(data.account_type);
    }
    if (data.tax_number !== undefined) {
      fields.push('tax_number = ?');
      params.push(data.tax_number);
    }
    if (data.tax_office !== undefined) {
      fields.push('tax_office = ?');
      params.push(data.tax_office);
    }
    if (data.address !== undefined) {
      fields.push('address = ?');
      params.push(data.address);
    }
    if (data.phone !== undefined) {
      fields.push('phone = ?');
      params.push(data.phone);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      params.push(data.email);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      params.push(data.notes);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(data.is_active ? 1 : 0);
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE companies SET ${fields.join(', ')} WHERE id = ?`;
    this.run(sql, params);

    return this.getById(id);
  }

  /**
   * Soft delete a company (move to trash)
   */
  delete(id: number): { success: boolean } {
    const company = this.getById(id);
    if (!company) return { success: false };

    // Move to trash
    this.run(
      `INSERT INTO trash (entity_type, entity_id, data) VALUES (?, ?, ?)`,
      ['company', id, JSON.stringify(company)]
    );

    // Delete from companies
    this.run('DELETE FROM companies WHERE id = ?', [id]);

    return { success: true };
  }

  /**
   * Search companies by name
   */
  search(query: string, limit = 10): Company[] {
    const sql = `
      SELECT * FROM companies
      WHERE is_active = 1 AND name LIKE ?
      ORDER BY name
      LIMIT ?
    `;
    return this.query(sql, [`%${query}%`, limit]);
  }

  /**
   * Get companies by account type
   */
  getByAccountType(accountType: Company['account_type']): Company[] {
    return this.query(
      'SELECT * FROM companies WHERE account_type = ? AND is_active = 1 ORDER BY name',
      [accountType]
    );
  }
}

export default CompanyRepository;

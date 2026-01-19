/**
 * Analytics Repository
 *
 * Handles all database operations for dashboard and analytics data.
 *
 * @module AnalyticsRepository
 */

import type { Database as SqlJsDatabase } from 'sql.js';

/** Dashboard statistics */
export interface DashboardStats {
  totalCompanies: number;
  totalProjects: number;
  activeProjects: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  totalReceivables: number;
  totalPayables: number;
  monthlyIncome: number;
  monthlyExpense: number;
}

/** Company balance for top debtors/creditors */
export interface CompanyBalance {
  id: number;
  name: string;
  balance: number;
}

/** Monthly statistics */
export interface MonthlyStats {
  month: string;
  income: number;
  expense: number;
}

/**
 * Repository for analytics and dashboard operations
 */
export class AnalyticsRepository {
  private db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  /**
   * Execute a query and return results
   */
  private query<T>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);

    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  /**
   * Execute a query and return first result
   */
  private queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
    const results = this.query<T>(sql, params);
    return results[0];
  }

  /**
   * Get dashboard statistics
   */
  getDashboardStats(): DashboardStats {
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Company and project counts
    const companiesCount = this.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM companies WHERE is_active = 1'
    )?.count ?? 0;

    const projectsCount = this.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM projects WHERE is_active = 1'
    )?.count ?? 0;

    const activeProjectsCount = this.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM projects WHERE status = 'active' AND is_active = 1"
    )?.count ?? 0;

    // Financial totals
    const incomeResult = this.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END), 0) as total
       FROM transactions WHERE type = 'invoice_out'`
    );

    const expenseResult = this.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END), 0) as total
       FROM transactions WHERE type = 'invoice_in'`
    );

    // Receivables and payables
    const receivablesResult = this.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(
        CASE WHEN type = 'invoice_out' THEN amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
             WHEN type = 'payment_in' THEN -amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
             ELSE 0 END
       ), 0) as total FROM transactions WHERE scope = 'cari'`
    );

    const payablesResult = this.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(
        CASE WHEN type = 'invoice_in' THEN amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
             WHEN type = 'payment_out' THEN -amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
             ELSE 0 END
       ), 0) as total FROM transactions WHERE scope = 'cari'`
    );

    // Monthly totals
    const monthlyIncomeResult = this.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END), 0) as total
       FROM transactions WHERE type = 'invoice_out' AND strftime('%Y-%m', date) = ?`,
      [currentMonth]
    );

    const monthlyExpenseResult = this.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END), 0) as total
       FROM transactions WHERE type = 'invoice_in' AND strftime('%Y-%m', date) = ?`,
      [currentMonth]
    );

    const totalIncome = incomeResult?.total ?? 0;
    const totalExpense = expenseResult?.total ?? 0;

    return {
      totalCompanies: companiesCount,
      totalProjects: projectsCount,
      activeProjects: activeProjectsCount,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      totalReceivables: Math.max(0, receivablesResult?.total ?? 0),
      totalPayables: Math.max(0, payablesResult?.total ?? 0),
      monthlyIncome: monthlyIncomeResult?.total ?? 0,
      monthlyExpense: monthlyExpenseResult?.total ?? 0,
    };
  }

  /**
   * Get top debtors (companies that owe us money)
   */
  getTopDebtors(limit = 5): CompanyBalance[] {
    const sql = `
      SELECT
        c.id,
        c.name,
        COALESCE(SUM(
          CASE
            WHEN t.type = 'invoice_out' THEN t.amount * CASE t.currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
            WHEN t.type = 'payment_in' THEN -t.amount * CASE t.currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
            ELSE 0
          END
        ), 0) as balance
      FROM companies c
      LEFT JOIN transactions t ON t.company_id = c.id
      WHERE c.is_active = 1
      GROUP BY c.id, c.name
      HAVING balance > 0
      ORDER BY balance DESC
      LIMIT ?
    `;
    return this.query<CompanyBalance>(sql, [limit]);
  }

  /**
   * Get top creditors (companies we owe money to)
   */
  getTopCreditors(limit = 5): CompanyBalance[] {
    const sql = `
      SELECT
        c.id,
        c.name,
        COALESCE(SUM(
          CASE
            WHEN t.type = 'invoice_in' THEN t.amount * CASE t.currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
            WHEN t.type = 'payment_out' THEN -t.amount * CASE t.currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END
            ELSE 0
          END
        ), 0) as balance
      FROM companies c
      LEFT JOIN transactions t ON t.company_id = c.id
      WHERE c.is_active = 1
      GROUP BY c.id, c.name
      HAVING balance > 0
      ORDER BY balance DESC
      LIMIT ?
    `;
    return this.query<CompanyBalance>(sql, [limit]);
  }

  /**
   * Get monthly statistics for a year
   */
  getMonthlyStats(year: number): MonthlyStats[] {
    const sql = `
      SELECT
        strftime('%m', date) as month,
        COALESCE(SUM(CASE WHEN type = 'invoice_out' THEN amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'invoice_in' THEN amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END ELSE 0 END), 0) as expense
      FROM transactions
      WHERE strftime('%Y', date) = ?
      GROUP BY strftime('%m', date)
      ORDER BY month
    `;
    return this.query<MonthlyStats>(sql, [String(year)]);
  }

  /**
   * Get project category breakdown for expenses
   */
  getProjectCategoryBreakdown(projectId: number): { category: string; amount: number }[] {
    const sql = `
      SELECT
        COALESCE(cat.name, 'Kategorisiz') as category,
        COALESCE(SUM(t.amount * CASE t.currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END), 0) as amount
      FROM transactions t
      LEFT JOIN categories cat ON t.category_id = cat.id
      WHERE t.project_id = ? AND t.type = 'invoice_in'
      GROUP BY COALESCE(cat.name, 'Kategorisiz')
      ORDER BY amount DESC
    `;
    return this.query(sql, [projectId]);
  }

  /**
   * Get company monthly statistics
   */
  getCompanyMonthlyStats(companyId: number, year: number): { month: string; debit: number; credit: number }[] {
    const sql = `
      SELECT
        strftime('%m', date) as month,
        COALESCE(SUM(CASE WHEN type IN ('invoice_out', 'payment_out') THEN amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END ELSE 0 END), 0) as debit,
        COALESCE(SUM(CASE WHEN type IN ('invoice_in', 'payment_in') THEN amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END ELSE 0 END), 0) as credit
      FROM transactions
      WHERE company_id = ? AND strftime('%Y', date) = ?
      GROUP BY strftime('%m', date)
      ORDER BY month
    `;
    return this.query(sql, [companyId, String(year)]);
  }
}

export default AnalyticsRepository;

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { createSafeLikePattern } from '../utils/security';
import { dbLogger } from '../utils/logger';

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

export interface StockMovementFilters {
  material_id?: number;
  movement_type?: string;
  project_id?: number;
  start_date?: string;
  end_date?: string;
}

interface RunResult {
  lastInsertRowid: number | undefined;
}

class ERPDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string | null = null;
  private initialized: boolean = false;
  private _saveDeferred: boolean = false;
  private _saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private _inTransaction: boolean = false;
  private _isDirty: boolean = false;

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
    } else {
      this.db = new SQL.Database();
    }

    // Check database integrity before proceeding
    const integrityCheck = this.checkIntegrity();
    if (!integrityCheck.ok) {
      console.error('Database integrity check failed:', integrityCheck.error);
      throw new Error(`Veritabanı bütünlük kontrolü başarısız: ${integrityCheck.error}`);
    }

    this.initializeTables();
    this.initializeDefaultCategories();
    this.initializeSampleData();
    this.saveDatabase();
    this.initialized = true;
  }

  /**
   * Check database integrity using SQLite PRAGMA
   */
  checkIntegrity(): { ok: boolean; error?: string } {
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
   * Check foreign key integrity
   */
  checkForeignKeys(): { ok: boolean; violations: unknown[] } {
    try {
      const result = this.db!.exec('PRAGMA foreign_key_check');
      if (result.length > 0 && result[0].values.length > 0) {
        return { ok: false, violations: result[0].values };
      }
      return { ok: true, violations: [] };
    } catch {
      return { ok: true, violations: [] };
    }
  }

  /**
   * Get database statistics
   */
  getStats(): { tables: Record<string, number>; size: number } {
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
        const result = this.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
        tables[table] = result?.count ?? 0;
      } catch {
        tables[table] = 0;
      }
    }

    // Calculate approximate database size
    let size = 0;
    if (this.db) {
      const data = this.db.export();
      size = data.length;
    }

    return { tables, size };
  }

  saveDatabase(): void {
    if (this.db && this.dbPath) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    }
  }

  private _deferredSave(): void {
    if (this._inTransaction) return;

    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
    }

    this._saveDeferred = true;
    this._saveTimeout = setTimeout(() => {
      this._flushSave();
    }, 100);
  }

  private _flushSave(): void {
    if (this._saveDeferred) {
      this.saveDatabase();
      this._saveDeferred = false;
      this._saveTimeout = null;
    }
  }

  beginTransaction(): void {
    if (!this._inTransaction && this.db) {
      this.db.run('BEGIN TRANSACTION');
      this._inTransaction = true;
    }
  }

  commit(): void {
    if (this._inTransaction && this.db) {
      this.db.run('COMMIT');
      this._inTransaction = false;
      this.saveDatabase();
    }
  }

  rollback(): void {
    if (this._inTransaction && this.db) {
      this.db.run('ROLLBACK');
      this._inTransaction = false;
    }
  }

  private run(sql: string, params: unknown[] = []): RunResult {
    this.db!.run(sql, params as (string | number | null | Uint8Array)[]);
    this._isDirty = true;
    this._deferredSave();
    const result = this.db!.exec('SELECT last_insert_rowid()');
    return { lastInsertRowid: result[0]?.values[0]?.[0] as number | undefined };
  }

  isDirty(): boolean {
    return this._isDirty;
  }

  clearDirty(): void {
    this._isDirty = false;
  }

  private exec(sql: string): void {
    this.db!.exec(sql);
    this._deferredSave();
  }

  private get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = this.db!.prepare(sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as T;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  private all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db!.prepare(sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  private initializeTables(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('person', 'company')),
        account_type TEXT NOT NULL CHECK(account_type IN ('customer', 'supplier', 'subcontractor', 'investor')),
        name TEXT NOT NULL,
        tc_number TEXT,
        profession TEXT,
        tax_office TEXT,
        tax_number TEXT,
        trade_registry_no TEXT,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        bank_name TEXT,
        iban TEXT,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        ownership_type TEXT NOT NULL CHECK(ownership_type IN ('own', 'client')),
        client_company_id INTEGER,
        status TEXT NOT NULL CHECK(status IN ('planned', 'active', 'completed', 'cancelled')) DEFAULT 'planned',
        project_type TEXT CHECK(project_type IN ('residential', 'villa', 'commercial', 'mixed', 'infrastructure', 'renovation')),
        location TEXT,
        total_area DECIMAL(15,2),
        unit_count INTEGER,
        estimated_budget DECIMAL(15,2),
        planned_start DATE,
        planned_end DATE,
        actual_start DATE,
        actual_end DATE,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_company_id) REFERENCES companies(id) ON DELETE SET NULL
      )
    `);

    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('invoice_out', 'invoice_in', 'payment')),
        color TEXT DEFAULT '#6366f1',
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL CHECK(scope IN ('cari', 'project', 'company')),
        company_id INTEGER,
        project_id INTEGER,
        type TEXT NOT NULL CHECK(type IN ('invoice_out', 'payment_in', 'invoice_in', 'payment_out')),
        category_id INTEGER,
        date DATE NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency TEXT DEFAULT 'TRY' CHECK(currency IN ('TRY', 'USD', 'EUR')),
        exchange_rate DECIMAL(10,4) DEFAULT 1,
        amount_try DECIMAL(15,2),
        document_no TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        unit TEXT NOT NULL,
        min_stock DECIMAL(15,2) DEFAULT 0,
        current_stock DECIMAL(15,2) DEFAULT 0,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL CHECK(movement_type IN ('in', 'out', 'adjustment', 'waste')),
        quantity DECIMAL(15,2) NOT NULL,
        unit_price DECIMAL(15,2),
        total_price DECIMAL(15,2),
        project_id INTEGER,
        company_id INTEGER,
        date DATE NOT NULL,
        description TEXT,
        document_no TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
      )
    `);

    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS project_parties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('customer', 'supplier', 'subcontractor', 'investor')),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        UNIQUE(project_id, company_id, role)
      )
    `);

    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS trash (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db!.exec(`
      -- Transaction indexes (most queried table)
      CREATE INDEX IF NOT EXISTS idx_transactions_company ON transactions(company_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_project ON transactions(project_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_scope ON transactions(scope);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_company_date ON transactions(company_id, date);
      CREATE INDEX IF NOT EXISTS idx_transactions_project_type ON transactions(project_id, type);

      -- Company indexes
      CREATE INDEX IF NOT EXISTS idx_companies_account_type ON companies(account_type);
      CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);
      CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

      -- Project indexes
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
      CREATE INDEX IF NOT EXISTS idx_projects_ownership ON projects(ownership_type);

      -- Stock movement indexes
      CREATE INDEX IF NOT EXISTS idx_stock_movements_material ON stock_movements(material_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(date);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);

      -- Project parties indexes
      CREATE INDEX IF NOT EXISTS idx_project_parties_project ON project_parties(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_parties_company ON project_parties(company_id);

      -- Material indexes
      CREATE INDEX IF NOT EXISTS idx_materials_is_active ON materials(is_active);
      CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
    `);

    // Migrate existing database: add currency, exchange_rate, and amount_try columns
    this.runMigrations();
  }

  private runMigrations(): void {
    // Check if currency column exists in transactions table
    const tableInfo = this.all<{ name: string }>(`PRAGMA table_info(transactions)`);
    const columns = tableInfo.map((col) => col.name);

    // Check if we need to migrate from old schema (income/expense) to new (4-type)
    const needsTableMigration = !columns.includes('currency') || !columns.includes('amount_try');

    if (needsTableMigration) {
      // Wrap migration in a transaction for safety
      this.db!.run('BEGIN TRANSACTION');

      try {
        // SQLite doesn't support modifying CHECK constraints, so we need to recreate the table
        this.db!.exec(`
          -- Create new table with updated schema
          CREATE TABLE IF NOT EXISTS transactions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL CHECK(scope IN ('cari', 'project', 'company')),
            company_id INTEGER,
            project_id INTEGER,
            type TEXT NOT NULL CHECK(type IN ('invoice_out', 'payment_in', 'invoice_in', 'payment_out')),
            category_id INTEGER,
            date DATE NOT NULL,
            description TEXT NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            currency TEXT DEFAULT 'TRY' CHECK(currency IN ('TRY', 'USD', 'EUR')),
            exchange_rate DECIMAL(10,4) DEFAULT 1,
            amount_try DECIMAL(15,2),
            document_no TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
          )
        `);

        // Check if old table exists and has data
        const count = this.get<{ count: number }>(`SELECT COUNT(*) as count FROM transactions`);
        if (count && count.count > 0) {
          // Copy data from old table, converting types
          this.db!.exec(`
            INSERT INTO transactions_new (id, scope, company_id, project_id, type, category_id, date, description, amount, currency, exchange_rate, amount_try, document_no, notes, created_at, updated_at)
            SELECT
              id, scope, company_id, project_id,
              CASE
                WHEN type = 'income' THEN 'invoice_out'
                WHEN type = 'expense' THEN 'invoice_in'
                ELSE type
              END as type,
              category_id, date, description, amount,
              'TRY' as currency,
              1 as exchange_rate,
              amount as amount_try,
              document_no, notes, created_at, updated_at
            FROM transactions
          `);
        }

        // Drop old table and rename new one
        this.db!.exec(`DROP TABLE transactions`);
        this.db!.exec(`ALTER TABLE transactions_new RENAME TO transactions`);

        // Recreate indexes
        this.db!.exec(`
          CREATE INDEX IF NOT EXISTS idx_transactions_company ON transactions(company_id);
          CREATE INDEX IF NOT EXISTS idx_transactions_project ON transactions(project_id);
          CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
          CREATE INDEX IF NOT EXISTS idx_transactions_scope ON transactions(scope);
        `);

        // Commit the transaction
        this.db!.run('COMMIT');
        dbLogger.info('Database migration completed successfully');
      } catch (error) {
        // Rollback on error
        this.db!.run('ROLLBACK');
        dbLogger.error('Database migration failed, rolling back', error as Error);
        throw new Error(
          'Veritabanı migration işlemi başarısız oldu. Lütfen yedekten geri yükleyin.'
        );
      }
    }
  }

  private initializeSampleData(): void {
    // Örnek veri ekleme kaldırıldı - uygulama boş başlar
    // Kullanıcılar kendi verilerini ekleyecek
  }

  private initializeDefaultCategories(): void {
    const count = this.get<{ count: number }>('SELECT COUNT(*) as count FROM categories');
    if (count && count.count > 0) return;

    const categories = [
      // Satış Faturası Kategorileri (invoice_out - GELİR)
      { name: 'Daire/Konut Satışı', type: 'invoice_out', color: '#22c55e' },
      { name: 'Dükkan/Ofis Satışı', type: 'invoice_out', color: '#10b981' },
      { name: 'Arsa Satışı', type: 'invoice_out', color: '#14b8a6' },
      { name: 'Kira Geliri', type: 'invoice_out', color: '#06b6d4' },
      { name: 'Hakediş Faturası', type: 'invoice_out', color: '#3b82f6' },
      { name: 'Hizmet Geliri', type: 'invoice_out', color: '#6366f1' },
      { name: 'Diğer Gelir', type: 'invoice_out', color: '#84cc16' },

      // Alış Faturası Kategorileri (invoice_in - GİDER)
      { name: 'Arsa Maliyeti', type: 'invoice_in', color: '#ef4444' },
      { name: 'Hafriyat', type: 'invoice_in', color: '#f97316' },
      { name: 'Beton', type: 'invoice_in', color: '#84cc16' },
      { name: 'Demir/Çelik', type: 'invoice_in', color: '#64748b' },
      { name: 'İşçilik', type: 'invoice_in', color: '#8b5cf6' },
      { name: 'Kalıp/İskele', type: 'invoice_in', color: '#a855f7' },
      { name: 'Elektrik Malzeme', type: 'invoice_in', color: '#eab308' },
      { name: 'Sıhhi Tesisat', type: 'invoice_in', color: '#06b6d4' },
      { name: 'Boya/Kaplama', type: 'invoice_in', color: '#ec4899' },
      { name: 'Seramik/Fayans', type: 'invoice_in', color: '#14b8a6' },
      { name: 'Kapı/Pencere', type: 'invoice_in', color: '#f59e0b' },
      { name: 'Çatı/İzolasyon', type: 'invoice_in', color: '#78716c' },
      { name: 'Peyzaj', type: 'invoice_in', color: '#22c55e' },
      { name: 'Proje/Ruhsat', type: 'invoice_in', color: '#6366f1' },
      { name: 'Taşeron Faturası', type: 'invoice_in', color: '#0ea5e9' },
      { name: 'Nakliye', type: 'invoice_in', color: '#f43f5e' },
      { name: 'Ofis Kirası', type: 'invoice_in', color: '#ef4444' },
      { name: 'Elektrik/Su/Doğalgaz', type: 'invoice_in', color: '#f97316' },
      { name: 'Personel Maaşları', type: 'invoice_in', color: '#8b5cf6' },
      { name: 'SGK Primleri', type: 'invoice_in', color: '#a855f7' },
      { name: 'Vergi', type: 'invoice_in', color: '#ef4444' },
      { name: 'Muhasebe/Danışmanlık', type: 'invoice_in', color: '#6366f1' },
      { name: 'Araç Giderleri', type: 'invoice_in', color: '#64748b' },
      { name: 'Diğer Gider', type: 'invoice_in', color: '#71717a' },

      // Ödeme Kategorileri (payment - Tahsilat ve Ödeme için)
      { name: 'Nakit', type: 'payment', color: '#22c55e' },
      { name: 'EFT/Havale', type: 'payment', color: '#3b82f6' },
      { name: 'Çek', type: 'payment', color: '#f59e0b' },
      { name: 'Senet', type: 'payment', color: '#f97316' },
      { name: 'Kredi Kartı', type: 'payment', color: '#8b5cf6' },
      { name: 'Takas/Mahsup', type: 'payment', color: '#64748b' },
    ];

    this.beginTransaction();
    try {
      for (const cat of categories) {
        this.db!.run('INSERT INTO categories (name, type, color, is_default) VALUES (?, ?, ?, 1)', [
          cat.name,
          cat.type,
          cat.color,
        ]);
      }
      this.commit();
    } catch (error) {
      this.rollback();
      console.error('Error initializing categories:', error);
    }
  }

  // ==================== COMPANY METHODS ====================

  getAllCompanies(includeInactive = false): unknown[] {
    const query = includeInactive
      ? 'SELECT * FROM companies ORDER BY name'
      : 'SELECT * FROM companies WHERE is_active = 1 ORDER BY name';
    return this.all(query);
  }

  getCompaniesWithBalance(): unknown[] {
    return this.all(`
      SELECT
        c.*,
        COALESCE(SUM(CASE WHEN t.type = 'invoice_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as total_invoice_out,
        COALESCE(SUM(CASE WHEN t.type = 'payment_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as total_payment_in,
        COALESCE(SUM(CASE WHEN t.type = 'invoice_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as total_invoice_in,
        COALESCE(SUM(CASE WHEN t.type = 'payment_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as total_payment_out,
        COALESCE(SUM(CASE WHEN t.type = 'invoice_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'payment_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as receivable,
        COALESCE(SUM(CASE WHEN t.type = 'invoice_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'payment_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as payable,
        (COALESCE(SUM(CASE WHEN t.type = 'invoice_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN t.type = 'payment_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0)) -
        (COALESCE(SUM(CASE WHEN t.type = 'invoice_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN t.type = 'payment_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0)) as balance
      FROM companies c
      LEFT JOIN transactions t ON c.id = t.company_id
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY c.name
    `);
  }

  getCompanyById(id: number): unknown | undefined {
    return this.get('SELECT * FROM companies WHERE id = ?', [id]);
  }

  createCompany(data: Record<string, unknown>): unknown {
    const result = this.run(
      `
      INSERT INTO companies (type, account_type, name, tc_number, profession, tax_office,
        tax_number, trade_registry_no, contact_person, phone, email, address, bank_name, iban, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        data.type,
        data.account_type,
        data.name,
        data.tc_number || null,
        data.profession || null,
        data.tax_office || null,
        data.tax_number || null,
        data.trade_registry_no || null,
        data.contact_person || null,
        data.phone || null,
        data.email || null,
        data.address || null,
        data.bank_name || null,
        data.iban || null,
        data.notes || null,
      ]
    );
    return { id: result.lastInsertRowid, ...data };
  }

  updateCompany(id: number, data: Record<string, unknown>): unknown | undefined {
    this.run(
      `
      UPDATE companies SET
        type = ?, account_type = ?, name = ?, tc_number = ?, profession = ?,
        tax_office = ?, tax_number = ?, trade_registry_no = ?, contact_person = ?,
        phone = ?, email = ?, address = ?, bank_name = ?, iban = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        data.type,
        data.account_type,
        data.name,
        data.tc_number || null,
        data.profession || null,
        data.tax_office || null,
        data.tax_number || null,
        data.trade_registry_no || null,
        data.contact_person || null,
        data.phone || null,
        data.email || null,
        data.address || null,
        data.bank_name || null,
        data.iban || null,
        data.notes || null,
        id,
      ]
    );
    return this.getCompanyById(id);
  }

  deleteCompany(id: number): { success: boolean } {
    const company = this.getCompanyById(id);
    if (company) {
      this.run('INSERT INTO trash (type, data) VALUES (?, ?)', [
        'company',
        JSON.stringify(company),
      ]);
      this.run('UPDATE companies SET is_active = 0 WHERE id = ?', [id]);
    }
    return { success: true };
  }

  // ==================== PROJECT METHODS ====================

  getAllProjects(includeInactive = false): unknown[] {
    const query = includeInactive
      ? 'SELECT * FROM projects ORDER BY created_at DESC'
      : 'SELECT * FROM projects WHERE is_active = 1 ORDER BY created_at DESC';
    return this.all(query);
  }

  getProjectsWithSummary(): unknown[] {
    return this.all(`
      SELECT
        p.*,
        c.name as client_name,
        COALESCE(SUM(CASE WHEN t.type = 'invoice_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.type = 'invoice_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN t.type = 'invoice_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'invoice_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as profit_loss,
        COALESCE(SUM(CASE WHEN t.type = 'payment_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as total_collected,
        COALESCE(SUM(CASE WHEN t.type = 'payment_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as total_paid
      FROM projects p
      LEFT JOIN companies c ON p.client_company_id = c.id
      LEFT JOIN transactions t ON p.id = t.project_id
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
  }

  getProjectById(id: number): unknown | undefined {
    return this.get(
      `
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN companies c ON p.client_company_id = c.id
      WHERE p.id = ?
    `,
      [id]
    );
  }

  createProject(data: Record<string, unknown>): unknown {
    const result = this.run(
      `
      INSERT INTO projects (code, name, ownership_type, client_company_id, status, project_type,
        location, total_area, unit_count, estimated_budget, planned_start, planned_end,
        actual_start, actual_end, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        data.code,
        data.name,
        data.ownership_type,
        data.client_company_id || null,
        data.status || 'planned',
        data.project_type || null,
        data.location || null,
        data.total_area || null,
        data.unit_count || null,
        data.estimated_budget || null,
        data.planned_start || null,
        data.planned_end || null,
        data.actual_start || null,
        data.actual_end || null,
        data.description || null,
      ]
    );
    return { id: result.lastInsertRowid, ...data };
  }

  updateProject(id: number, data: Record<string, unknown>): unknown | undefined {
    this.run(
      `
      UPDATE projects SET
        code = ?, name = ?, ownership_type = ?, client_company_id = ?, status = ?,
        project_type = ?, location = ?, total_area = ?, unit_count = ?, estimated_budget = ?,
        planned_start = ?, planned_end = ?, actual_start = ?, actual_end = ?, description = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        data.code,
        data.name,
        data.ownership_type,
        data.client_company_id || null,
        data.status,
        data.project_type || null,
        data.location || null,
        data.total_area || null,
        data.unit_count || null,
        data.estimated_budget || null,
        data.planned_start || null,
        data.planned_end || null,
        data.actual_start || null,
        data.actual_end || null,
        data.description || null,
        id,
      ]
    );
    return this.getProjectById(id);
  }

  deleteProject(id: number): { success: boolean } {
    const project = this.getProjectById(id);
    if (project) {
      this.run('INSERT INTO trash (type, data) VALUES (?, ?)', [
        'project',
        JSON.stringify(project),
      ]);
      this.run('UPDATE projects SET is_active = 0 WHERE id = ?', [id]);
    }
    return { success: true };
  }

  generateProjectCode(): string {
    const year = new Date().getFullYear();
    const lastProject = this.get<{ code: string }>(
      'SELECT code FROM projects WHERE code LIKE ? ORDER BY code DESC LIMIT 1',
      [`PRJ-${year}-%`]
    );

    let nextNum = 1;
    if (lastProject) {
      const lastNum = parseInt(lastProject.code.split('-')[2]);
      nextNum = lastNum + 1;
    }
    return `PRJ-${year}-${String(nextNum).padStart(3, '0')}`;
  }

  // ==================== TRANSACTION METHODS ====================

  getAllTransactions(filters: TransactionFilters = {}): unknown[] {
    let query = `
      SELECT t.*, c.name as company_name, p.name as project_name, p.code as project_code,
             cat.name as category_name, cat.color as category_color
      FROM transactions t
      LEFT JOIN companies c ON t.company_id = c.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN categories cat ON t.category_id = cat.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.scope) {
      query += ' AND t.scope = ?';
      params.push(filters.scope);
    }
    if (filters.type) {
      query += ' AND t.type = ?';
      params.push(filters.type);
    }
    if (filters.company_id) {
      query += ' AND t.company_id = ?';
      params.push(filters.company_id);
    }
    if (filters.project_id) {
      query += ' AND t.project_id = ?';
      params.push(filters.project_id);
    }
    if (filters.start_date) {
      query += ' AND t.date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND t.date <= ?';
      params.push(filters.end_date);
    }
    if (filters.search) {
      query +=
        " AND (t.description LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\')";
      const searchTerm = createSafeLikePattern(filters.search);
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY t.date DESC, t.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return this.all(query, params);
  }

  getTransactionsByCompany(companyId: number, filters: TransactionFilters = {}): unknown[] {
    return this.getAllTransactions({ ...filters, company_id: companyId });
  }

  getTransactionsByProject(projectId: number, filters: TransactionFilters = {}): unknown[] {
    return this.getAllTransactions({ ...filters, project_id: projectId });
  }

  createTransaction(data: Record<string, unknown>): unknown {
    const amount = data.amount as number;
    const currency = (data.currency as string) || 'TRY';
    const exchangeRate = (data.exchange_rate as number) || 1;
    const amountTry = currency === 'TRY' ? amount : amount * exchangeRate;

    const result = this.run(
      `
      INSERT INTO transactions (scope, company_id, project_id, type, category_id, date,
        description, amount, currency, exchange_rate, amount_try, document_no, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        data.scope,
        data.company_id || null,
        data.project_id || null,
        data.type,
        data.category_id || null,
        data.date,
        data.description,
        amount,
        currency,
        exchangeRate,
        amountTry,
        data.document_no || null,
        data.notes || null,
      ]
    );
    return { id: result.lastInsertRowid, ...data, amount_try: amountTry };
  }

  updateTransaction(id: number, data: Record<string, unknown>): unknown | undefined {
    const amount = data.amount as number;
    const currency = (data.currency as string) || 'TRY';
    const exchangeRate = (data.exchange_rate as number) || 1;
    const amountTry = currency === 'TRY' ? amount : amount * exchangeRate;

    this.run(
      `
      UPDATE transactions SET
        scope = ?, company_id = ?, project_id = ?, type = ?, category_id = ?, date = ?,
        description = ?, amount = ?, currency = ?, exchange_rate = ?, amount_try = ?, document_no = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        data.scope,
        data.company_id || null,
        data.project_id || null,
        data.type,
        data.category_id || null,
        data.date,
        data.description,
        amount,
        currency,
        exchangeRate,
        amountTry,
        data.document_no || null,
        data.notes || null,
        id,
      ]
    );
    return this.get('SELECT * FROM transactions WHERE id = ?', [id]);
  }

  deleteTransaction(id: number): { success: boolean } {
    const transaction = this.get('SELECT * FROM transactions WHERE id = ?', [id]);
    if (transaction) {
      this.run('INSERT INTO trash (type, data) VALUES (?, ?)', [
        'transaction',
        JSON.stringify(transaction),
      ]);
      this.run('DELETE FROM transactions WHERE id = ?', [id]);
    }
    return { success: true };
  }

  // ==================== MATERIAL METHODS ====================

  getAllMaterials(includeInactive = false): unknown[] {
    const query = includeInactive
      ? 'SELECT * FROM materials ORDER BY name'
      : 'SELECT * FROM materials WHERE is_active = 1 ORDER BY name';
    return this.all(query);
  }

  getMaterialById(id: number): unknown | undefined {
    return this.get('SELECT * FROM materials WHERE id = ?', [id]);
  }

  createMaterial(data: Record<string, unknown>): unknown {
    const result = this.run(
      `
      INSERT INTO materials (code, name, category, unit, min_stock, current_stock, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        data.code,
        data.name,
        data.category || null,
        data.unit,
        data.min_stock || 0,
        data.current_stock || 0,
        data.notes || null,
      ]
    );
    return { id: result.lastInsertRowid, ...data };
  }

  updateMaterial(id: number, data: Record<string, unknown>): unknown | undefined {
    this.run(
      `
      UPDATE materials SET
        code = ?, name = ?, category = ?, unit = ?, min_stock = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        data.code,
        data.name,
        data.category || null,
        data.unit,
        data.min_stock || 0,
        data.notes || null,
        id,
      ]
    );
    return this.getMaterialById(id);
  }

  deleteMaterial(id: number): { success: boolean } {
    const material = this.getMaterialById(id);
    if (material) {
      this.run('INSERT INTO trash (type, data) VALUES (?, ?)', [
        'material',
        JSON.stringify(material),
      ]);
      this.run('UPDATE materials SET is_active = 0 WHERE id = ?', [id]);
    }
    return { success: true };
  }

  generateMaterialCode(): string {
    const lastMaterial = this.get<{ code: string }>(
      "SELECT code FROM materials WHERE code LIKE 'MLZ-%' ORDER BY code DESC LIMIT 1"
    );

    let nextNum = 1;
    if (lastMaterial) {
      const lastNum = parseInt(lastMaterial.code.split('-')[1]);
      nextNum = lastNum + 1;
    }
    return `MLZ-${String(nextNum).padStart(3, '0')}`;
  }

  // ==================== STOCK MOVEMENT METHODS ====================

  getAllStockMovements(filters: StockMovementFilters = {}): unknown[] {
    let query = `
      SELECT sm.*, m.name as material_name, m.unit as material_unit, m.code as material_code,
             p.name as project_name, c.name as company_name
      FROM stock_movements sm
      LEFT JOIN materials m ON sm.material_id = m.id
      LEFT JOIN projects p ON sm.project_id = p.id
      LEFT JOIN companies c ON sm.company_id = c.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.material_id) {
      query += ' AND sm.material_id = ?';
      params.push(filters.material_id);
    }
    if (filters.movement_type) {
      query += ' AND sm.movement_type = ?';
      params.push(filters.movement_type);
    }
    if (filters.project_id) {
      query += ' AND sm.project_id = ?';
      params.push(filters.project_id);
    }
    if (filters.start_date) {
      query += ' AND sm.date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND sm.date <= ?';
      params.push(filters.end_date);
    }

    query += ' ORDER BY sm.date DESC, sm.created_at DESC';
    return this.all(query, params);
  }

  createStockMovement(data: Record<string, unknown>): unknown {
    const quantity = data.quantity as number;
    const unitPrice = data.unit_price as number | undefined;
    const totalPrice = unitPrice ? quantity * unitPrice : null;

    const result = this.run(
      `
      INSERT INTO stock_movements (material_id, movement_type, quantity, unit_price, total_price,
        project_id, company_id, date, description, document_no)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        data.material_id,
        data.movement_type,
        quantity,
        unitPrice || null,
        totalPrice,
        data.project_id || null,
        data.company_id || null,
        data.date,
        data.description || null,
        data.document_no || null,
      ]
    );

    this.updateMaterialStock(data.material_id as number);

    return { id: result.lastInsertRowid, ...data };
  }

  private updateMaterialStock(materialId: number): void {
    const movements = this.all<{ movement_type: string; total: number }>(
      `
      SELECT movement_type, SUM(quantity) as total
      FROM stock_movements
      WHERE material_id = ?
      GROUP BY movement_type
    `,
      [materialId]
    );

    let stock = 0;
    for (const m of movements) {
      if (m.movement_type === 'in' || m.movement_type === 'adjustment') {
        stock += m.total;
      } else {
        stock -= m.total;
      }
    }

    this.run('UPDATE materials SET current_stock = ? WHERE id = ?', [stock, materialId]);
  }

  deleteStockMovement(id: number): { success: boolean } {
    const movement = this.get<{ material_id: number }>(
      'SELECT * FROM stock_movements WHERE id = ?',
      [id]
    );
    if (movement) {
      this.run('INSERT INTO trash (type, data) VALUES (?, ?)', [
        'stock_movement',
        JSON.stringify(movement),
      ]);
      this.run('DELETE FROM stock_movements WHERE id = ?', [id]);
      this.updateMaterialStock(movement.material_id);
    }
    return { success: true };
  }

  // ==================== PROJECT PARTIES METHODS ====================

  getProjectParties(projectId: number): unknown[] {
    return this.all(
      `
      SELECT pp.*, c.name as company_name, c.type as company_type, c.phone, c.email
      FROM project_parties pp
      JOIN companies c ON pp.company_id = c.id
      WHERE pp.project_id = ?
      ORDER BY pp.role, c.name
    `,
      [projectId]
    );
  }

  addProjectParty(data: Record<string, unknown>): unknown {
    const result = this.run(
      `
      INSERT OR REPLACE INTO project_parties (project_id, company_id, role, notes)
      VALUES (?, ?, ?, ?)
    `,
      [data.project_id, data.company_id, data.role, data.notes || null]
    );
    return { id: result.lastInsertRowid, ...data };
  }

  removeProjectParty(id: number): { success: boolean } {
    this.run('DELETE FROM project_parties WHERE id = ?', [id]);
    return { success: true };
  }

  // ==================== CATEGORY METHODS ====================

  getAllCategories(type: string | null = null): unknown[] {
    if (type) {
      return this.all('SELECT * FROM categories WHERE type = ? ORDER BY name', [type]);
    }
    return this.all('SELECT * FROM categories ORDER BY type, name');
  }

  createCategory(data: Record<string, unknown>): unknown {
    const result = this.run('INSERT INTO categories (name, type, color) VALUES (?, ?, ?)', [
      data.name,
      data.type,
      data.color || '#6366f1',
    ]);
    return { id: result.lastInsertRowid, ...data };
  }

  deleteCategory(id: number): { success: boolean } {
    const category = this.get<{ is_default: number }>('SELECT * FROM categories WHERE id = ?', [
      id,
    ]);
    if (category && !category.is_default) {
      this.run('DELETE FROM categories WHERE id = ?', [id]);
    }
    return { success: true };
  }

  // ==================== TRASH METHODS ====================

  getTrashItems(): unknown[] {
    return this.all('SELECT * FROM trash ORDER BY deleted_at DESC');
  }

  restoreFromTrash(trashId: number): { success: boolean; error?: string } {
    const trashItem = this.get<{ type: string; data: string }>('SELECT * FROM trash WHERE id = ?', [
      trashId,
    ]);
    if (!trashItem) return { success: false, error: 'Item not found' };

    const data = JSON.parse(trashItem.data);

    switch (trashItem.type) {
      case 'company':
        this.run('UPDATE companies SET is_active = 1 WHERE id = ?', [data.id]);
        break;
      case 'project':
        this.run('UPDATE projects SET is_active = 1 WHERE id = ?', [data.id]);
        break;
      case 'material':
        this.run('UPDATE materials SET is_active = 1 WHERE id = ?', [data.id]);
        break;
      case 'transaction':
        this.run(
          `
          INSERT INTO transactions (id, scope, company_id, project_id, type, category_id, date,
            description, amount, currency, exchange_rate, document_no, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            data.id,
            data.scope,
            data.company_id,
            data.project_id,
            data.type,
            data.category_id,
            data.date,
            data.description,
            data.amount,
            data.currency,
            data.exchange_rate,
            data.document_no,
            data.notes,
            data.created_at,
          ]
        );
        break;
      case 'stock_movement':
        this.run(
          `
          INSERT INTO stock_movements (id, material_id, movement_type, quantity, unit_price,
            total_price, project_id, company_id, date, description, document_no, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            data.id,
            data.material_id,
            data.movement_type,
            data.quantity,
            data.unit_price,
            data.total_price,
            data.project_id,
            data.company_id,
            data.date,
            data.description,
            data.document_no,
            data.created_at,
          ]
        );
        if (data.material_id) this.updateMaterialStock(data.material_id);
        break;
    }

    this.run('DELETE FROM trash WHERE id = ?', [trashId]);
    return { success: true };
  }

  permanentDeleteFromTrash(trashId: number): { success: boolean } {
    const trashItem = this.get<{ type: string; data: string }>('SELECT * FROM trash WHERE id = ?', [
      trashId,
    ]);
    if (!trashItem) return { success: false };

    const data = JSON.parse(trashItem.data);

    if (trashItem.type === 'company') {
      this.run('DELETE FROM companies WHERE id = ?', [data.id]);
    } else if (trashItem.type === 'project') {
      this.run('DELETE FROM projects WHERE id = ?', [data.id]);
    } else if (trashItem.type === 'material') {
      this.run('DELETE FROM materials WHERE id = ?', [data.id]);
    }

    this.run('DELETE FROM trash WHERE id = ?', [trashId]);
    return { success: true };
  }

  emptyTrash(): { success: boolean } {
    const items = this.getTrashItems() as { id: number }[];
    for (const item of items) {
      this.permanentDeleteFromTrash(item.id);
    }
    return { success: true };
  }

  // ==================== DASHBOARD METHODS ====================

  getDashboardStats(): Record<string, number> {
    // Gelir/Gider (Faturalar bazında - Kar/Zarar)
    const totalIncome =
      this.get<{ total: number }>(`
      SELECT COALESCE(SUM(COALESCE(amount_try, amount)), 0) as total FROM transactions WHERE type = 'invoice_out'
    `)?.total || 0;

    const totalExpense =
      this.get<{ total: number }>(`
      SELECT COALESCE(SUM(COALESCE(amount_try, amount)), 0) as total FROM transactions WHERE type = 'invoice_in'
    `)?.total || 0;

    // Nakit Akışı (Tahsilatlar ve Ödemeler)
    const totalCollected =
      this.get<{ total: number }>(`
      SELECT COALESCE(SUM(COALESCE(amount_try, amount)), 0) as total FROM transactions WHERE type = 'payment_in'
    `)?.total || 0;

    const totalPaid =
      this.get<{ total: number }>(`
      SELECT COALESCE(SUM(COALESCE(amount_try, amount)), 0) as total FROM transactions WHERE type = 'payment_out'
    `)?.total || 0;

    const activeProjects =
      this.get<{ count: number }>(`
      SELECT COUNT(*) as count FROM projects WHERE status = 'active' AND is_active = 1
    `)?.count || 0;

    const totalCompanies =
      this.get<{ count: number }>(`
      SELECT COUNT(*) as count FROM companies WHERE is_active = 1
    `)?.count || 0;

    // Toplam Alacak (Müşterilerden alacak = Satış Faturaları - Tahsilatlar)
    const receivables = this.all<{ total: number }>(`
      SELECT COALESCE(SUM(
        CASE WHEN t.type = 'invoice_out' THEN COALESCE(t.amount_try, t.amount)
             WHEN t.type = 'payment_in' THEN -COALESCE(t.amount_try, t.amount)
             ELSE 0 END
      ), 0) as total
      FROM transactions t
      WHERE t.company_id IS NOT NULL
      GROUP BY t.company_id
      HAVING total > 0
    `);
    const totalReceivables = receivables.reduce((sum, r) => sum + r.total, 0);

    // Toplam Borç (Tedarikçilere borç = Alış Faturaları - Ödemeler)
    const payables = this.all<{ total: number }>(`
      SELECT COALESCE(SUM(
        CASE WHEN t.type = 'invoice_in' THEN COALESCE(t.amount_try, t.amount)
             WHEN t.type = 'payment_out' THEN -COALESCE(t.amount_try, t.amount)
             ELSE 0 END
      ), 0) as total
      FROM transactions t
      WHERE t.company_id IS NOT NULL
      GROUP BY t.company_id
      HAVING total > 0
    `);
    const totalPayables = payables.reduce((sum, r) => sum + r.total, 0);

    const lowStockCount =
      this.get<{ count: number }>(`
      SELECT COUNT(*) as count FROM materials
      WHERE is_active = 1 AND current_stock < min_stock
    `)?.count || 0;

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      totalCollected,
      totalPaid,
      netCash: totalCollected - totalPaid,
      activeProjects,
      totalCompanies,
      totalReceivables,
      totalPayables,
      lowStockCount,
    };
  }

  getRecentTransactions(limit = 10): unknown[] {
    return this.getAllTransactions({ limit });
  }

  getTopDebtors(limit = 5): unknown[] {
    // Bize en çok borçlu olanlar (Alacak bakiyesi yüksek olanlar)
    return this.all(
      `
      SELECT
        c.id, c.name, c.type, c.account_type,
        COALESCE(SUM(CASE WHEN t.type = 'invoice_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'payment_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as balance
      FROM companies c
      LEFT JOIN transactions t ON c.id = t.company_id
      WHERE c.is_active = 1
      GROUP BY c.id
      HAVING balance > 0
      ORDER BY balance DESC
      LIMIT ?
    `,
      [limit]
    );
  }

  getTopCreditors(limit = 5): unknown[] {
    // Bizim en çok borçlu olduklarımız (Borç bakiyesi yüksek olanlar)
    return this.all(
      `
      SELECT
        c.id, c.name, c.type, c.account_type,
        COALESCE(SUM(CASE WHEN t.type = 'invoice_in' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'payment_out' THEN COALESCE(t.amount_try, t.amount) ELSE 0 END), 0) as balance
      FROM companies c
      LEFT JOIN transactions t ON c.id = t.company_id
      WHERE c.is_active = 1
      GROUP BY c.id
      HAVING balance > 0
      ORDER BY balance DESC
      LIMIT ?
    `,
      [limit]
    );
  }

  getLowStockMaterials(): unknown[] {
    return this.all(`
      SELECT * FROM materials
      WHERE is_active = 1 AND current_stock < min_stock
      ORDER BY (current_stock * 1.0 / NULLIF(min_stock, 0)) ASC
    `);
  }

  // ==================== ANALYTICS METHODS ====================

  getMonthlyStats(year: number): unknown[] {
    return this.all(
      `
      SELECT
        strftime('%m', date) as month,
        SUM(CASE WHEN type = 'invoice_out' THEN COALESCE(amount_try, amount) ELSE 0 END) as income,
        SUM(CASE WHEN type = 'invoice_in' THEN COALESCE(amount_try, amount) ELSE 0 END) as expense,
        SUM(CASE WHEN type = 'payment_in' THEN COALESCE(amount_try, amount) ELSE 0 END) as collected,
        SUM(CASE WHEN type = 'payment_out' THEN COALESCE(amount_try, amount) ELSE 0 END) as paid
      FROM transactions
      WHERE strftime('%Y', date) = ?
      GROUP BY strftime('%m', date)
      ORDER BY month
    `,
      [String(year)]
    );
  }

  getProjectCategoryBreakdown(projectId: number): unknown[] {
    return this.all(
      `
      SELECT
        cat.name as category,
        cat.color,
        SUM(COALESCE(t.amount_try, t.amount)) as total
      FROM transactions t
      LEFT JOIN categories cat ON t.category_id = cat.id
      WHERE t.project_id = ? AND t.type = 'invoice_in'
      GROUP BY t.category_id
      ORDER BY total DESC
    `,
      [projectId]
    );
  }

  getCompanyMonthlyStats(companyId: number, year: number): unknown[] {
    return this.all(
      `
      SELECT
        strftime('%m', date) as month,
        SUM(CASE WHEN type IN ('invoice_out', 'payment_in') THEN COALESCE(amount_try, amount) ELSE 0 END) as income,
        SUM(CASE WHEN type IN ('invoice_in', 'payment_out') THEN COALESCE(amount_try, amount) ELSE 0 END) as expense
      FROM transactions
      WHERE company_id = ? AND strftime('%Y', date) = ?
      GROUP BY strftime('%m', date)
      ORDER BY month
    `,
      [companyId, String(year)]
    );
  }

  // ==================== BACKUP METHODS ====================

  // Tek yedek dosyası oluştur/güncelle (eski yedekleri silmez, sadece son durumu kaydeder)
  createBackup(backupDir: string): string {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Sabit isimli tek bir yedek dosyası
    const backupPath = path.join(backupDir, 'latest_backup.db');

    const data = this.db!.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(backupPath, buffer);

    // Backup meta bilgisini kaydet
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

    return backupPath;
  }

  // Yedek bilgisini al
  getBackupInfo(backupDir: string): { exists: boolean; date?: string; size?: number } {
    const metaPath = path.join(backupDir, 'backup_meta.json');
    const backupPath = path.join(backupDir, 'latest_backup.db');

    if (!fs.existsSync(backupPath)) {
      return { exists: false };
    }

    try {
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        return { exists: true, date: meta.lastBackup, size: meta.size };
      }
      const stat = fs.statSync(backupPath);
      return { exists: true, date: stat.mtime.toISOString(), size: stat.size };
    } catch {
      return { exists: false };
    }
  }

  close(): void {
    if (this.db) {
      if (this._saveTimeout) {
        clearTimeout(this._saveTimeout);
        this._saveTimeout = null;
      }
      this.saveDatabase();
      this.db.close();
    }
  }
}

export default ERPDatabase;

/**
 * Material Repository
 *
 * Handles all database operations related to materials and stock.
 *
 * @module MaterialRepository
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import { BaseRepository, BaseEntity } from './BaseRepository';

/** Movement type for stock operations */
export type MovementType = 'in' | 'out' | 'adjustment' | 'waste';

/** Material entity interface */
export interface Material extends BaseEntity {
  code: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  unit_price?: number;
  notes?: string;
  is_active: boolean;
}

/** Material with calculated stock status */
export interface MaterialWithStock extends Material {
  stock_status: 'ok' | 'low' | 'critical';
  stock_value: number;
}

/** Stock movement entity */
export interface StockMovement extends BaseEntity {
  material_id: number;
  movement_type: MovementType;
  quantity: number;
  unit_price?: number;
  project_id?: number;
  supplier_id?: number;
  document_no?: string;
  notes?: string;
  date: string;
  material_name?: string;
  project_name?: string;
  supplier_name?: string;
}

/** Stock movement filter options */
export interface StockMovementFilters {
  material_id?: number;
  movement_type?: string;
  project_id?: number;
  start_date?: string;
  end_date?: string;
}

/**
 * Repository for material and stock operations
 */
export class MaterialRepository extends BaseRepository<Material> {
  protected tableName = 'materials';

  constructor(db: SqlJsDatabase) {
    super(db);
  }

  /**
   * Generate a unique material code
   */
  generateCode(): string {
    const result = this.queryOne<{ max_code: string }>(
      `SELECT MAX(code) as max_code FROM materials WHERE code LIKE 'MAT-%'`
    );

    if (result?.max_code) {
      const lastNum = parseInt(result.max_code.split('-')[1], 10);
      return `MAT-${String(lastNum + 1).padStart(5, '0')}`;
    }
    return 'MAT-00001';
  }

  /**
   * Create a new material
   */
  create(data: Omit<Material, 'id' | 'created_at' | 'updated_at'>): Material {
    const sql = `
      INSERT INTO materials (code, name, category, unit, current_stock, min_stock, unit_price, notes, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.code,
      data.name,
      data.category,
      data.unit,
      data.current_stock || 0,
      data.min_stock || 0,
      data.unit_price || null,
      data.notes || null,
      data.is_active !== false ? 1 : 0,
    ];

    const result = this.run(sql, params);
    return this.getById(result.lastInsertRowid!)!;
  }

  /**
   * Update a material
   */
  update(id: number, data: Partial<Omit<Material, 'id'>>): Material | undefined {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.code !== undefined) {
      fields.push('code = ?');
      params.push(data.code);
    }
    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.category !== undefined) {
      fields.push('category = ?');
      params.push(data.category);
    }
    if (data.unit !== undefined) {
      fields.push('unit = ?');
      params.push(data.unit);
    }
    if (data.current_stock !== undefined) {
      fields.push('current_stock = ?');
      params.push(data.current_stock);
    }
    if (data.min_stock !== undefined) {
      fields.push('min_stock = ?');
      params.push(data.min_stock);
    }
    if (data.unit_price !== undefined) {
      fields.push('unit_price = ?');
      params.push(data.unit_price);
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

    const sql = `UPDATE materials SET ${fields.join(', ')} WHERE id = ?`;
    this.run(sql, params);

    return this.getById(id);
  }

  /**
   * Delete a material (move to trash)
   */
  delete(id: number): { success: boolean } {
    const material = this.getById(id);
    if (!material) return { success: false };

    // Move to trash
    this.run(
      `INSERT INTO trash (entity_type, entity_id, data) VALUES (?, ?, ?)`,
      ['material', id, JSON.stringify(material)]
    );

    // Delete stock movements first
    this.run('DELETE FROM stock_movements WHERE material_id = ?', [id]);

    // Delete from materials
    this.run('DELETE FROM materials WHERE id = ?', [id]);

    return { success: true };
  }

  /**
   * Get materials with low stock
   */
  getLowStock(): Material[] {
    return this.query(
      'SELECT * FROM materials WHERE current_stock <= min_stock AND is_active = 1 ORDER BY name'
    );
  }

  /**
   * Update stock quantity
   */
  updateStock(id: number, quantity: number): Material | undefined {
    this.run(
      'UPDATE materials SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [quantity, id]
    );
    return this.getById(id);
  }

  // ==================== STOCK MOVEMENTS ====================

  /**
   * Get all stock movements with filters
   */
  getMovements(filters: StockMovementFilters = {}): StockMovement[] {
    let sql = `
      SELECT sm.*,
             m.name as material_name,
             p.name as project_name,
             c.name as supplier_name
      FROM stock_movements sm
      LEFT JOIN materials m ON sm.material_id = m.id
      LEFT JOIN projects p ON sm.project_id = p.id
      LEFT JOIN companies c ON sm.supplier_id = c.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.material_id) {
      sql += ' AND sm.material_id = ?';
      params.push(filters.material_id);
    }
    if (filters.movement_type) {
      sql += ' AND sm.movement_type = ?';
      params.push(filters.movement_type);
    }
    if (filters.project_id) {
      sql += ' AND sm.project_id = ?';
      params.push(filters.project_id);
    }
    if (filters.start_date) {
      sql += ' AND sm.date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      sql += ' AND sm.date <= ?';
      params.push(filters.end_date);
    }

    sql += ' ORDER BY sm.date DESC, sm.id DESC';

    return this.query<StockMovement>(sql, params);
  }

  /**
   * Create a stock movement and update material stock
   */
  createMovement(data: Omit<StockMovement, 'id' | 'created_at' | 'material_name' | 'project_name' | 'supplier_name'>): StockMovement {
    const material = this.getById(data.material_id);
    if (!material) throw new Error('Material not found');

    // Calculate new stock
    let newStock = material.current_stock;
    switch (data.movement_type) {
      case 'in':
        newStock += data.quantity;
        break;
      case 'out':
      case 'waste':
        newStock -= data.quantity;
        break;
      case 'adjustment':
        newStock = data.quantity; // Adjustment sets absolute value
        break;
    }

    // Insert movement
    const sql = `
      INSERT INTO stock_movements (material_id, movement_type, quantity, unit_price, project_id, supplier_id, document_no, notes, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.material_id,
      data.movement_type,
      data.quantity,
      data.unit_price || null,
      data.project_id || null,
      data.supplier_id || null,
      data.document_no || null,
      data.notes || null,
      data.date,
    ];

    const result = this.run(sql, params);

    // Update material stock
    this.updateStock(data.material_id, newStock);

    return this.queryOne<StockMovement>(
      `SELECT sm.*, m.name as material_name, p.name as project_name, c.name as supplier_name
       FROM stock_movements sm
       LEFT JOIN materials m ON sm.material_id = m.id
       LEFT JOIN projects p ON sm.project_id = p.id
       LEFT JOIN companies c ON sm.supplier_id = c.id
       WHERE sm.id = ?`,
      [result.lastInsertRowid]
    )!;
  }

  /**
   * Delete a stock movement and revert stock change
   */
  deleteMovement(id: number): { success: boolean } {
    const movement = this.queryOne<StockMovement>(
      'SELECT * FROM stock_movements WHERE id = ?',
      [id]
    );
    if (!movement) return { success: false };

    const material = this.getById(movement.material_id);
    if (!material) return { success: false };

    // Calculate reverted stock
    let newStock = material.current_stock;
    switch (movement.movement_type) {
      case 'in':
        newStock -= movement.quantity;
        break;
      case 'out':
      case 'waste':
        newStock += movement.quantity;
        break;
      // adjustment movements can't be simply reverted
    }

    // Delete movement
    this.run('DELETE FROM stock_movements WHERE id = ?', [id]);

    // Update material stock
    if (movement.movement_type !== 'adjustment') {
      this.updateStock(movement.material_id, newStock);
    }

    return { success: true };
  }
}

export default MaterialRepository;

/**
 * Category Repository
 *
 * Handles all database operations related to categories.
 *
 * @module CategoryRepository
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import { BaseRepository, BaseEntity } from './BaseRepository';

/** Category entity interface */
export interface Category extends BaseEntity {
  name: string;
  parent_id?: number;
  description?: string;
  is_active: boolean;
}

/** Category with children count */
export interface CategoryWithStats extends Category {
  children_count: number;
  transaction_count: number;
}

/**
 * Repository for category operations
 */
export class CategoryRepository extends BaseRepository<Category> {
  protected tableName = 'categories';

  constructor(db: SqlJsDatabase) {
    super(db);
  }

  /**
   * Get all categories with statistics
   */
  getWithStats(): CategoryWithStats[] {
    const sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM categories WHERE parent_id = c.id) as children_count,
        (SELECT COUNT(*) FROM transactions WHERE category_id = c.id) as transaction_count
      FROM categories c
      WHERE c.is_active = 1
      ORDER BY c.name
    `;
    return this.query<CategoryWithStats>(sql);
  }

  /**
   * Get root categories (no parent)
   */
  getRootCategories(): Category[] {
    return this.query(
      'SELECT * FROM categories WHERE parent_id IS NULL AND is_active = 1 ORDER BY name'
    );
  }

  /**
   * Get child categories
   */
  getChildren(parentId: number): Category[] {
    return this.query(
      'SELECT * FROM categories WHERE parent_id = ? AND is_active = 1 ORDER BY name',
      [parentId]
    );
  }

  /**
   * Create a new category
   */
  create(data: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Category {
    const sql = `
      INSERT INTO categories (name, parent_id, description, is_active)
      VALUES (?, ?, ?, ?)
    `;
    const params = [
      data.name,
      data.parent_id || null,
      data.description || null,
      data.is_active !== false ? 1 : 0,
    ];

    const result = this.run(sql, params);
    return this.getById(result.lastInsertRowid!)!;
  }

  /**
   * Update a category
   */
  update(id: number, data: Partial<Omit<Category, 'id'>>): Category | undefined {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.parent_id !== undefined) {
      fields.push('parent_id = ?');
      params.push(data.parent_id);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      params.push(data.description);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(data.is_active ? 1 : 0);
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`;
    this.run(sql, params);

    return this.getById(id);
  }

  /**
   * Delete a category (move to trash)
   */
  delete(id: number): { success: boolean } {
    const category = this.getById(id);
    if (!category) return { success: false };

    // Move to trash
    this.run(
      `INSERT INTO trash (entity_type, entity_id, data) VALUES (?, ?, ?)`,
      ['category', id, JSON.stringify(category)]
    );

    // Update children to have no parent
    this.run('UPDATE categories SET parent_id = NULL WHERE parent_id = ?', [id]);

    // Delete from categories
    this.run('DELETE FROM categories WHERE id = ?', [id]);

    return { success: true };
  }

  /**
   * Search categories by name
   */
  search(query: string, limit = 10): Category[] {
    const sql = `
      SELECT * FROM categories
      WHERE is_active = 1 AND name LIKE ?
      ORDER BY name
      LIMIT ?
    `;
    return this.query(sql, [`%${query}%`, limit]);
  }
}

export default CategoryRepository;

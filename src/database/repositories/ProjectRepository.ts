/**
 * Project Repository
 *
 * Handles all database operations related to projects.
 *
 * @module ProjectRepository
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import { BaseRepository, BaseEntity } from './BaseRepository';

/** Project status type */
export type ProjectStatus = 'planned' | 'active' | 'completed' | 'cancelled';

/** Project type */
export type ProjectType = 'residential' | 'villa' | 'commercial' | 'mixed' | 'infrastructure' | 'renovation';

/** Ownership type */
export type OwnershipType = 'own' | 'client';

/** Project entity interface */
export interface Project extends BaseEntity {
  code: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  ownership: OwnershipType;
  address?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  notes?: string;
  is_active: boolean;
}

/** Project with summary statistics */
export interface ProjectWithSummary extends Project {
  total_income: number;
  total_expense: number;
  profit: number;
  party_count: number;
}

/** Project party (stakeholder) */
export interface ProjectParty extends BaseEntity {
  project_id: number;
  company_id: number;
  role: string;
  share_percentage?: number;
  notes?: string;
  company_name?: string;
}

/**
 * Repository for project operations
 */
export class ProjectRepository extends BaseRepository<Project> {
  protected tableName = 'projects';

  constructor(db: SqlJsDatabase) {
    super(db);
  }

  /**
   * Get all projects with summary statistics
   */
  getWithSummary(): ProjectWithSummary[] {
    const sql = `
      SELECT
        p.*,
        COALESCE((SELECT SUM(amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END)
                  FROM transactions WHERE project_id = p.id AND type = 'invoice_out'), 0) as total_income,
        COALESCE((SELECT SUM(amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END)
                  FROM transactions WHERE project_id = p.id AND type = 'invoice_in'), 0) as total_expense,
        COALESCE((SELECT SUM(amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END)
                  FROM transactions WHERE project_id = p.id AND type = 'invoice_out'), 0) -
        COALESCE((SELECT SUM(amount * CASE currency WHEN 'USD' THEN 35 WHEN 'EUR' THEN 38 ELSE 1 END)
                  FROM transactions WHERE project_id = p.id AND type = 'invoice_in'), 0) as profit,
        (SELECT COUNT(*) FROM project_parties WHERE project_id = p.id) as party_count
      FROM projects p
      WHERE p.is_active = 1
      ORDER BY p.code DESC
    `;
    return this.query<ProjectWithSummary>(sql);
  }

  /**
   * Generate a unique project code
   */
  generateCode(): string {
    const year = new Date().getFullYear();
    const result = this.queryOne<{ max_code: string }>(
      `SELECT MAX(code) as max_code FROM projects WHERE code LIKE ?`,
      [`PRJ-${year}-%`]
    );

    if (result?.max_code) {
      const lastNum = parseInt(result.max_code.split('-')[2], 10);
      return `PRJ-${year}-${String(lastNum + 1).padStart(4, '0')}`;
    }
    return `PRJ-${year}-0001`;
  }

  /**
   * Create a new project
   */
  create(data: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Project {
    const sql = `
      INSERT INTO projects (code, name, type, status, ownership, address, start_date, end_date, budget, notes, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.code,
      data.name,
      data.type,
      data.status || 'planned',
      data.ownership || 'own',
      data.address || null,
      data.start_date || null,
      data.end_date || null,
      data.budget || null,
      data.notes || null,
      data.is_active !== false ? 1 : 0,
    ];

    const result = this.run(sql, params);
    return this.getById(result.lastInsertRowid!)!;
  }

  /**
   * Update a project
   */
  update(id: number, data: Partial<Omit<Project, 'id'>>): Project | undefined {
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
    if (data.type !== undefined) {
      fields.push('type = ?');
      params.push(data.type);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      params.push(data.status);
    }
    if (data.ownership !== undefined) {
      fields.push('ownership = ?');
      params.push(data.ownership);
    }
    if (data.address !== undefined) {
      fields.push('address = ?');
      params.push(data.address);
    }
    if (data.start_date !== undefined) {
      fields.push('start_date = ?');
      params.push(data.start_date);
    }
    if (data.end_date !== undefined) {
      fields.push('end_date = ?');
      params.push(data.end_date);
    }
    if (data.budget !== undefined) {
      fields.push('budget = ?');
      params.push(data.budget);
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

    const sql = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`;
    this.run(sql, params);

    return this.getById(id);
  }

  /**
   * Soft delete a project (move to trash)
   */
  delete(id: number): { success: boolean } {
    const project = this.getById(id);
    if (!project) return { success: false };

    // Move to trash
    this.run(
      `INSERT INTO trash (entity_type, entity_id, data) VALUES (?, ?, ?)`,
      ['project', id, JSON.stringify(project)]
    );

    // Delete project parties first
    this.run('DELETE FROM project_parties WHERE project_id = ?', [id]);

    // Delete from projects
    this.run('DELETE FROM projects WHERE id = ?', [id]);

    return { success: true };
  }

  /**
   * Get projects by status
   */
  getByStatus(status: ProjectStatus): Project[] {
    return this.query(
      'SELECT * FROM projects WHERE status = ? AND is_active = 1 ORDER BY code DESC',
      [status]
    );
  }

  // ==================== PROJECT PARTIES ====================

  /**
   * Get all parties for a project
   */
  getParties(projectId: number): ProjectParty[] {
    const sql = `
      SELECT pp.*, c.name as company_name
      FROM project_parties pp
      LEFT JOIN companies c ON pp.company_id = c.id
      WHERE pp.project_id = ?
      ORDER BY pp.role
    `;
    return this.query<ProjectParty>(sql, [projectId]);
  }

  /**
   * Add a party to a project
   */
  addParty(data: Omit<ProjectParty, 'id' | 'created_at' | 'company_name'>): ProjectParty {
    const sql = `
      INSERT INTO project_parties (project_id, company_id, role, share_percentage, notes)
      VALUES (?, ?, ?, ?, ?)
    `;
    const params = [
      data.project_id,
      data.company_id,
      data.role,
      data.share_percentage || null,
      data.notes || null,
    ];

    const result = this.run(sql, params);
    return this.queryOne<ProjectParty>(
      `SELECT pp.*, c.name as company_name FROM project_parties pp
       LEFT JOIN companies c ON pp.company_id = c.id
       WHERE pp.id = ?`,
      [result.lastInsertRowid]
    )!;
  }

  /**
   * Remove a party from a project
   */
  removeParty(partyId: number): { success: boolean } {
    this.run('DELETE FROM project_parties WHERE id = ?', [partyId]);
    return { success: true };
  }
}

export default ProjectRepository;

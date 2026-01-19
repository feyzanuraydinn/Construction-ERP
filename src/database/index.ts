/**
 * Database Module
 *
 * This module exports all database-related classes and types.
 *
 * @module database
 */

// Main database class (legacy, for backward compatibility)
export { default as ERPDatabase } from './database';

// New DatabaseService with repositories
export { DatabaseService, getDatabaseService } from './DatabaseService';

// Repositories
export * from './repositories';

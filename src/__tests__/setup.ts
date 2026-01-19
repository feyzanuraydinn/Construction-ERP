import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.electronAPI for tests
const mockElectronAPI = {
  company: {
    getAll: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
  },
  project: {
    getAll: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
  },
  transaction: {
    getAll: vi.fn().mockResolvedValue([]),
    getByCompany: vi.fn().mockResolvedValue([]),
    getByProject: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
  },
  category: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
  },
  material: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
  },
  analytics: {
    getDashboardStats: vi.fn().mockResolvedValue({
      totalCompanies: 0,
      totalProjects: 0,
      totalTransactions: 0,
    }),
    getCompanyBalance: vi.fn().mockResolvedValue(0),
    getProjectCategoryBreakdown: vi.fn().mockResolvedValue([]),
  },
  exchange: {
    getRates: vi.fn().mockResolvedValue({ USD: 30, EUR: 32 }),
  },
  settings: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
  },
  db: {
    backup: vi.fn().mockResolvedValue(true),
    restore: vi.fn().mockResolvedValue(true),
    checkIntegrity: vi.fn().mockResolvedValue(true),
    getStats: vi.fn().mockResolvedValue({}),
  },
};

// @ts-expect-error mock electronAPI
window.electronAPI = mockElectronAPI;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

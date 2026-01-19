import type {
  Company,
  CompanyWithBalance,
  CompanyFormData,
  Project,
  ProjectWithSummary,
  ProjectFormData,
  Transaction,
  TransactionWithDetails,
  TransactionFormData,
  TransactionFilters,
  Material,
  MaterialFormData,
  StockMovement,
  StockMovementWithDetails,
  StockMovementFormData,
  StockMovementFilters,
  Category,
  ProjectParty,
  ProjectPartyWithDetails,
  TrashItem,
  DashboardStats,
  DebtorCreditor,
  MonthlyStats,
  CategoryBreakdown,
  ExchangeRates,
  DriveBackupFile,
  DriveOperationResult,
} from './index';

export interface ElectronAPI {
  company: {
    getAll: () => Promise<Company[]>;
    getWithBalance: () => Promise<CompanyWithBalance[]>;
    getById: (id: number) => Promise<Company | undefined>;
    create: (data: CompanyFormData) => Promise<Company>;
    update: (id: number, data: CompanyFormData) => Promise<Company>;
    delete: (id: number) => Promise<{ success: boolean }>;
  };

  project: {
    getAll: () => Promise<Project[]>;
    getWithSummary: () => Promise<ProjectWithSummary[]>;
    getById: (id: number) => Promise<ProjectWithSummary | undefined>;
    create: (data: ProjectFormData) => Promise<Project>;
    update: (id: number, data: ProjectFormData) => Promise<Project>;
    delete: (id: number) => Promise<{ success: boolean }>;
    generateCode: () => Promise<string>;
    getParties: (projectId: number) => Promise<ProjectPartyWithDetails[]>;
    addParty: (data: {
      project_id: number;
      company_id: number;
      role: string;
      notes?: string;
    }) => Promise<ProjectParty>;
    removeParty: (id: number) => Promise<{ success: boolean }>;
  };

  transaction: {
    getAll: (filters?: TransactionFilters) => Promise<TransactionWithDetails[]>;
    getByCompany: (
      companyId: number,
      filters?: TransactionFilters
    ) => Promise<TransactionWithDetails[]>;
    getByProject: (
      projectId: number,
      filters?: TransactionFilters
    ) => Promise<TransactionWithDetails[]>;
    create: (data: TransactionFormData) => Promise<Transaction>;
    update: (id: number, data: TransactionFormData) => Promise<Transaction>;
    delete: (id: number) => Promise<{ success: boolean }>;
  };

  material: {
    getAll: () => Promise<Material[]>;
    getById: (id: number) => Promise<Material | undefined>;
    create: (data: MaterialFormData) => Promise<Material>;
    update: (id: number, data: MaterialFormData) => Promise<Material>;
    delete: (id: number) => Promise<{ success: boolean }>;
    generateCode: () => Promise<string>;
    getLowStock: () => Promise<Material[]>;
  };

  stock: {
    getAll: (filters?: StockMovementFilters) => Promise<StockMovementWithDetails[]>;
    create: (data: StockMovementFormData) => Promise<StockMovement>;
    delete: (id: number) => Promise<{ success: boolean }>;
  };

  category: {
    getAll: (type?: string) => Promise<Category[]>;
    create: (data: { name: string; type: string; color?: string }) => Promise<Category>;
    delete: (id: number) => Promise<{ success: boolean }>;
  };

  trash: {
    getAll: () => Promise<TrashItem[]>;
    restore: (id: number) => Promise<{ success: boolean; error?: string }>;
    permanentDelete: (id: number) => Promise<{ success: boolean }>;
    empty: () => Promise<{ success: boolean }>;
  };

  dashboard: {
    getStats: () => Promise<DashboardStats>;
    getRecentTransactions: (limit?: number) => Promise<TransactionWithDetails[]>;
    getTopDebtors: (limit?: number) => Promise<DebtorCreditor[]>;
    getTopCreditors: (limit?: number) => Promise<DebtorCreditor[]>;
  };

  analytics: {
    getMonthlyStats: (year: number) => Promise<MonthlyStats[]>;
    getProjectCategoryBreakdown: (projectId: number) => Promise<CategoryBreakdown[]>;
    getCompanyMonthlyStats: (companyId: number, year: number) => Promise<MonthlyStats[]>;
  };

  backup: {
    create: () => Promise<string>;
    list: () => Promise<{ name: string; path: string; size: number; date: string }[]>;
    restore: (backupPath: string) => Promise<{ success: boolean; error?: string }>;
    selectFolder: () => Promise<string | null>;
    openFolder: () => Promise<void>;
  };

  export: {
    toExcel: (data: { type: string; records: unknown[]; filename?: string }) => Promise<string>;
    toPDF: (data: { type: string; html: string; filename?: string }) => Promise<string>;
  };

  exchange: {
    getRates: () => Promise<ExchangeRates>;
  };

  gdrive: {
    hasCredentials: () => Promise<boolean>;
    isConnected: () => Promise<boolean>;
    saveCredentials: (clientId: string, clientSecret: string) => Promise<{ success: boolean }>;
    connect: () => Promise<DriveOperationResult>;
    disconnect: () => Promise<{ success: boolean }>;
    listBackups: () => Promise<DriveBackupFile[]>;
    uploadBackup: () => Promise<DriveOperationResult>;
    downloadBackup: (fileId: string, fileName: string) => Promise<DriveOperationResult>;
    deleteBackup: (fileId: string) => Promise<DriveOperationResult>;
  };

  app: {
    getVersion: () => Promise<string>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

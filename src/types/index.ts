// ==================== BASE TYPES ====================

export type CompanyType = 'person' | 'company';
export type AccountType = 'customer' | 'supplier' | 'subcontractor' | 'investor';
export type ProjectStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type ProjectType =
  | 'residential'
  | 'villa'
  | 'commercial'
  | 'mixed'
  | 'infrastructure'
  | 'renovation';
export type OwnershipType = 'own' | 'client';
export type TransactionType = 'invoice_out' | 'payment_in' | 'invoice_in' | 'payment_out';
export type TransactionScope = 'cari' | 'project' | 'company';
export type Currency = 'TRY' | 'USD' | 'EUR';
export type MovementType = 'in' | 'out' | 'adjustment' | 'waste';

// ==================== DATABASE MODELS ====================

export interface Company {
  id: number;
  type: CompanyType;
  account_type: AccountType;
  name: string;
  tc_number?: string | null;
  profession?: string | null;
  tax_office?: string | null;
  tax_number?: string | null;
  trade_registry_no?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  bank_name?: string | null;
  iban?: string | null;
  notes?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyWithBalance extends Company {
  total_invoice_out: number;
  total_payment_in: number;
  total_invoice_in: number;
  total_payment_out: number;
  receivable: number;
  payable: number;
  balance: number;
}

export interface Project {
  id: number;
  code: string;
  name: string;
  ownership_type: OwnershipType;
  client_company_id?: number | null;
  status: ProjectStatus;
  project_type?: ProjectType | null;
  location?: string | null;
  total_area?: number | null;
  unit_count?: number | null;
  estimated_budget?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  description?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithSummary extends Project {
  client_name?: string | null;
  total_income: number;
  total_expense: number;
  profit_loss: number;
  total_collected: number;
  total_paid: number;
}

export interface Category {
  id: number;
  name: string;
  type: 'invoice_out' | 'invoice_in' | 'payment';
  color: string;
  is_default: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  scope: TransactionScope;
  company_id?: number | null;
  project_id?: number | null;
  type: TransactionType;
  category_id?: number | null;
  date: string;
  description: string;
  amount: number;
  currency: Currency;
  exchange_rate: number;
  amount_try: number;
  document_no?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields from views/queries
  company_name?: string | null;
  project_name?: string | null;
  project_code?: string | null;
  category_name?: string | null;
  category_color?: string | null;
}

export interface TransactionWithDetails extends Transaction {
  company_name?: string | null;
  project_name?: string | null;
  project_code?: string | null;
  category_name?: string | null;
  category_color?: string | null;
}

export interface Material {
  id: number;
  code: string;
  name: string;
  category?: string | null;
  unit: string;
  min_stock: number;
  current_stock: number;
  notes?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  material_id: number;
  movement_type: MovementType;
  quantity: number;
  unit_price?: number | null;
  total_price?: number | null;
  project_id?: number | null;
  company_id?: number | null;
  date: string;
  description?: string | null;
  document_no?: string | null;
  created_at: string;
}

export interface StockMovementWithDetails extends StockMovement {
  material_name: string;
  material_unit: string;
  material_code: string;
  project_name?: string | null;
  company_name?: string | null;
}

export interface ProjectParty {
  id: number;
  project_id: number;
  company_id: number;
  role: AccountType;
  notes?: string | null;
  created_at: string;
}

export interface ProjectPartyWithDetails extends ProjectParty {
  company_name: string;
  company_type: CompanyType;
  phone?: string | null;
  email?: string | null;
}

export interface TrashItem {
  id: number;
  type: 'company' | 'project' | 'transaction' | 'material' | 'stock_movement';
  data: string;
  deleted_at: string;
}

// ==================== DASHBOARD TYPES ====================

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  totalCollected: number;
  totalPaid: number;
  netCash: number;
  activeProjects: number;
  totalCompanies: number;
  totalReceivables: number;
  totalPayables: number;
  lowStockCount: number;
}

export interface DebtorCreditor {
  id: number;
  name: string;
  type: CompanyType;
  account_type: AccountType;
  balance: number;
}

// ==================== ANALYTICS TYPES ====================

export interface MonthlyStats {
  month: string;
  income: number;
  expense: number;
  collected: number;
  paid: number;
}

export interface CategoryBreakdown {
  category: string;
  color: string;
  total: number;
}

// ==================== FILTER TYPES ====================

export interface TransactionFilters {
  scope?: TransactionScope;
  type?: TransactionType;
  company_id?: number;
  project_id?: number;
  start_date?: string;
  end_date?: string;
  search?: string;
  limit?: number;
}

export interface StockMovementFilters {
  material_id?: number;
  movement_type?: MovementType;
  project_id?: number;
  start_date?: string;
  end_date?: string;
}

// ==================== FORM DATA TYPES ====================

export interface CompanyFormData {
  type: CompanyType;
  account_type: AccountType;
  name: string;
  tc_number?: string;
  profession?: string;
  tax_office?: string;
  tax_number?: string;
  trade_registry_no?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  bank_name?: string;
  iban?: string;
  notes?: string;
}

export interface ProjectFormData {
  code: string;
  name: string;
  ownership_type: OwnershipType;
  client_company_id?: number | string;
  status: ProjectStatus;
  project_type?: ProjectType;
  location?: string;
  total_area?: number | string;
  unit_count?: number | string;
  estimated_budget?: number | string;
  planned_start?: string;
  planned_end?: string;
  actual_start?: string;
  actual_end?: string;
  description?: string;
}

export interface TransactionFormData {
  scope: TransactionScope;
  company_id?: number | string;
  project_id?: number | string;
  type: TransactionType;
  category_id?: number | string;
  date: string;
  description: string;
  amount: number | string;
  currency: Currency;
  exchange_rate?: number | string;
  document_no?: string;
  notes?: string;
}

export interface MaterialFormData {
  code: string;
  name: string;
  category?: string;
  unit: string;
  min_stock?: number | string;
  current_stock?: number | string;
  notes?: string;
}

export interface StockMovementFormData {
  material_id: number | string;
  movement_type: MovementType;
  quantity: number | string;
  unit_price?: number | string;
  project_id?: number | string;
  company_id?: number | string;
  date: string;
  description?: string;
  document_no?: string;
}

// ==================== UI TYPES ====================

export interface SelectOption {
  value: string | number;
  label: string;
}

export type BadgeVariant =
  | 'gray'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'purple'
  | 'default';
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

// ==================== EXCHANGE RATES ====================

export interface ExchangeRates {
  USD: number;
  EUR: number;
}

// ==================== GOOGLE DRIVE TYPES ====================

export interface DriveBackupFile {
  id: string;
  name: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
}

export interface DriveOperationResult {
  success: boolean;
  fileId?: string;
  error?: string;
}

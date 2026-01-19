import type {
  CompanyType,
  AccountType,
  ProjectStatus,
  ProjectType,
  OwnershipType,
  TransactionType,
  TransactionScope,
  Currency,
  MovementType,
  SelectOption,
} from '../types';

interface TypedSelectOption<T extends string> {
  value: T;
  label: string;
}

export const COMPANY_TYPES: TypedSelectOption<CompanyType>[] = [
  { value: 'person', label: 'Şahıs' },
  { value: 'company', label: 'Kuruluş' },
];

export const ACCOUNT_TYPES: TypedSelectOption<AccountType>[] = [
  { value: 'customer', label: 'Müşteri' },
  { value: 'supplier', label: 'Tedarikçi' },
  { value: 'subcontractor', label: 'Taşeron' },
  { value: 'investor', label: 'Yatırımcı' },
];

export const PROJECT_STATUSES: TypedSelectOption<ProjectStatus>[] = [
  { value: 'planned', label: 'Planlanan' },
  { value: 'active', label: 'Devam Eden' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'cancelled', label: 'İptal' },
];

export const PROJECT_TYPES: TypedSelectOption<ProjectType>[] = [
  { value: 'residential', label: 'Konut (Apartman/Site)' },
  { value: 'villa', label: 'Villa' },
  { value: 'commercial', label: 'Ticari (İşyeri/Plaza)' },
  { value: 'mixed', label: 'Karma (Konut + Ticari)' },
  { value: 'infrastructure', label: 'Altyapı' },
  { value: 'renovation', label: 'Tadilat/Renovasyon' },
];

export const OWNERSHIP_TYPES: TypedSelectOption<OwnershipType>[] = [
  { value: 'own', label: 'Kendi Projemiz' },
  { value: 'client', label: 'Müşteri Projesi' },
];

export const TRANSACTION_TYPES: TypedSelectOption<TransactionType>[] = [
  { value: 'invoice_out', label: 'Satış Faturası' },
  { value: 'payment_in', label: 'Tahsilat' },
  { value: 'invoice_in', label: 'Alış Faturası' },
  { value: 'payment_out', label: 'Ödeme' },
];

// İşlem tipleri grupları
export const INVOICE_TYPES: TransactionType[] = ['invoice_out', 'invoice_in'];
export const PAYMENT_TYPES: TransactionType[] = ['payment_in', 'payment_out'];
export const INCOME_TYPES: TransactionType[] = ['invoice_out']; // Gelir oluşturan
export const EXPENSE_TYPES: TransactionType[] = ['invoice_in']; // Gider oluşturan

// İşlem tipi label'ları
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  invoice_out: 'Satış Faturası',
  payment_in: 'Tahsilat',
  invoice_in: 'Alış Faturası',
  payment_out: 'Ödeme',
};

// İşlem tipi renkleri
export const TRANSACTION_TYPE_COLORS: Record<TransactionType, string> = {
  invoice_out: 'green',
  payment_in: 'blue',
  invoice_in: 'red',
  payment_out: 'orange',
};

export const TRANSACTION_SCOPES: TypedSelectOption<TransactionScope>[] = [
  { value: 'cari', label: 'Cari İşlem' },
  { value: 'project', label: 'Proje İşlemi' },
  { value: 'company', label: 'Firma Genel' },
];

export const CURRENCIES: TypedSelectOption<Currency>[] = [
  { value: 'TRY', label: 'TRY (₺)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
];

export const MOVEMENT_TYPES: TypedSelectOption<MovementType>[] = [
  { value: 'in', label: 'Giriş (Satın Alma)' },
  { value: 'out', label: 'Çıkış (Kullanım)' },
  { value: 'adjustment', label: 'Sayım Düzeltme' },
  { value: 'waste', label: 'Fire/Kayıp' },
];

export const MATERIAL_CATEGORIES: SelectOption[] = [
  { value: 'construction', label: 'İnşaat Malzemesi' },
  { value: 'steel', label: 'Demir/Çelik' },
  { value: 'electrical', label: 'Elektrik Malzemesi' },
  { value: 'plumbing', label: 'Sıhhi Tesisat' },
  { value: 'paint', label: 'Boya/Kaplama' },
  { value: 'wood', label: 'Ahşap/Kereste' },
  { value: 'other', label: 'Diğer' },
];

export const MATERIAL_UNITS: SelectOption[] = [
  { value: 'adet', label: 'Adet' },
  { value: 'kg', label: 'Kg' },
  { value: 'ton', label: 'Ton' },
  { value: 'm2', label: 'm²' },
  { value: 'm3', label: 'm³' },
  { value: 'lt', label: 'Litre' },
  { value: 'torba', label: 'Torba' },
  { value: 'paket', label: 'Paket' },
  { value: 'metre', label: 'Metre' },
];

export const MONTHS: SelectOption[] = [
  { value: '01', label: 'Ocak' },
  { value: '02', label: 'Şubat' },
  { value: '03', label: 'Mart' },
  { value: '04', label: 'Nisan' },
  { value: '05', label: 'Mayıs' },
  { value: '06', label: 'Haziran' },
  { value: '07', label: 'Temmuz' },
  { value: '08', label: 'Ağustos' },
  { value: '09', label: 'Eylül' },
  { value: '10', label: 'Ekim' },
  { value: '11', label: 'Kasım' },
  { value: '12', label: 'Aralık' },
];

// ============================================
// APPLICATION CONFIGURATION CONSTANTS
// ============================================

/**
 * Timing constants for UI and data operations
 */
export const TIMING = {
  /** Debounce delay for database saves (ms) */
  DB_SAVE_DEBOUNCE: 100,
  /** Debounce delay for search input (ms) */
  SEARCH_DEBOUNCE: 300,
  /** Debounce delay for form validation (ms) */
  FORM_VALIDATION_DEBOUNCE: 150,
  /** OAuth authentication timeout (ms) - 5 minutes */
  OAUTH_TIMEOUT: 300000,
  /** Exchange rate cache duration (ms) - 5 minutes */
  EXCHANGE_RATE_CACHE: 5 * 60 * 1000,
  /** Auto-close notification duration (ms) */
  TOAST_DURATION: 3000,
  /** Auto backup interval (ms) - 5 minutes */
  AUTO_BACKUP_INTERVAL: 5 * 60 * 1000,
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
  /** Default page size */
  DEFAULT_PAGE_SIZE: 25,
  /** Available page size options */
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  /** Number of page buttons to show */
  VISIBLE_PAGES: 5,
} as const;

/**
 * API and network configuration
 */
export const API = {
  /** Exchange rate API endpoint */
  EXCHANGE_RATE_URL: 'https://api.exchangerate-api.com/v4/latest/USD',
  /** OAuth redirect port */
  OAUTH_REDIRECT_PORT: 8089,
  /** Batch size for large data exports */
  EXPORT_BATCH_SIZE: 1000,
  /** Large export threshold for progress notification */
  LARGE_EXPORT_THRESHOLD: 5000,
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  /** Max read operations per second */
  READ_OPS_PER_SEC: 100,
  /** Max write operations per second */
  WRITE_OPS_PER_SEC: 30,
  /** Max delete operations per second */
  DELETE_OPS_PER_SEC: 10,
  /** Max heavy operations per second (backup, restore) */
  HEAVY_OPS_PER_SEC: 5,
  /** Default rate limit window (ms) */
  WINDOW_MS: 1000,
} as const;

/**
 * File and storage limits
 */
export const LIMITS = {
  /** Max log file size before rotation (bytes) - 5MB */
  MAX_LOG_FILE_SIZE: 5 * 1024 * 1024,
  /** Max number of log files to keep */
  MAX_LOG_FILES: 5,
  /** Max column width in Excel export */
  MAX_EXCEL_COLUMN_WIDTH: 50,
  /** Min column width in Excel export */
  MIN_EXCEL_COLUMN_WIDTH: 10,
} as const;

/**
 * UI configuration
 */
export const UI = {
  /** Minimum window width */
  MIN_WINDOW_WIDTH: 1200,
  /** Minimum window height */
  MIN_WINDOW_HEIGHT: 700,
  /** Default window width */
  DEFAULT_WINDOW_WIDTH: 1400,
  /** Default window height */
  DEFAULT_WINDOW_HEIGHT: 900,
  /** Sidebar collapsed width (px) */
  SIDEBAR_COLLAPSED_WIDTH: 80,
  /** Sidebar expanded width (px) */
  SIDEBAR_EXPANDED_WIDTH: 256,
} as const;

/**
 * Fallback values for external services
 */
export const FALLBACKS = {
  /** Fallback USD/TRY exchange rate */
  USD_RATE: 35,
  /** Fallback EUR/TRY exchange rate */
  EUR_RATE: 38,
} as const;

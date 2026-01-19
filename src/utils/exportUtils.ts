import { formatCurrency, formatDate } from './formatters';
import { TRANSACTION_TYPE_LABELS } from './constants';

// Turkish labels for export
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  customer: 'Müşteri',
  supplier: 'Tedarikçi',
  subcontractor: 'Taşeron',
  investor: 'Yatırımcı',
  landowner: 'Arsa Sahibi',
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planned: 'Planlanan',
  active: 'Devam Eden',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

const OWNERSHIP_TYPE_LABELS: Record<string, string> = {
  own: 'Kendi Projemiz',
  client: 'Müşteri Projesi',
};

const COMPANY_TYPE_LABELS: Record<string, string> = {
  person: 'Şahıs',
  company: 'Kuruluş',
};

// Column definitions for different data types
export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: unknown, row: unknown) => string;
}

// Transaction export columns
export const transactionColumns: ExportColumn[] = [
  { key: 'date', label: 'Tarih', format: (v) => formatDate(v as string) },
  {
    key: 'type',
    label: 'Tür',
    format: (v) =>
      TRANSACTION_TYPE_LABELS[v as keyof typeof TRANSACTION_TYPE_LABELS] || (v as string),
  },
  { key: 'description', label: 'Açıklama' },
  { key: 'company_name', label: 'Cari Hesap' },
  { key: 'project_name', label: 'Proje' },
  { key: 'category_name', label: 'Kategori' },
  { key: 'amount', label: 'Tutar', format: (v) => formatCurrency(v as number) },
  { key: 'currency', label: 'Para Birimi' },
  { key: 'document_no', label: 'Belge No' },
];

// Company export columns
export const companyColumns: ExportColumn[] = [
  { key: 'code', label: 'Kod' },
  { key: 'name', label: 'Firma Adı' },
  { key: 'type', label: 'Tür', format: (v) => COMPANY_TYPE_LABELS[v as string] || (v as string) },
  {
    key: 'account_type',
    label: 'Hesap Türü',
    format: (v) => ACCOUNT_TYPE_LABELS[v as string] || (v as string),
  },
  { key: 'tax_number', label: 'Vergi No' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'E-posta' },
  { key: 'address', label: 'Adres' },
  { key: 'balance', label: 'Bakiye', format: (v) => formatCurrency(v as number) },
];

// Project export columns
export const projectColumns: ExportColumn[] = [
  { key: 'code', label: 'Kod' },
  { key: 'name', label: 'Proje Adı' },
  {
    key: 'status',
    label: 'Durum',
    format: (v) => PROJECT_STATUS_LABELS[v as string] || (v as string),
  },
  {
    key: 'ownership_type',
    label: 'Sahiplik',
    format: (v) => OWNERSHIP_TYPE_LABELS[v as string] || (v as string),
  },
  { key: 'location', label: 'Konum' },
  { key: 'estimated_budget', label: 'Bütçe', format: (v) => formatCurrency(v as number) },
  { key: 'total_income', label: 'Toplam Gelir', format: (v) => formatCurrency(v as number) },
  { key: 'total_expense', label: 'Toplam Gider', format: (v) => formatCurrency(v as number) },
  { key: 'profit_loss', label: 'Kar/Zarar', format: (v) => formatCurrency(v as number) },
];

// Material export columns
export const materialColumns: ExportColumn[] = [
  { key: 'code', label: 'Kod' },
  { key: 'name', label: 'Malzeme Adı' },
  { key: 'category', label: 'Kategori' },
  { key: 'unit', label: 'Birim' },
  { key: 'current_stock', label: 'Mevcut Stok' },
  { key: 'min_stock', label: 'Min. Stok' },
];

// Stock movement export columns
export const stockMovementColumns: ExportColumn[] = [
  { key: 'date', label: 'Tarih', format: (v) => formatDate(v as string) },
  { key: 'movement_type', label: 'Hareket Türü' },
  { key: 'material_name', label: 'Malzeme' },
  { key: 'quantity', label: 'Miktar' },
  {
    key: 'unit_price',
    label: 'Birim Fiyat',
    format: (v) => (v ? formatCurrency(v as number) : '-'),
  },
  { key: 'total_price', label: 'Toplam', format: (v) => (v ? formatCurrency(v as number) : '-') },
  { key: 'project_name', label: 'Proje' },
  { key: 'company_name', label: 'Tedarikçi' },
];

// Format records for export based on column definitions
export function formatRecordsForExport<T>(
  records: T[],
  columns: ExportColumn[]
): Record<string, string>[] {
  return records.map((record) => {
    const formatted: Record<string, string> = {};
    columns.forEach((col) => {
      const value = (record as Record<string, unknown>)[col.key];
      formatted[col.label] = col.format
        ? col.format(value, record)
        : value === null || value === undefined
          ? ''
          : String(value);
    });
    return formatted;
  });
}

// Export to CSV via electron API
export async function exportToCSV(
  type: string,
  records: unknown[],
  filename?: string
): Promise<string> {
  try {
    const result = await window.electronAPI.export.toExcel({
      type,
      records,
      filename,
    });
    return result;
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

// Export to PDF via electron API
export async function exportToPDF(type: string, html: string, filename?: string): Promise<string> {
  try {
    const result = await window.electronAPI.export.toPDF({
      type,
      html,
      filename,
    });
    return result;
  } catch (error) {
    console.error('PDF export error:', error);
    throw error;
  }
}

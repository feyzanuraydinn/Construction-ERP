import React, { forwardRef } from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { TRANSACTION_TYPE_LABELS } from '../utils/constants';
import type {
  Project,
  Company,
  Transaction,
  AccountType,
  Category,
  TransactionType,
} from '../types';

// Helper function for transaction text colors
const getTransactionTextColor = (type: TransactionType): string => {
  switch (type) {
    case 'invoice_out':
      return 'text-green-700';
    case 'payment_in':
      return 'text-blue-700';
    case 'invoice_in':
      return 'text-red-700';
    case 'payment_out':
      return 'text-orange-700';
    default:
      return 'text-gray-700';
  }
};

// Helper to determine if transaction is positive (income-like) or negative (expense-like)
const isPositiveTransaction = (type: TransactionType): boolean => {
  return type === 'invoice_out' || type === 'payment_in';
};

// Generic print styles
export const printStyles = `
  @media print {
    @page {
      size: A4;
      margin: 15mm;
    }
    body {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .no-print {
      display: none !important;
    }
    .print-only {
      display: block !important;
    }
    .page-break {
      page-break-before: always;
    }
  }
`;

// Print header component
interface PrintHeaderProps {
  title: string;
  subtitle?: string;
  date?: string;
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({ title, subtitle, date }) => {
  return (
    <div className="mb-6 pb-4 border-b-2 border-gray-800">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
      <p className="text-sm text-gray-500 mt-2">
        Rapor Tarihi: {formatDate(date || new Date().toISOString())}
      </p>
    </div>
  );
};

// Stats row for print
interface PrintStat {
  label: string;
  value: string;
  color?: string;
}

interface PrintStatsProps {
  stats: PrintStat[];
}

export const PrintStats: React.FC<PrintStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <div key={index} className="bg-gray-50 p-3 rounded border">
          <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
          <p className={`text-lg font-bold ${stat.color || 'text-gray-900'}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
};

// Transaction table for print
interface PrintTransactionTableProps {
  transactions: Transaction[];
  showCompany?: boolean;
}

export const PrintTransactionTable: React.FC<PrintTransactionTableProps> = ({
  transactions,
  showCompany = true,
}) => {
  const totalInvoiceOut = transactions
    .filter((t) => t.type === 'invoice_out')
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
  const totalPaymentIn = transactions
    .filter((t) => t.type === 'payment_in')
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
  const totalInvoiceIn = transactions
    .filter((t) => t.type === 'invoice_in')
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
  const totalPaymentOut = transactions
    .filter((t) => t.type === 'payment_out')
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);

  const totalIncome = totalInvoiceOut + totalPaymentIn;
  const totalExpense = totalInvoiceIn + totalPaymentOut;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">İşlem Listesi</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-2 py-1.5 text-left">Tarih</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left">Tür</th>
            <th className="border border-gray-300 px-2 py-1.5 text-left">Açıklama</th>
            {showCompany && <th className="border border-gray-300 px-2 py-1.5 text-left">Cari</th>}
            <th className="border border-gray-300 px-2 py-1.5 text-left">Kategori</th>
            <th className="border border-gray-300 px-2 py-1.5 text-right">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td className="border border-gray-300 px-2 py-1">{formatDate(tx.date)}</td>
              <td className="border border-gray-300 px-2 py-1">
                <span className={getTransactionTextColor(tx.type)}>
                  {TRANSACTION_TYPE_LABELS[tx.type]}
                </span>
              </td>
              <td className="border border-gray-300 px-2 py-1">{tx.description}</td>
              {showCompany && (
                <td className="border border-gray-300 px-2 py-1">{tx.company_name || '-'}</td>
              )}
              <td className="border border-gray-300 px-2 py-1">{tx.category_name || '-'}</td>
              <td
                className={`border border-gray-300 px-2 py-1 text-right font-medium ${getTransactionTextColor(tx.type)}`}
              >
                {isPositiveTransaction(tx.type) ? '+' : '-'}
                {formatCurrency(tx.amount_try || tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-medium">
            <td
              colSpan={showCompany ? 5 : 4}
              className="border border-gray-300 px-2 py-1.5 text-right"
            >
              Satış Faturası:
            </td>
            <td className="border border-gray-300 px-2 py-1.5 text-right text-green-700">
              +{formatCurrency(totalInvoiceOut)}
            </td>
          </tr>
          <tr className="bg-gray-50 font-medium">
            <td
              colSpan={showCompany ? 5 : 4}
              className="border border-gray-300 px-2 py-1.5 text-right"
            >
              Tahsilat:
            </td>
            <td className="border border-gray-300 px-2 py-1.5 text-right text-blue-700">
              +{formatCurrency(totalPaymentIn)}
            </td>
          </tr>
          <tr className="bg-gray-50 font-medium">
            <td
              colSpan={showCompany ? 5 : 4}
              className="border border-gray-300 px-2 py-1.5 text-right"
            >
              Alış Faturası:
            </td>
            <td className="border border-gray-300 px-2 py-1.5 text-right text-red-700">
              -{formatCurrency(totalInvoiceIn)}
            </td>
          </tr>
          <tr className="bg-gray-50 font-medium">
            <td
              colSpan={showCompany ? 5 : 4}
              className="border border-gray-300 px-2 py-1.5 text-right"
            >
              Ödeme:
            </td>
            <td className="border border-gray-300 px-2 py-1.5 text-right text-orange-700">
              -{formatCurrency(totalPaymentOut)}
            </td>
          </tr>
          <tr className="bg-gray-100 font-bold">
            <td
              colSpan={showCompany ? 5 : 4}
              className="border border-gray-300 px-2 py-1.5 text-right"
            >
              Net:
            </td>
            <td
              className={`border border-gray-300 px-2 py-1.5 text-right ${totalIncome - totalExpense >= 0 ? 'text-green-700' : 'text-red-700'}`}
            >
              {formatCurrency(totalIncome - totalExpense)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

// Category breakdown type
interface CategoryBreakdown {
  category: string;
  total: number;
}

// Project party type
interface ProjectParty {
  id: number;
  role: AccountType;
  company_name: string;
  phone?: string | null;
  email?: string | null;
}

// Project Print View
interface ProjectPrintViewProps {
  project: Project;
  transactions: Transaction[];
  categoryBreakdown: CategoryBreakdown[];
  parties?: ProjectParty[];
}

export const ProjectPrintView = forwardRef<HTMLDivElement, ProjectPrintViewProps>(
  ({ project, transactions, categoryBreakdown, parties }, ref) => {
    const totalInvoiceOut = transactions
      .filter((t) => t.type === 'invoice_out')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
    const totalPaymentIn = transactions
      .filter((t) => t.type === 'payment_in')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
    const totalInvoiceIn = transactions
      .filter((t) => t.type === 'invoice_in')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
    const totalPaymentOut = transactions
      .filter((t) => t.type === 'payment_out')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);

    const totalIncome = totalInvoiceOut;
    const totalExpense = totalInvoiceIn;
    const profitLoss = totalIncome - totalExpense;
    const budgetUsed = project.estimated_budget
      ? (totalExpense / project.estimated_budget) * 100
      : 0;

    const roleLabels: Record<AccountType, string> = {
      customer: 'Müşteri',
      supplier: 'Tedarikçi',
      subcontractor: 'Taşeron',
      investor: 'Yatırımcı',
    };

    return (
      <div
        ref={ref}
        className="p-8 bg-white min-h-screen print-content"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        <PrintHeader
          title={project.name}
          subtitle={`Proje Kodu: ${project.code} | ${project.ownership_type === 'own' ? 'Kendi Projemiz' : 'Müşteri Projesi'}`}
        />

        {/* Project Info */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Proje Bilgileri</h3>
            <table className="text-sm">
              <tbody>
                {project.location && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Konum:</td>
                    <td>{project.location}</td>
                  </tr>
                )}
                {project.total_area && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Alan:</td>
                    <td>{project.total_area} m²</td>
                  </tr>
                )}
                {project.unit_count && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Birim Sayısı:</td>
                    <td>{project.unit_count}</td>
                  </tr>
                )}
                {project.estimated_budget && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Tahmini Bütçe:</td>
                    <td>{formatCurrency(project.estimated_budget)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Tarihler</h3>
            <table className="text-sm">
              <tbody>
                {project.planned_start && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Plan. Başlangıç:</td>
                    <td>{formatDate(project.planned_start)}</td>
                  </tr>
                )}
                {project.planned_end && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Plan. Bitiş:</td>
                    <td>{formatDate(project.planned_end)}</td>
                  </tr>
                )}
                {project.actual_start && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Gerçek Başlangıç:</td>
                    <td>{formatDate(project.actual_start)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary */}
        <PrintStats
          stats={[
            { label: 'Toplam Gelir', value: formatCurrency(totalIncome), color: 'text-green-700' },
            { label: 'Toplam Gider', value: formatCurrency(totalExpense), color: 'text-red-700' },
            {
              label: 'Kar/Zarar',
              value: formatCurrency(profitLoss),
              color: profitLoss >= 0 ? 'text-green-700' : 'text-red-700',
            },
            {
              label: 'Bütçe Kullanımı',
              value: `%${budgetUsed.toFixed(0)}`,
              color: budgetUsed > 90 ? 'text-red-700' : 'text-gray-900',
            },
          ]}
        />

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Gider Dağılımı</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1.5 text-left">Kategori</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-right">Tutar</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-right">Oran</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map((cat, index) => {
                  const total = categoryBreakdown.reduce((sum, c) => sum + c.total, 0);
                  return (
                    <tr key={index}>
                      <td className="border border-gray-300 px-2 py-1">{cat.category}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {formatCurrency(cat.total)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {((cat.total / total) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Parties */}
        {parties && parties.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Paydaşlar</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1.5 text-left">Rol</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-left">Cari</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-left">Telefon</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-left">E-posta</th>
                </tr>
              </thead>
              <tbody>
                {parties.map((party) => (
                  <tr key={party.id}>
                    <td className="border border-gray-300 px-2 py-1">
                      {roleLabels[party.role] || party.role}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">{party.company_name}</td>
                    <td className="border border-gray-300 px-2 py-1">{party.phone || '-'}</td>
                    <td className="border border-gray-300 px-2 py-1">{party.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Transactions */}
        <PrintTransactionTable transactions={transactions} showCompany={true} />

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-xs text-gray-500 text-center">
          Bu rapor {new Date().toLocaleDateString('tr-TR')} tarihinde oluşturulmuştur.
        </div>
      </div>
    );
  }
);

ProjectPrintView.displayName = 'ProjectPrintView';

// Filter type for company and company account views
interface TransactionFilters {
  type?: string;
  category_id?: string | number;
  startDate?: string;
  endDate?: string;
}

// Company Print View
interface CompanyPrintViewProps {
  company: Company;
  transactions: Transaction[];
  filters: TransactionFilters;
  categories?: Category[];
}

export const CompanyPrintView = forwardRef<HTMLDivElement, CompanyPrintViewProps>(
  ({ company, transactions, filters, categories = [] }, ref) => {
    // Transactions are already filtered by CompanyDetail, use directly
    const totalInvoiceOut = transactions
      .filter((t) => t.type === 'invoice_out')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
    const totalPaymentIn = transactions
      .filter((t) => t.type === 'payment_in')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
    const totalInvoiceIn = transactions
      .filter((t) => t.type === 'invoice_in')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
    const totalPaymentOut = transactions
      .filter((t) => t.type === 'payment_out')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);

    const totalIncome = totalInvoiceOut + totalPaymentIn;
    const totalExpense = totalInvoiceIn + totalPaymentOut;

    const typeLabels: Record<string, string> = {
      person: 'Şahıs',
      company: 'Kuruluş',
    };

    const accountTypeLabels: Record<string, string> = {
      customer: 'Müşteri',
      supplier: 'Tedarikçi',
      subcontractor: 'Taşeron',
      investor: 'Yatırımcı',
      landowner: 'Arsa Sahibi',
    };

    // Get category name by id
    const getCategoryName = (categoryId: string | number): string | null => {
      const cat = categories.find(
        (c) => c.id === (typeof categoryId === 'string' ? parseInt(categoryId) : categoryId)
      );
      return cat ? cat.name : null;
    };

    // Build filter description
    const buildFilterDescription = (): string[] => {
      const parts: string[] = [];
      if (filters.type)
        parts.push(
          `Tür: ${TRANSACTION_TYPE_LABELS[filters.type as TransactionType] || filters.type}`
        );
      if (filters.category_id) {
        const catName = getCategoryName(filters.category_id);
        if (catName) parts.push(`Kategori: ${catName}`);
      }
      if (filters.startDate) parts.push(`Başlangıç: ${formatDate(filters.startDate)}`);
      if (filters.endDate) parts.push(`Bitiş: ${formatDate(filters.endDate)}`);
      return parts;
    };

    const filterParts = buildFilterDescription();
    const hasFilters = filterParts.length > 0;

    return (
      <div
        ref={ref}
        className="p-8 bg-white min-h-screen print-content"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        <PrintHeader
          title={company.name}
          subtitle={`${typeLabels[company.type] || company.type} | ${accountTypeLabels[company.account_type] || company.account_type}`}
        />

        {/* Company Info */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">İletişim Bilgileri</h3>
            <table className="text-sm">
              <tbody>
                {company.phone && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Telefon:</td>
                    <td>{company.phone}</td>
                  </tr>
                )}
                {company.email && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">E-posta:</td>
                    <td>{company.email}</td>
                  </tr>
                )}
                {company.address && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Adres:</td>
                    <td>{company.address}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Vergi Bilgileri</h3>
            <table className="text-sm">
              <tbody>
                {company.tax_office && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Vergi Dairesi:</td>
                    <td>{company.tax_office}</td>
                  </tr>
                )}
                {company.tax_number && (
                  <tr>
                    <td className="pr-4 py-1 text-gray-500">Vergi No:</td>
                    <td>{company.tax_number}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Filter info */}
        {hasFilters && (
          <div className="mb-4 p-3 bg-gray-50 rounded border text-sm">
            <span className="font-medium">Uygulanan Filtreler: </span>
            {filterParts.join(' | ')}
          </div>
        )}

        {/* Financial Summary */}
        <PrintStats
          stats={[
            { label: 'Dönem Geliri', value: formatCurrency(totalIncome), color: 'text-green-700' },
            { label: 'Dönem Gideri', value: formatCurrency(totalExpense), color: 'text-red-700' },
            {
              label: 'Dönem Net',
              value: formatCurrency(totalIncome - totalExpense),
              color: totalIncome - totalExpense >= 0 ? 'text-green-700' : 'text-red-700',
            },
            { label: 'İşlem Sayısı', value: transactions.length.toString() },
          ]}
        />

        {/* Transactions */}
        <PrintTransactionTable transactions={transactions} showCompany={false} />

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-xs text-gray-500 text-center">
          Bu rapor {new Date().toLocaleDateString('tr-TR')} tarihinde oluşturulmuştur.
        </div>
      </div>
    );
  }
);

CompanyPrintView.displayName = 'CompanyPrintView';

// Company Account Print View (Firma Hesabı)
interface CompanyAccountPrintViewProps {
  transactions: Transaction[];
  filters: TransactionFilters;
  categories?: Category[];
}

export const CompanyAccountPrintView = forwardRef<HTMLDivElement, CompanyAccountPrintViewProps>(
  ({ transactions, filters, categories = [] }, ref) => {
    const totalInvoiceOut = transactions
      .filter((t) => t.type === 'invoice_out')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
    const totalPaymentIn = transactions
      .filter((t) => t.type === 'payment_in')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
    const totalInvoiceIn = transactions
      .filter((t) => t.type === 'invoice_in')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
    const totalPaymentOut = transactions
      .filter((t) => t.type === 'payment_out')
      .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);

    const totalIncome = totalInvoiceOut + totalPaymentIn;
    const totalExpense = totalInvoiceIn + totalPaymentOut;

    // Get category name by id
    const getCategoryName = (categoryId: string | number): string | null => {
      const cat = categories.find(
        (c) => c.id === (typeof categoryId === 'string' ? parseInt(categoryId) : categoryId)
      );
      return cat ? cat.name : null;
    };

    // Build filter description
    const buildFilterDescription = (): string[] => {
      const parts: string[] = [];
      if (filters.type)
        parts.push(
          `Tür: ${TRANSACTION_TYPE_LABELS[filters.type as TransactionType] || filters.type}`
        );
      if (filters.category_id) {
        const catName = getCategoryName(filters.category_id);
        if (catName) parts.push(`Kategori: ${catName}`);
      }
      if (filters.startDate) parts.push(`Başlangıç: ${formatDate(filters.startDate)}`);
      if (filters.endDate) parts.push(`Bitiş: ${formatDate(filters.endDate)}`);
      return parts;
    };

    const filterParts = buildFilterDescription();
    const hasFilters = filterParts.length > 0;

    // Group by category for summary (invoice_in and payment_out are expenses)
    const expenseByCategory = transactions
      .filter((t) => t.type === 'invoice_in' || t.type === 'payment_out')
      .reduce<Record<string, number>>((acc, t) => {
        const catName = t.category_name || 'Diğer';
        acc[catName] = (acc[catName] || 0) + (t.amount_try || t.amount);
        return acc;
      }, {});

    return (
      <div
        ref={ref}
        className="p-8 bg-white min-h-screen print-content"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        <PrintHeader title="Firma Hesabı Raporu" subtitle="Genel Firma Gelir ve Giderleri" />

        {/* Filter info */}
        {hasFilters && (
          <div className="mb-4 p-3 bg-gray-50 rounded border text-sm">
            <span className="font-medium">Uygulanan Filtreler: </span>
            {filterParts.join(' | ')}
          </div>
        )}

        {/* Financial Summary */}
        <PrintStats
          stats={[
            { label: 'Toplam Gelir', value: formatCurrency(totalIncome), color: 'text-green-700' },
            { label: 'Toplam Gider', value: formatCurrency(totalExpense), color: 'text-red-700' },
            {
              label: 'Net Durum',
              value: formatCurrency(totalIncome - totalExpense),
              color: totalIncome - totalExpense >= 0 ? 'text-green-700' : 'text-red-700',
            },
            { label: 'İşlem Sayısı', value: transactions.length.toString() },
          ]}
        />

        {/* Category Breakdown */}
        {Object.keys(expenseByCategory).length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Gider Dağılımı</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1.5 text-left">Kategori</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-right">Tutar</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-right">Oran</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(expenseByCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, amount], index) => {
                    return (
                      <tr key={index}>
                        <td className="border border-gray-300 px-2 py-1">{category}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {formatCurrency(amount)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {((amount / totalExpense) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* Transactions */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">İşlem Listesi</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1.5 text-left">Tarih</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left">Tür</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left">Kategori</th>
                <th className="border border-gray-300 px-2 py-1.5 text-left">Açıklama</th>
                <th className="border border-gray-300 px-2 py-1.5 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="border border-gray-300 px-2 py-1">{formatDate(tx.date)}</td>
                  <td className="border border-gray-300 px-2 py-1">
                    <span className={getTransactionTextColor(tx.type)}>
                      {TRANSACTION_TYPE_LABELS[tx.type]}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-2 py-1">{tx.category_name || '-'}</td>
                  <td className="border border-gray-300 px-2 py-1">{tx.description}</td>
                  <td
                    className={`border border-gray-300 px-2 py-1 text-right font-medium ${getTransactionTextColor(tx.type)}`}
                  >
                    {isPositiveTransaction(tx.type) ? '+' : '-'}
                    {formatCurrency(tx.amount_try || tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-medium">
                <td colSpan={4} className="border border-gray-300 px-2 py-1.5 text-right">
                  Satış Faturası:
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right text-green-700">
                  +{formatCurrency(totalInvoiceOut)}
                </td>
              </tr>
              <tr className="bg-gray-50 font-medium">
                <td colSpan={4} className="border border-gray-300 px-2 py-1.5 text-right">
                  Tahsilat:
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right text-blue-700">
                  +{formatCurrency(totalPaymentIn)}
                </td>
              </tr>
              <tr className="bg-gray-50 font-medium">
                <td colSpan={4} className="border border-gray-300 px-2 py-1.5 text-right">
                  Alış Faturası:
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right text-red-700">
                  -{formatCurrency(totalInvoiceIn)}
                </td>
              </tr>
              <tr className="bg-gray-50 font-medium">
                <td colSpan={4} className="border border-gray-300 px-2 py-1.5 text-right">
                  Ödeme:
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right text-orange-700">
                  -{formatCurrency(totalPaymentOut)}
                </td>
              </tr>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={4} className="border border-gray-300 px-2 py-1.5 text-right">
                  Net:
                </td>
                <td
                  className={`border border-gray-300 px-2 py-1.5 text-right ${totalIncome - totalExpense >= 0 ? 'text-green-700' : 'text-red-700'}`}
                >
                  {formatCurrency(totalIncome - totalExpense)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-xs text-gray-500 text-center">
          Bu rapor {new Date().toLocaleDateString('tr-TR')} tarihinde oluşturulmuştur.
        </div>
      </div>
    );
  }
);

CompanyAccountPrintView.displayName = 'CompanyAccountPrintView';

// Print button component
interface PrintButtonProps {
  onClick: () => void;
  className?: string;
}

export const PrintButton: React.FC<PrintButtonProps> = ({ onClick, className = '' }) => {
  return (
    <button onClick={onClick} className={`btn btn-secondary flex items-center gap-2 ${className}`}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
        />
      </svg>
      Yazdır
    </button>
  );
};

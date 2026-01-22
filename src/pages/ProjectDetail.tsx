import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiMapPin,
  FiGrid,
  FiDollarSign,
  FiPrinter,
} from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ProjectPrintView } from '../components/PrintView';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Select,
  Textarea,
  Modal,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  StatCard,
  StatusBadge,
  Badge,
  EmptyState,
  ConfirmDialog,
  Pagination,
} from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { useKeyboardShortcuts, usePagination, paginateArray } from '../hooks';
import { formatCurrency, formatDate, formatDateForInput } from '../utils/formatters';
import {
  TRANSACTION_TYPES,
  CURRENCIES,
  TRANSACTION_TYPE_LABELS,
  INCOME_TYPES,
  EXPENSE_TYPES,
} from '../utils/constants';
import type {
  Project,
  TransactionWithDetails,
  Company,
  Category,
  CategoryBreakdown,
  TransactionType,
  Currency,
  AccountType,
} from '../types';

const COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

// Helper functions for transaction colors
const getTransactionTextColor = (type: TransactionType): string => {
  switch (type) {
    case 'invoice_out':
      return 'text-green-600';
    case 'payment_in':
      return 'text-blue-600';
    case 'invoice_in':
      return 'text-red-600';
    case 'payment_out':
      return 'text-orange-600';
    default:
      return 'text-gray-600';
  }
};

const getTransactionBadgeVariant = (
  type: TransactionType
): 'success' | 'info' | 'danger' | 'warning' => {
  switch (type) {
    case 'invoice_out':
      return 'success';
    case 'payment_in':
      return 'info';
    case 'invoice_in':
      return 'danger';
    case 'payment_out':
      return 'warning';
    default:
      return 'info';
  }
};

// Check if transaction is income-generating (invoice_out) or expense-generating (invoice_in)
const isIncomeType = (type: TransactionType): boolean => INCOME_TYPES.includes(type);
const isExpenseType = (type: TransactionType): boolean => EXPENSE_TYPES.includes(type);

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionWithDetails | null;
  projectId: number;
  companies: Company[];
  categories: Category[];
  onSave: (isNew: boolean) => void;
}

interface TransactionFormData {
  type: TransactionType;
  date: string;
  description: string;
  amount: string;
  currency: Currency;
  category_id: string;
  company_id: string;
  document_no: string;
  notes: string;
}

function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'parties'>('transactions');
  const [filterType, setFilterType] = useState('');
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithDetails | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<TransactionWithDetails | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TransactionWithDetails | null>(null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [stakeholderDetailModal, setStakeholderDetailModal] = useState<{
    company_id: number;
    company_name: string;
  } | null>(null);
  // Toplu seçim state'leri
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Filtered transactions (must be before pagination hook)
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType && tx.type !== filterType) return false;
      if (filterCompanyId && String(tx.company_id) !== filterCompanyId) return false;
      return true;
    });
  }, [transactions, filterType, filterCompanyId]);

  // Pagination hook - must be called unconditionally
  const txPagination = usePagination({
    totalItems: filteredTransactions.length,
    initialPageSize: 25,
  });

  const paginatedTransactions = useMemo(() => {
    return paginateArray(filteredTransactions, txPagination.currentPage, txPagination.pageSize);
  }, [filteredTransactions, txPagination.currentPage, txPagination.pageSize]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNew: () => setModalOpen(true),
    onEscape: () => {
      if (modalOpen) {
        setModalOpen(false);
        setEditingTransaction(null);
      }
    },
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const numericId = parseInt(id, 10);
      const [projectData, txData, companiesData, categoriesData, breakdown] = await Promise.all([
        window.electronAPI.project.getById(numericId),
        window.electronAPI.transaction.getByProject(numericId),
        window.electronAPI.company.getAll(),
        window.electronAPI.category.getAll(),
        window.electronAPI.analytics.getProjectCategoryBreakdown(numericId),
      ]);
      setProject(projectData || null);
      setTransactions(txData);
      setCompanies(companiesData);
      setCategories(categoriesData);
      setCategoryBreakdown(breakdown);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteConfirm) return;
    try {
      await window.electronAPI.transaction.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success('İşlem başarıyla silindi');
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Silme sırasında hata oluştu');
    }
  };

  // Toplu seçim fonksiyonları
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredTransactions.map((tx) => tx.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => window.electronAPI.transaction.delete(id))
      );
      toast.success(`${selectedIds.size} işlem başarıyla silindi`);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      loadData();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Toplu silme sırasında hata oluştu');
    }
  };

  const handleSaveTransaction = (isNew: boolean) => {
    setModalOpen(false);
    setEditingTransaction(null);
    toast.success(isNew ? 'İşlem başarıyla oluşturuldu' : 'İşlem başarıyla güncellendi');
    loadData();
  };

  const handlePrint = () => {
    setPrintPreviewOpen(true);
  };

  const executePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center page-container">
        <div className="w-12 h-12 spinner"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-container">
        <EmptyState
          title="Proje bulunamadı"
          description="Aradığınız proje mevcut değil"
          action={() => navigate('/projects')}
          actionLabel="Projelere Dön"
        />
      </div>
    );
  }

  const totalIncome = transactions
    .filter((t) => isIncomeType(t.type))
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
  const totalExpense = transactions
    .filter((t) => isExpenseType(t.type))
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
  const profitLoss = totalIncome - totalExpense;
  const budgetUsed = project.estimated_budget ? (totalExpense / project.estimated_budget) * 100 : 0;

  // İşlemlerde geçen benzersiz carileri al (paydaşlar için)
  const stakeholders = transactions.reduce(
    (acc, tx) => {
      if (tx.company_id && tx.company_name) {
        const existing = acc.find((s) => s.company_id === tx.company_id);
        if (existing) {
          existing.transaction_count += 1;
          existing.total_amount += tx.amount_try || tx.amount;
        } else {
          const company = companies.find((c) => c.id === tx.company_id);
          acc.push({
            company_id: tx.company_id,
            company_name: tx.company_name,
            account_type: (company?.account_type || 'customer') as AccountType,
            phone: company?.phone || '',
            email: company?.email || '',
            transaction_count: 1,
            total_amount: tx.amount_try || tx.amount,
          });
        }
      }
      return acc;
    },
    [] as {
      company_id: number;
      company_name: string;
      account_type: AccountType;
      phone: string;
      email: string;
      transaction_count: number;
      total_amount: number;
    }[]
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 transition-colors rounded-lg hover:bg-gray-100"
          >
            <FiArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title">{project.name}</h1>
              <StatusBadge status={project.status} />
              <Badge variant={project.ownership_type === 'own' ? 'info' : 'purple'}>
                {project.ownership_type === 'own' ? 'Kendi Projemiz' : 'Müşteri Projesi'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">{project.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 btn btn-secondary">
            <FiPrinter size={16} />
            Yazdır
          </button>
          <Button icon={FiPlus} onClick={() => setModalOpen(true)}>
            Yeni İşlem
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4">
        <StatCard title="Toplam Gelir" value={formatCurrency(totalIncome)} color="green" />
        <StatCard title="Toplam Gider" value={formatCurrency(totalExpense)} color="red" />
        <StatCard
          title="Kar/Zarar"
          value={formatCurrency(profitLoss)}
          color={profitLoss >= 0 ? 'green' : 'red'}
          highlighted
        />
        <StatCard
          title="Bütçe Durumu"
          value={project.estimated_budget ? `%${budgetUsed.toFixed(0)}` : '-'}
          subtitle={
            project.estimated_budget
              ? `${formatCurrency(totalExpense)} / ${formatCurrency(project.estimated_budget)}`
              : '-/-'
          }
          color={
            !project.estimated_budget
              ? 'gray'
              : budgetUsed > 90
                ? 'red'
                : budgetUsed > 70
                  ? 'yellow'
                  : 'green'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Project Info */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Proje Bilgileri</h3>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              {!project.location &&
              !project.total_area &&
              !project.estimated_budget &&
              !project.planned_start &&
              !project.planned_end &&
              !project.actual_start &&
              !project.description ? (
                <p className="text-gray-500">Projeye ait bilgi eklenmemiş</p>
              ) : (
                <>
                  {project.location && (
                    <div className="flex items-start gap-3">
                      <FiMapPin className="text-gray-400 mt-0.5" />
                      <span>{project.location}</span>
                    </div>
                  )}
                  {project.total_area && (
                    <div className="flex items-center gap-3">
                      <FiGrid className="text-gray-400" />
                      <span>
                        {project.total_area} m2 - {project.unit_count || '-'} birim
                      </span>
                    </div>
                  )}
                  {project.estimated_budget && (
                    <div className="flex items-center gap-3">
                      <FiDollarSign className="text-gray-400" />
                      <span>Bütçe: {formatCurrency(project.estimated_budget)}</span>
                    </div>
                  )}
                  {(project.planned_start || project.planned_end || project.actual_start) && (
                    <div className="pt-2 space-y-2 border-t">
                      {project.planned_start && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Planlanan Başlangıç</span>
                          <span>{formatDate(project.planned_start)}</span>
                        </div>
                      )}
                      {project.planned_end && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Planlanan Bitiş</span>
                          <span>{formatDate(project.planned_end)}</span>
                        </div>
                      )}
                      {project.actual_start && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Gerçek Başlangıç</span>
                          <span>{formatDate(project.actual_start)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {project.description && (
                    <div className="pt-2 border-t">
                      <p className="mb-1 text-gray-500">Açıklama</p>
                      <p>{project.description}</p>
                    </div>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          {/* Category Breakdown Chart - Donut Style */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Gider Dağılımı</h3>
            </CardHeader>
            <CardBody className="p-4">
              {categoryBreakdown.length === 0 ? (
                <p className="py-4 text-center text-gray-500">Gider kaydı yok</p>
              ) : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color || COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Custom Legend */}
                  <div className="flex flex-wrap justify-center px-2 mt-2 gap-x-3 gap-y-1">
                    {categoryBreakdown.map((entry, index) => {
                      const total = categoryBreakdown.reduce((sum, e) => sum + e.total, 0);
                      return (
                        <div key={index} className="flex items-center gap-1 text-xs">
                          <div
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{
                              backgroundColor: entry.color || COLORS[index % COLORS.length],
                            }}
                          />
                          <span
                            className="text-gray-600 truncate max-w-[80px]"
                            title={entry.category}
                          >
                            {entry.category}
                          </span>
                          <span className="text-gray-400">
                            {((entry.total / total) * 100).toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <Card>
            {/* Tab Navigation */}
            <div className="border-b border-gray-100">
              <div className="flex items-center justify-between px-4 min-h-[56px]">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'transactions'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    İşlemler
                  </button>
                  <button
                    onClick={() => setActiveTab('parties')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'parties'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Paydaşlar
                  </button>
                  {activeTab === 'transactions' && selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 ml-3">
                      <div className="w-px h-6 bg-gray-300" />
                      <button
                        onClick={() => setBulkDeleteConfirm(true)}
                        className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 btn"
                      >
                        <FiTrash2 size={16} />
                        {selectedIds.size} işlem sil
                      </button>
                    </div>
                  )}
                </div>
                {activeTab === 'transactions' && (
                  <div className="flex items-center gap-2">
                    <Select
                      options={TRANSACTION_TYPES}
                      value={filterType}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setFilterType(e.target.value)
                      }
                      placeholder="Tüm Türler"
                      className="w-36"
                    />
                    <Select
                      options={stakeholders.map((s) => ({
                        value: s.company_id,
                        label: s.company_name,
                      }))}
                      value={filterCompanyId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setFilterCompanyId(e.target.value)
                      }
                      placeholder="Tüm Cariler"
                      className="w-44"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tab Content */}
            <CardBody className="p-0">
              {activeTab === 'transactions' && (
                <>
                  {filteredTransactions.length === 0 ? (
                    <EmptyState title="İşlem bulunamadı" />
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow hover={false}>
                            <TableHead className="w-10">
                              <input
                                type="checkbox"
                                checked={
                                  paginatedTransactions.length > 0 &&
                                  paginatedTransactions.every((tx) => selectedIds.has(tx.id))
                                }
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                            </TableHead>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Tür</TableHead>
                            <TableHead>Açıklama</TableHead>
                            <TableHead>Cari</TableHead>
                            <TableHead className="text-right">Tutar</TableHead>
                            <TableHead className="text-center">İşlem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedTransactions.map((tx) => (
                            <TableRow
                              key={tx.id}
                              className={`cursor-pointer ${selectedIds.has(tx.id) ? 'bg-blue-50' : ''}`}
                              onClick={() => setViewingTransaction(tx)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(tx.id)}
                                  onChange={(e) => handleSelectOne(tx.id, e.target.checked)}
                                  className="w-4 h-4 rounded border-gray-300"
                                />
                              </TableCell>
                              <TableCell>{formatDate(tx.date)}</TableCell>
                              <TableCell>
                                <Badge variant={getTransactionBadgeVariant(tx.type)}>
                                  {TRANSACTION_TYPE_LABELS[tx.type]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="font-medium">{tx.description}</p>
                                {tx.category_name && (
                                  <p className="text-xs text-gray-500">{tx.category_name}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                {tx.company_name || <span className="text-gray-400">-</span>}
                              </TableCell>
                              <TableCell
                                className={`text-right font-medium ${getTransactionTextColor(tx.type)}`}
                              >
                                {isIncomeType(tx.type) ? '+' : isExpenseType(tx.type) ? '-' : ''}
                                {formatCurrency(tx.amount, tx.currency)}
                              </TableCell>
                              <TableCell>
                                <div
                                  className="flex items-center justify-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => {
                                      setEditingTransaction(tx);
                                      setModalOpen(true);
                                    }}
                                    className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                                  >
                                    <FiEdit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(tx)}
                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <FiTrash2 size={14} />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <Pagination
                        currentPage={txPagination.currentPage}
                        totalPages={txPagination.totalPages}
                        totalItems={txPagination.totalItems}
                        pageSize={txPagination.pageSize}
                        startIndex={txPagination.startIndex}
                        endIndex={txPagination.endIndex}
                        pageNumbers={txPagination.pageNumbers}
                        canPrevPage={txPagination.canPrevPage}
                        canNextPage={txPagination.canNextPage}
                        onPageChange={txPagination.setPage}
                        onPageSizeChange={txPagination.setPageSize}
                        onFirstPage={txPagination.firstPage}
                        onLastPage={txPagination.lastPage}
                        onPrevPage={txPagination.prevPage}
                        onNextPage={txPagination.nextPage}
                      />
                    </>
                  )}
                </>
              )}

              {activeTab === 'parties' && (
                <>
                  <div className="p-4 border-b border-gray-100">
                    <span className="text-sm text-gray-500">
                      {stakeholders.length} paydaş (işlemlerden otomatik)
                    </span>
                  </div>
                  {stakeholders.length === 0 ? (
                    <EmptyState
                      title="Paydaş bulunamadı"
                      description="Bu projede henüz cari hesap ile işlem yapılmamış"
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow hover={false}>
                          <TableHead>Rol</TableHead>
                          <TableHead>Cari</TableHead>
                          <TableHead className="text-right">İşlem Sayısı</TableHead>
                          <TableHead className="text-right">Toplam Tutar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stakeholders.map((stakeholder) => {
                          const roleLabels: Record<
                            string,
                            {
                              label: string;
                              variant: 'success' | 'info' | 'purple' | 'warning' | 'gray';
                            }
                          > = {
                            customer: { label: 'Müşteri', variant: 'success' },
                            supplier: { label: 'Tedarikçi', variant: 'info' },
                            subcontractor: { label: 'Taşeron', variant: 'purple' },
                            investor: { label: 'Yatırımcı', variant: 'warning' },
                          };
                          const roleConfig = roleLabels[stakeholder.account_type] || {
                            label: stakeholder.account_type,
                            variant: 'gray' as const,
                          };
                          return (
                            <TableRow
                              key={stakeholder.company_id}
                              className="cursor-pointer"
                              onClick={() =>
                                setStakeholderDetailModal({
                                  company_id: stakeholder.company_id,
                                  company_name: stakeholder.company_name,
                                })
                              }
                            >
                              <TableCell>
                                <Badge variant={roleConfig.variant}>{roleConfig.label}</Badge>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">{stakeholder.company_name}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                {stakeholder.transaction_count}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(stakeholder.total_amount)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTransaction(null);
        }}
        transaction={editingTransaction}
        projectId={project.id}
        companies={companies}
        categories={categories}
        onSave={handleSaveTransaction}
      />

      {/* Delete Transaction Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteTransaction}
        title="İşlemi Sil"
        message="Bu işlemi silmek istediğinize emin misiniz?"
        type="danger"
        confirmText="Sil"
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Toplu Silme"
        message={`Seçili ${selectedIds.size} işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        type="danger"
        confirmText="Tümünü Sil"
      />

      {/* Transaction Detail View Modal */}
      <Modal
        isOpen={!!viewingTransaction}
        onClose={() => setViewingTransaction(null)}
        title="İşlem Detayı"
        size="md"
      >
        {viewingTransaction && (
          <ModalBody>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b">
                <Badge
                  variant={getTransactionBadgeVariant(viewingTransaction.type)}
                  className="text-sm px-3 py-1.5"
                >
                  {TRANSACTION_TYPE_LABELS[viewingTransaction.type]}
                </Badge>
                <span
                  className={`text-xl font-bold ${getTransactionTextColor(viewingTransaction.type)}`}
                >
                  {isIncomeType(viewingTransaction.type)
                    ? '+'
                    : isExpenseType(viewingTransaction.type)
                      ? '-'
                      : ''}
                  {formatCurrency(viewingTransaction.amount, viewingTransaction.currency)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Tarih</p>
                  <p className="font-medium">{formatDate(viewingTransaction.date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Kategori</p>
                  <p className="font-medium">{viewingTransaction.category_name || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Açıklama</p>
                  <p className="font-medium">{viewingTransaction.description}</p>
                </div>
                {viewingTransaction.company_name && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Cari</p>
                    <p className="font-medium">{viewingTransaction.company_name}</p>
                  </div>
                )}
                {viewingTransaction.document_no && (
                  <div>
                    <p className="text-gray-500">Belge No</p>
                    <p className="font-medium">{viewingTransaction.document_no}</p>
                  </div>
                )}
                {viewingTransaction.currency !== 'TRY' && (
                  <div>
                    <p className="text-gray-500">TL Karşılığı</p>
                    <p className="font-medium">{formatCurrency(viewingTransaction.amount_try)}</p>
                  </div>
                )}
                {viewingTransaction.notes && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Not</p>
                    <p className="font-medium">{viewingTransaction.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setViewingTransaction(null)}>
            Kapat
          </Button>
          <Button
            onClick={() => {
              setEditingTransaction(viewingTransaction);
              setViewingTransaction(null);
              setModalOpen(true);
            }}
          >
            <FiEdit2 className="mr-2" size={16} />
            Düzenle
          </Button>
        </ModalFooter>
      </Modal>

      {/* Stakeholder Detail Modal */}
      <Modal
        isOpen={!!stakeholderDetailModal}
        onClose={() => setStakeholderDetailModal(null)}
        title={`${stakeholderDetailModal?.company_name || ''} - Proje İşlemleri`}
        size="lg"
      >
        <ModalBody className="p-0">
          {stakeholderDetailModal && (
            <>
              {transactions.filter((tx) => tx.company_id === stakeholderDetailModal.company_id)
                .length === 0 ? (
                <EmptyState title="İşlem bulunamadı" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow hover={false}>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Tür</TableHead>
                      <TableHead>Açıklama</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions
                      .filter((tx) => tx.company_id === stakeholderDetailModal.company_id)
                      .map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>{formatDate(tx.date)}</TableCell>
                          <TableCell>
                            <Badge variant={getTransactionBadgeVariant(tx.type)}>
                              {TRANSACTION_TYPE_LABELS[tx.type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{tx.description}</p>
                            {tx.category_name && (
                              <p className="text-xs text-gray-500">{tx.category_name}</p>
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${getTransactionTextColor(tx.type)}`}
                          >
                            {isIncomeType(tx.type) ? '+' : isExpenseType(tx.type) ? '-' : ''}
                            {formatCurrency(tx.amount, tx.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setStakeholderDetailModal(null)}>
            Kapat
          </Button>
          <Button
            onClick={() => {
              if (stakeholderDetailModal) {
                navigate(`/companies/${stakeholderDetailModal.company_id}`);
              }
            }}
          >
            Cari Hesaba Git
          </Button>
        </ModalFooter>
      </Modal>

      {/* Print Preview Modal */}
      <Modal
        isOpen={printPreviewOpen}
        onClose={() => setPrintPreviewOpen(false)}
        title="Yazdırma Önizleme"
        size="xl"
      >
        <ModalBody className="p-4 bg-gray-100">
          <div className="mx-auto bg-white shadow-lg" style={{ maxWidth: '210mm' }}>
            <ProjectPrintView
              ref={printRef}
              project={project!}
              transactions={transactions}
              categoryBreakdown={categoryBreakdown}
              parties={stakeholders.map((s) => ({
                id: s.company_id,
                role: s.account_type,
                company_name: s.company_name,
                phone: s.phone,
                email: s.email,
              }))}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setPrintPreviewOpen(false)}>
            Kapat
          </Button>
          <Button icon={FiPrinter} onClick={executePrint}>
            Yazdır
          </Button>
        </ModalFooter>
      </Modal>

      {/* Hidden Print View */}
      <div className="hidden print:block">
        {project && (
          <ProjectPrintView
            ref={printRef}
            project={project}
            transactions={transactions}
            categoryBreakdown={categoryBreakdown}
            parties={stakeholders.map((s) => ({
              id: s.company_id,
              role: s.account_type,
              company_name: s.company_name,
              phone: s.phone,
              email: s.email,
            }))}
          />
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(.print\\:block) { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}

// Transaction Modal for Project
function TransactionModal({
  isOpen,
  onClose,
  transaction,
  projectId,
  companies,
  categories,
  onSave,
}: TransactionModalProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    type: 'invoice_out',
    date: formatDateForInput(new Date().toISOString()),
    description: '',
    amount: '',
    currency: 'TRY',
    category_id: '',
    company_id: '',
    document_no: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type,
        date: formatDateForInput(transaction.date),
        description: transaction.description,
        amount: String(transaction.amount),
        currency: transaction.currency || 'TRY',
        category_id: transaction.category_id ? String(transaction.category_id) : '',
        company_id: transaction.company_id ? String(transaction.company_id) : '',
        document_no: transaction.document_no || '',
        notes: transaction.notes || '',
      });
    } else {
      setFormData({
        type: 'invoice_out',
        date: formatDateForInput(new Date().toISOString()),
        description: '',
        amount: '',
        currency: 'TRY',
        category_id: '',
        company_id: '',
        document_no: '',
        notes: '',
      });
    }
  }, [transaction, isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...formData,
        scope: 'project' as const,
        project_id: projectId,
        amount: parseFloat(formData.amount),
        category_id: formData.category_id || undefined,
        company_id: formData.company_id || undefined,
      };

      if (transaction) {
        await window.electronAPI.transaction.update(transaction.id, data);
        onSave(false);
      } else {
        await window.electronAPI.transaction.create(data);
        onSave(true);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setLoading(false);
    }
  };

  const incomeCategories = categories.filter(
    (c) => c.type === 'invoice_in' || c.type === 'payment'
  );
  const expenseCategories = categories.filter(
    (c) => c.type === 'invoice_in' || c.type === 'payment'
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transaction ? 'İşlem Düzenle' : 'Yeni Proje İşlemi'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label>
              <input
                type="radio"
                name="type"
                value="invoice_out"
                checked={formData.type === 'invoice_out'}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as TransactionType,
                    category_id: '',
                  })
                }
                className="sr-only"
              />
              <div
                className={`p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === 'invoice_out'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-medium">Satış Faturası</span>
              </div>
            </label>
            <label>
              <input
                type="radio"
                name="type"
                value="payment_in"
                checked={formData.type === 'payment_in'}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as TransactionType,
                    category_id: '',
                  })
                }
                className="sr-only"
              />
              <div
                className={`p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === 'payment_in'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-medium">Tahsilat</span>
              </div>
            </label>
            <label>
              <input
                type="radio"
                name="type"
                value="invoice_in"
                checked={formData.type === 'invoice_in'}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as TransactionType,
                    category_id: '',
                  })
                }
                className="sr-only"
              />
              <div
                className={`p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === 'invoice_in'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-medium">Alış Faturası</span>
              </div>
            </label>
            <label>
              <input
                type="radio"
                name="type"
                value="payment_out"
                checked={formData.type === 'payment_out'}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as TransactionType,
                    category_id: '',
                  })
                }
                className="sr-only"
              />
              <div
                className={`p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === 'payment_out'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-medium">Ödeme</span>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tarih *"
              type="date"
              value={formData.date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, date: e.target.value })
              }
              required
            />
            <Select
              label="Kategori *"
              options={(isIncomeType(formData.type) ? incomeCategories : expenseCategories).map(
                (c) => ({
                  value: c.id,
                  label: c.name,
                })
              )}
              value={formData.category_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, category_id: e.target.value })
              }
              required
            />
          </div>

          <Input
            label="Açıklama *"
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, description: e.target.value })
            }
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tutar *"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              required
            />
            <Select
              label="Para Birimi"
              options={CURRENCIES}
              value={formData.currency}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, currency: e.target.value as Currency })
              }
            />
          </div>

          <Select
            label="Cari (Opsiyonel)"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            value={formData.company_id}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setFormData({ ...formData, company_id: e.target.value })
            }
            placeholder="Cari seçin..."
          />

          <Input
            label="Belge No"
            value={formData.document_no}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, document_no: e.target.value })
            }
          />

          <Textarea
            label="Not"
            value={formData.notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={2}
          />
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose} type="button">
            İptal
          </Button>
          <Button type="submit" loading={loading}>
            {transaction ? 'Güncelle' : 'Kaydet'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default ProjectDetail;

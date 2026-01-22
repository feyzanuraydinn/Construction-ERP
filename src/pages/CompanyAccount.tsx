import { useState, useEffect, useRef } from 'react';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiBriefcase,
  FiTrendingUp,
  FiTrendingDown,
  FiPrinter,
  FiEye,
} from 'react-icons/fi';
import { CompanyAccountPrintView } from '../components/PrintView';
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
  Badge,
  EmptyState,
  ConfirmDialog,
  Pagination,
} from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { useKeyboardShortcuts, usePagination, paginateArray } from '../hooks';
import { formatCurrency, formatDate, formatDateForInput } from '../utils/formatters';
import type { TransactionWithDetails, Category, TransactionType } from '../types';

// Firma hesabı için basitleştirilmiş işlem türleri
const COMPANY_TRANSACTION_TYPES = [
  { value: 'invoice_out', label: 'Gelir' },
  { value: 'invoice_in', label: 'Gider' },
];

// Firma hesabı için basit etiketler
const COMPANY_TYPE_LABELS: Record<string, string> = {
  invoice_out: 'Gelir',
  payment_in: 'Gelir', // Eski tip - geriye uyumluluk
  invoice_in: 'Gider',
  payment_out: 'Gider', // Eski tip - geriye uyumluluk
};

// Helper function to get transaction text color - Gelir yeşil, Gider kırmızı
const getTransactionTextColor = (type: TransactionType): string => {
  switch (type) {
    case 'invoice_out':
    case 'payment_in': // Eski tip - geriye uyumluluk
      return 'text-green-600';
    case 'invoice_in':
    case 'payment_out': // Eski tip - geriye uyumluluk
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

// Helper function to get transaction badge variant - Gelir yeşil, Gider kırmızı
const getTransactionBadgeVariant = (
  type: TransactionType
): 'success' | 'info' | 'danger' | 'warning' => {
  switch (type) {
    case 'invoice_out':
    case 'payment_in': // Eski tip - geriye uyumluluk
      return 'success';
    case 'invoice_in':
    case 'payment_out': // Eski tip - geriye uyumluluk
      return 'danger';
    default:
      return 'info';
  }
};

// Helper to check if transaction is income-type (increases balance)
const isIncomeType = (type: TransactionType): boolean => {
  return type === 'invoice_out' || type === 'payment_in';
};

// Helper to check if transaction is expense-type (decreases balance)
const isExpenseType = (type: TransactionType): boolean => {
  return type === 'invoice_in' || type === 'payment_out';
};

interface CompanyTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionWithDetails | null;
  categories: Category[];
  onSave: (isNew: boolean) => void;
}

interface TransactionFormData {
  type: TransactionType;
  date: string;
  description: string;
  amount: string;
  category_id: string;
  document_no: string;
  notes: string;
}

interface PrintFilters {
  type: string;
  category_id: string;
  startDate: string;
  endDate: string;
}

function CompanyAccount() {
  const toast = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithDetails | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TransactionWithDetails | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<TransactionWithDetails | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printFilters, setPrintFilters] = useState<PrintFilters>({
    type: '',
    category_id: '',
    startDate: '',
    endDate: '',
  });
  // Toplu seçim state'leri
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

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
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txData, categoriesData] = await Promise.all([
        window.electronAPI.transaction.getAll({ scope: 'company' }),
        window.electronAPI.category.getAll(),
      ]);
      setTransactions(Array.isArray(txData) ? txData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
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
    setPrintModalOpen(true);
  };

  const getFilteredTransactionsForPrint = () => {
    return transactions.filter((tx) => {
      if (printFilters.type && tx.type !== printFilters.type) return false;
      if (printFilters.category_id && tx.category_id !== parseInt(printFilters.category_id))
        return false;
      if (printFilters.startDate && tx.date < printFilters.startDate) return false;
      if (printFilters.endDate && tx.date > printFilters.endDate) return false;
      return true;
    });
  };

  const showPreview = () => {
    setPrintModalOpen(false);
    setPrintPreviewOpen(true);
  };

  const executePrint = () => {
    window.print();
  };

  const totalIncome = transactions
    .filter((t) => isIncomeType(t.type))
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
  const totalExpense = transactions
    .filter((t) => isExpenseType(t.type))
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
  const netBalance = totalIncome - totalExpense;

  const invoiceCategories = categories.filter(
    (c) => c.type === 'invoice_in' || c.type === 'invoice_out'
  );
  const paymentCategories = categories.filter((c) => c.type === 'payment');

  const filteredTransactions = transactions.filter((tx) => {
    const matchesType = !filterType || tx.type === filterType;
    const matchesCategory = !filterCategory || tx.category_id === parseInt(filterCategory);
    return matchesType && matchesCategory;
  });

  // Pagination
  const pagination = usePagination({
    totalItems: filteredTransactions.length,
    initialPageSize: 25,
  });
  const paginatedTransactions = paginateArray(
    filteredTransactions,
    pagination.currentPage,
    pagination.pageSize
  );

  // Group expenses by category for summary
  const expenseByCategory = transactions
    .filter((t) => isExpenseType(t.type))
    .reduce((acc: Record<string, number>, t) => {
      const catName = t.category_name || 'Diğer';
      acc[catName] = (acc[catName] || 0) + (t.amount_try || t.amount);
      return acc;
    }, {});

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Firma Hesabı</h1>
          <p className="mt-1 text-sm text-gray-500">
            Projelere bağlı olmayan genel firma gelir ve giderleri
          </p>
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
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
        <StatCard
          title="Genel Gelir"
          value={formatCurrency(totalIncome)}
          icon={FiTrendingUp}
          color="green"
        />
        <StatCard
          title="Genel Gider"
          value={formatCurrency(totalExpense)}
          icon={FiTrendingDown}
          color="red"
        />
        <StatCard
          title="Net Durum"
          value={formatCurrency(netBalance)}
          icon={FiBriefcase}
          color={netBalance >= 0 ? 'green' : 'red'}
          highlighted
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left - Category Summary */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Gider Dağılımı</h3>
          </CardHeader>
          <CardBody className="p-0">
            {Object.keys(expenseByCategory).length === 0 ? (
              <p className="p-4 text-sm text-center text-gray-500">Gider kaydı yok</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {Object.entries(expenseByCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, amount]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between gap-2 px-4 py-3"
                    >
                      <span
                        className="text-sm text-gray-700 truncate flex-1 min-w-0"
                        title={category}
                      >
                        {category}
                      </span>
                      <span className="text-sm font-medium text-red-600 whitespace-nowrap flex-shrink-0">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Right - Transactions */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">İşlemler</h3>
                {selectedIds.size > 0 && (
                  <>
                    <div className="w-px h-6 bg-gray-300" />
                    <button
                      onClick={() => setBulkDeleteConfirm(true)}
                      className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 btn"
                    >
                      <FiTrash2 size={16} />
                      {selectedIds.size} işlem sil
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Select
                  options={COMPANY_TRANSACTION_TYPES}
                  value={filterType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFilterType(e.target.value)
                  }
                  placeholder="Tür"
                  className="w-28"
                />
                <Select
                  options={[...invoiceCategories, ...paymentCategories].map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  value={filterCategory}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFilterCategory(e.target.value)
                  }
                  placeholder="Kategori"
                  className="w-40"
                />
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-10 h-10 spinner"></div>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <EmptyState
                  icon={FiBriefcase}
                  title="İşlem bulunamadı"
                  description="Firma genel gelir/gider ekleyerek başlayın"
                  action={() => setModalOpen(true)}
                  actionLabel="Yeni İşlem"
                  actionIcon={FiPlus}
                />
              ) : (
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
                      <TableHead>Kategori</TableHead>
                      <TableHead>Açıklama</TableHead>
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
                            {COMPANY_TYPE_LABELS[tx.type] || tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tx.category_name ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                              style={{
                                backgroundColor: `${tx.category_color}20`,
                                color: tx.category_color || undefined,
                              }}
                            >
                              {tx.category_name}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{tx.description}</p>
                          {tx.document_no && (
                            <p className="text-xs text-gray-500">Belge: {tx.document_no}</p>
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${getTransactionTextColor(tx.type)}`}
                        >
                          {isIncomeType(tx.type) ? '+' : '-'}
                          {formatCurrency(tx.amount_try || tx.amount)}
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
              )}
              {/* Pagination */}
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                pageNumbers={pagination.pageNumbers}
                canPrevPage={pagination.canPrevPage}
                canNextPage={pagination.canNextPage}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                onFirstPage={pagination.firstPage}
                onLastPage={pagination.lastPage}
                onPrevPage={pagination.prevPage}
                onNextPage={pagination.nextPage}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Transaction Modal */}
      <CompanyTransactionModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTransaction(null);
        }}
        transaction={editingTransaction}
        categories={categories}
        onSave={handleSaveTransaction}
      />

      {/* Transaction Detail View Modal */}
      <Modal
        isOpen={!!viewingTransaction}
        onClose={() => setViewingTransaction(null)}
        title="İşlem Detayı"
        size="md"
      >
        <ModalBody>
          {viewingTransaction && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge
                  variant={getTransactionBadgeVariant(viewingTransaction.type)}
                  className="text-sm"
                >
                  {COMPANY_TYPE_LABELS[viewingTransaction.type] || viewingTransaction.type}
                </Badge>
                <span className="text-sm text-gray-500">{formatDate(viewingTransaction.date)}</span>
              </div>

              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-lg font-semibold text-gray-900">
                  {viewingTransaction.description}
                </p>
                <p
                  className={`text-2xl font-bold mt-2 ${getTransactionTextColor(viewingTransaction.type)}`}
                >
                  {isIncomeType(viewingTransaction.type) ? '+' : '-'}
                  {formatCurrency(viewingTransaction.amount_try || viewingTransaction.amount)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {viewingTransaction.category_name && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Kategori</p>
                    <span
                      className="inline-flex items-center px-2 py-1 rounded text-sm"
                      style={{
                        backgroundColor: `${viewingTransaction.category_color}20`,
                        color: viewingTransaction.category_color || undefined,
                      }}
                    >
                      {viewingTransaction.category_name}
                    </span>
                  </div>
                )}
                {viewingTransaction.document_no && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Belge No</p>
                    <p className="text-sm font-medium">{viewingTransaction.document_no}</p>
                  </div>
                )}
              </div>

              {viewingTransaction.notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Notlar</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {viewingTransaction.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </ModalBody>
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
            icon={FiEdit2}
          >
            Düzenle
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
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

      {/* Print Options Modal */}
      <Modal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title="Yazdırma Secenekleri"
        size="sm"
      >
        <ModalBody className="space-y-4">
          <Select
            label="İşlem Türü"
            options={COMPANY_TRANSACTION_TYPES}
            value={printFilters.type}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setPrintFilters({ ...printFilters, type: e.target.value })
            }
            placeholder="Tümü"
          />
          <Select
            label="Kategori"
            options={[...invoiceCategories, ...paymentCategories].map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            value={printFilters.category_id}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setPrintFilters({ ...printFilters, category_id: e.target.value })
            }
            placeholder="Tümü"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Başlangıç Tarihi"
              type="date"
              value={printFilters.startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPrintFilters({ ...printFilters, startDate: e.target.value })
              }
            />
            <Input
              label="Bitiş Tarihi"
              type="date"
              value={printFilters.endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPrintFilters({ ...printFilters, endDate: e.target.value })
              }
            />
          </div>
          <div className="pt-2 text-sm text-gray-500">
            Secilen kriterlere göre {getFilteredTransactionsForPrint().length} işlem yazdırılacak.
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setPrintModalOpen(false)}>
            İptal
          </Button>
          <Button icon={FiEye} onClick={showPreview}>
            Önizle
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
            <CompanyAccountPrintView
              ref={printRef}
              transactions={getFilteredTransactionsForPrint()}
              filters={printFilters}
              categories={categories}
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
        <CompanyAccountPrintView
          ref={printRef}
          transactions={getFilteredTransactionsForPrint()}
          filters={printFilters}
          categories={categories}
        />
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

// Company Transaction Modal
function CompanyTransactionModal({
  isOpen,
  onClose,
  transaction,
  categories,
  onSave,
}: CompanyTransactionModalProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    type: 'invoice_out',
    date: formatDateForInput(new Date().toISOString()),
    description: '',
    amount: '',
    category_id: '',
    document_no: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction) {
      // Eski tipleri yeni tiplere dönüştür (geriye uyumluluk)
      let mappedType = transaction.type;
      if (transaction.type === 'payment_in') mappedType = 'invoice_out'; // Eski tahsilat -> Gelir
      if (transaction.type === 'payment_out') mappedType = 'invoice_in'; // Eski ödeme -> Gider

      setFormData({
        type: mappedType,
        date: formatDateForInput(transaction.date),
        description: transaction.description,
        amount: String(transaction.amount),
        category_id: transaction.category_id ? String(transaction.category_id) : '',
        document_no: transaction.document_no || '',
        notes: transaction.notes || '',
      });
    } else {
      setFormData({
        type: 'invoice_out',
        date: formatDateForInput(new Date().toISOString()),
        description: '',
        amount: '',
        category_id: '',
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
        scope: 'company' as const,
        company_id: undefined,
        project_id: undefined,
        amount: parseFloat(formData.amount),
        currency: 'TRY' as const,
        category_id: formData.category_id || undefined,
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

  // Firma hesabı için sadece gelir/gider kategorileri
  const getAvailableCategories = () => {
    if (formData.type === 'invoice_out') {
      return categories.filter((c) => c.type === 'invoice_out');
    } else {
      return categories.filter((c) => c.type === 'invoice_in');
    }
  };
  const availableCategories = getAvailableCategories();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transaction ? 'İşlem Düzenle' : 'Firma Gelir/Gider'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ModalBody className="space-y-4">
          {/* Type Selection - 2 options: Gelir / Gider */}
          <div className="grid grid-cols-2 gap-4">
            {/* Gelir - Green */}
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
                className={`p-4 border-2 rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === 'invoice_out'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FiTrendingUp className="mx-auto mb-2" size={24} />
                <span className="text-base font-medium">Gelir</span>
              </div>
            </label>

            {/* Gider - Red */}
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
                className={`p-4 border-2 rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === 'invoice_in'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FiTrendingDown className="mx-auto mb-2" size={24} />
                <span className="text-base font-medium">Gider</span>
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
              options={availableCategories.map((c) => ({ value: c.id, label: c.name }))}
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
            placeholder="İşlem açıklaması"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tutar (TL) *"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              required
            />
            <Input
              label="Belge No"
              value={formData.document_no}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, document_no: e.target.value })
              }
              placeholder="Fatura no"
            />
          </div>

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

export default CompanyAccount;

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiPlus,
  FiPhone,
  FiMail,
  FiMapPin,
  FiCreditCard,
  FiTrash2,
  FiPrinter,
  FiFilter,
  FiEye,
  FiEdit2,
} from 'react-icons/fi';
import { CompanyPrintView } from '../components/PrintView';
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
  TypeBadge,
  AccountTypeBadge,
  EmptyState,
  ConfirmDialog,
  Pagination,
} from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { useKeyboardShortcuts, usePagination, paginateArray } from '../hooks';
import { formatCurrency, formatDate, formatDateForInput } from '../utils/formatters';
import { TRANSACTION_TYPES, CURRENCIES, TRANSACTION_TYPE_LABELS } from '../utils/constants';
import type {
  Company,
  TransactionWithDetails,
  Project,
  Category,
  TransactionType,
  Currency,
} from '../types';

// İşlem tipi renk ve prefix yardımcıları
const getTransactionColor = (type: TransactionType): string => {
  switch (type) {
    case 'invoice_out':
      return 'bg-green-500';
    case 'payment_in':
      return 'bg-blue-500';
    case 'invoice_in':
      return 'bg-red-500';
    case 'payment_out':
      return 'bg-orange-500';
    default:
      return 'bg-gray-500';
  }
};

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

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionWithDetails | null;
  companyId: number;
  projects: Project[];
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
  project_id: string;
  document_no: string;
  notes: string;
}

interface PrintFilters {
  type: string;
  category_id: string;
  startDate: string;
  endDate: string;
}

function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithDetails | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<TransactionWithDetails | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TransactionWithDetails | null>(null);
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

  // Filtered transactions (must be before pagination hook)
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType && tx.type !== filterType) return false;
      if (filterStartDate && tx.date < filterStartDate) return false;
      if (filterEndDate && tx.date > filterEndDate) return false;
      return true;
    });
  }, [transactions, filterType, filterStartDate, filterEndDate]);

  // Pagination hook - must be called unconditionally
  const pagination = usePagination({
    totalItems: filteredTransactions.length,
    initialPageSize: 25,
  });

  const paginatedTransactions = useMemo(() => {
    return paginateArray(filteredTransactions, pagination.currentPage, pagination.pageSize);
  }, [filteredTransactions, pagination.currentPage, pagination.pageSize]);

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
      const [companyData, txData, projectsData, categoriesData] = await Promise.all([
        window.electronAPI.company.getById(numericId),
        window.electronAPI.transaction.getByCompany(numericId),
        window.electronAPI.project.getAll(),
        window.electronAPI.category.getAll(),
      ]);
      setCompany(companyData || null);
      setTransactions(txData);
      setProjects(projectsData);
      setCategories(categoriesData);
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
    setPrintModalOpen(true);
  };

  const showPreview = () => {
    setPrintModalOpen(false);
    setPrintPreviewOpen(true);
  };

  const executePrint = () => {
    window.print();
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

  const clearFilters = () => {
    setFilterType('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center page-container">
        <div className="w-12 h-12 spinner"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="page-container">
        <EmptyState
          title="Cari bulunamadı"
          description="Aradığınız cari hesap mevcut değil"
          action={() => navigate('/companies')}
          actionLabel="Carilere Dön"
        />
      </div>
    );
  }

  // Yeni hesaplama mantığı
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

  // Alacak = Satış faturaları - Tahsilatlar (Bize borçlu miktar)
  const receivable = totalInvoiceOut - totalPaymentIn;
  // Borç = Alış faturaları - Ödemeler (Bizim borçlu olduğumuz miktar)
  const payable = totalInvoiceIn - totalPaymentOut;
  // Net bakiye
  const balance = receivable - payable;

  const hasActiveFilters = filterType || filterStartDate || filterEndDate;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/companies')}
            className="p-2 transition-colors rounded-lg hover:bg-gray-100"
          >
            <FiArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title">{company.name}</h1>
              <TypeBadge type={company.type} />
              <AccountTypeBadge accountType={company.account_type} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {company.type === 'person' ? company.profession : company.contact_person}
            </p>
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

      {/* Stats - Satır 1: Faturalar */}
      <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Satış Faturaları"
          value={formatCurrency(totalInvoiceOut)}
          subtitle="Kestiğimiz faturalar"
          color="green"
        />
        <StatCard
          title="Tahsilatlar"
          value={formatCurrency(totalPaymentIn)}
          subtitle="Aldığımız ödemeler"
          color="blue"
        />
        <StatCard
          title="Alış Faturaları"
          value={formatCurrency(totalInvoiceIn)}
          subtitle="Aldığımız faturalar"
          color="red"
        />
        <StatCard
          title="Ödemeler"
          value={formatCurrency(totalPaymentOut)}
          subtitle="Yaptığımız ödemeler"
          color="orange"
        />
      </div>

      {/* Stats - Satır 2: Bakiyeler */}
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
        <StatCard
          title="Alacak Bakiyesi"
          value={formatCurrency(receivable)}
          subtitle={receivable >= 0 ? 'Bize borçlu' : 'Fazla ödeme aldık'}
          color={receivable >= 0 ? 'green' : 'purple'}
        />
        <StatCard
          title="Borç Bakiyesi"
          value={formatCurrency(payable)}
          subtitle={payable >= 0 ? 'Biz borçluyuz' : 'Fazla ödeme yaptık'}
          color={payable >= 0 ? 'red' : 'purple'}
        />
        <StatCard
          title="Net Bakiye"
          value={formatCurrency(balance)}
          subtitle={balance >= 0 ? 'Net alacaklıyız' : 'Net borçluyuz'}
          color={balance >= 0 ? 'green' : 'red'}
          highlighted
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left - Info */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">İletişim Bilgileri</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {company.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <FiPhone className="text-gray-400" />
                  <span>{company.phone}</span>
                </div>
              )}
              {company.email && (
                <div className="flex items-center gap-3 text-sm">
                  <FiMail className="text-gray-400" />
                  <span>{company.email}</span>
                </div>
              )}
              {company.address && (
                <div className="flex items-center gap-3 text-sm">
                  <FiMapPin className="text-gray-400" />
                  <span>{company.address}</span>
                </div>
              )}
              {company.bank_name && (
                <div className="flex items-center gap-3 text-sm">
                  <FiCreditCard className="text-gray-400" />
                  <div>
                    <p>{company.bank_name}</p>
                    {company.iban && <p className="text-xs text-gray-500">{company.iban}</p>}
                  </div>
                </div>
              )}
              {!company.phone && !company.email && !company.address && (
                <p className="text-sm text-gray-500">İletişim bilgisi eklenmemiş</p>
              )}
            </CardBody>
          </Card>

          {/* Additional Info */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">
                {company.type === 'person' ? 'Şahıs Bilgileri' : 'Firma Bilgileri'}
              </h3>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              {company.type === 'person' ? (
                <>
                  {company.tc_number && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">TC Kimlik No</span>
                      <span>{company.tc_number}</span>
                    </div>
                  )}
                  {company.profession && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Meslek</span>
                      <span>{company.profession}</span>
                    </div>
                  )}
                  {!company.tc_number && !company.profession && (
                    <p className="text-gray-500">Şahsi bilgi eklenmemiş</p>
                  )}
                </>
              ) : (
                <>
                  {company.tax_office && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Vergi Dairesi</span>
                      <span>{company.tax_office}</span>
                    </div>
                  )}
                  {company.tax_number && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Vergi No</span>
                      <span>{company.tax_number}</span>
                    </div>
                  )}
                  {company.trade_registry_no && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ticaret Sicil</span>
                      <span>{company.trade_registry_no}</span>
                    </div>
                  )}
                  {!company.tax_office && !company.tax_number && !company.trade_registry_no && (
                    <p className="text-gray-500">Firma bilgisi eklenmemiş</p>
                  )}
                </>
              )}
              {company.notes && (
                <div className="pt-2 border-t">
                  <p className="mb-1 text-gray-500">Notlar</p>
                  <p>{company.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right - Transactions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-col gap-3">
              <div className="flex items-center justify-between h-10">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">İşlem Geçmişi</h3>
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-lg transition-colors ${showFilters || hasActiveFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
                  >
                    <FiFilter size={16} />
                  </button>
                  <Select
                    options={TRANSACTION_TYPES}
                    value={filterType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setFilterType(e.target.value)
                    }
                    placeholder="Tümü"
                    className="w-32"
                  />
                </div>
              </div>
              {showFilters && (
                <div className="flex flex-wrap items-center gap-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">Başlangıç:</label>
                    <Input
                      type="date"
                      value={filterStartDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFilterStartDate(e.target.value)
                      }
                      className="w-40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">Bitiş:</label>
                    <Input
                      type="date"
                      value={filterEndDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFilterEndDate(e.target.value)
                      }
                      className="w-40"
                    />
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Temizle
                    </button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardBody className="p-0">
              {filteredTransactions.length === 0 ? (
                <EmptyState
                  title="İşlem bulunamadı"
                  description="Bu cari hesaba ait işlem kaydı yok"
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
                      <TableHead>Açıklama</TableHead>
                      <TableHead>Proje</TableHead>
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
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getTransactionColor(tx.type)} text-white`}
                          >
                            {TRANSACTION_TYPE_LABELS[tx.type]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{tx.description}</p>
                          {tx.category_name && (
                            <p className="text-xs text-gray-500">{tx.category_name}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {tx.project_name ? (
                            <span className="text-sm">{tx.project_name}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${getTransactionTextColor(tx.type)}`}
                        >
                          {tx.type === 'invoice_out' || tx.type === 'payment_in' ? '+' : '-'}
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
      <TransactionModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTransaction(null);
        }}
        transaction={editingTransaction}
        companyId={company.id}
        projects={projects}
        categories={categories}
        onSave={handleSaveTransaction}
      />

      {/* Delete Confirmation */}
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
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getTransactionColor(viewingTransaction.type)} text-white`}
                >
                  {TRANSACTION_TYPE_LABELS[viewingTransaction.type]}
                </span>
                <span
                  className={`text-xl font-bold ${getTransactionTextColor(viewingTransaction.type)}`}
                >
                  {viewingTransaction.type === 'invoice_out' ||
                  viewingTransaction.type === 'payment_in'
                    ? '+'
                    : '-'}
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
                {viewingTransaction.project_name && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Proje</p>
                    <p className="font-medium">{viewingTransaction.project_name}</p>
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

      {/* Print Options Modal */}
      <Modal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title="Yazdırma Seçenekleri"
        size="sm"
      >
        <ModalBody className="space-y-4">
          <Select
            label="İşlem Türü"
            options={TRANSACTION_TYPES}
            value={printFilters.type}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setPrintFilters({ ...printFilters, type: e.target.value })
            }
            placeholder="Tümü"
          />
          <Select
            label="Kategori"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
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
            Seçilen kriterlere göre {getFilteredTransactionsForPrint().length} işlem yazdırılacak.
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
            <CompanyPrintView
              ref={printRef}
              company={company}
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
        <CompanyPrintView
          ref={printRef}
          company={company}
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

// Transaction Modal Component
function TransactionModal({
  isOpen,
  onClose,
  transaction,
  companyId,
  projects,
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
    project_id: '',
    document_no: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<{ USD: number; EUR: number }>({
    USD: 1,
    EUR: 1,
  });

  // Döviz kurlarını al
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const rates = await window.electronAPI.exchange.getRates();
        if (rates) {
          setExchangeRates(rates);
        }
      } catch (error) {
        console.error('Kur bilgisi alınamadı:', error);
      }
    };
    fetchRates();
  }, []);

  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type,
        date: formatDateForInput(transaction.date),
        description: transaction.description,
        amount: String(transaction.amount),
        currency: transaction.currency || 'TRY',
        category_id: transaction.category_id ? String(transaction.category_id) : '',
        project_id: transaction.project_id ? String(transaction.project_id) : '',
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
        project_id: '',
        document_no: '',
        notes: '',
      });
    }
  }, [transaction, isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Kur hesaplama
      let exchangeRate = 1;
      if (formData.currency === 'USD') {
        exchangeRate = exchangeRates.USD;
      } else if (formData.currency === 'EUR') {
        exchangeRate = exchangeRates.EUR;
      }

      const data = {
        ...formData,
        scope: 'cari' as const,
        company_id: companyId,
        amount: parseFloat(formData.amount),
        exchange_rate: exchangeRate,
        category_id: formData.category_id || undefined,
        project_id: formData.project_id || undefined,
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

  // Kategori filtreleme: Fatura tipleri için fatura kategorileri, ödeme tipleri için ödeme kategorileri
  const getFilteredCategories = () => {
    if (formData.type === 'invoice_out') {
      return categories.filter((c) => c.type === 'invoice_out');
    } else if (formData.type === 'invoice_in') {
      return categories.filter((c) => c.type === 'invoice_in');
    } else {
      // payment_in veya payment_out
      return categories.filter((c) => c.type === 'payment');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transaction ? 'İşlem Düzenle' : 'Yeni İşlem'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ModalBody className="space-y-4">
          {/* Type Selection - 4 tip */}
          <div className="grid grid-cols-2 gap-2">
            {/* Satış Faturası */}
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
                className={`p-2.5 border-2 rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === 'invoice_out'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-medium">Satış Faturası</span>
              </div>
            </label>
            {/* Tahsilat */}
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
                className={`p-2.5 border-2 rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === 'payment_in'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-medium">Tahsilat</span>
              </div>
            </label>
            {/* Alış Faturası */}
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
                className={`p-2.5 border-2 rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === 'invoice_in'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-medium">Alış Faturası</span>
              </div>
            </label>
            {/* Ödeme */}
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
                className={`p-2.5 border-2 rounded-lg cursor-pointer text-center transition-all ${
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
              options={getFilteredCategories().map((c) => ({
                value: c.id,
                label: c.name,
              }))}
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

          {/* Kur bilgisi gösterimi */}
          {formData.currency !== 'TRY' && formData.amount && (
            <div className="p-3 text-sm border border-blue-200 rounded-lg bg-blue-50">
              <div className="flex items-center justify-between">
                <span className="text-blue-700">Güncel Kur:</span>
                <span className="font-medium text-blue-900">
                  1 {formData.currency} ={' '}
                  {(formData.currency === 'USD' ? exchangeRates.USD : exchangeRates.EUR).toFixed(4)}{' '}
                  TL
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-blue-700">TL Karşılığı:</span>
                <span className="font-medium text-blue-900">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
                    parseFloat(formData.amount) *
                      (formData.currency === 'USD' ? exchangeRates.USD : exchangeRates.EUR)
                  )}
                </span>
              </div>
            </div>
          )}

          <Select
            label="Proje (Opsiyonel)"
            options={projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
            value={formData.project_id}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setFormData({ ...formData, project_id: e.target.value })
            }
            placeholder="Proje seçin..."
          />

          <Input
            label="Belge No"
            value={formData.document_no}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, document_no: e.target.value })
            }
            placeholder="Fatura/İrsaliye no"
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

export default CompanyDetail;

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiList, FiEdit2, FiTrash2, FiDownload } from 'react-icons/fi';
import { useDebounce, usePagination, paginateArray } from '../hooks';
import {
  Card,
  CardBody,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  StatCard,
  Badge,
  EmptyState,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ConfirmDialog,
  Pagination,
} from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency, formatDate, formatDateForInput } from '../utils/formatters';
import {
  TRANSACTION_TYPES,
  TRANSACTION_SCOPES,
  TRANSACTION_TYPE_LABELS,
} from '../utils/constants';
import { transactionColumns, formatRecordsForExport, exportToCSV } from '../utils/exportUtils';
import type {
  TransactionWithDetails,
  Company,
  Project,
  Category,
  TransactionType,
  TransactionScope,
  BadgeVariant,
  Currency,
} from '../types';

interface TransactionFilters {
  search: string;
  scope: string;
  type: string;
  company_id: string;
  project_id: string;
  start_date: string;
  end_date: string;
}

interface TransactionFormData {
  date: string;
  type: TransactionType;
  scope: TransactionScope;
  company_id: string;
  project_id: string;
  category_id: string;
  amount: string;
  currency: Currency;
  description: string;
  document_no: string;
}

function Transactions() {
  const navigate = useNavigate();
  const toast = useToast();
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    scope: '',
    type: '',
    company_id: '',
    project_id: '',
    start_date: '',
    end_date: '',
  });
  const debouncedSearch = useDebounce(filters.search, 300);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState<TransactionFormData>({
    date: '',
    type: 'invoice_out',
    scope: 'company',
    company_id: '',
    project_id: '',
    category_id: '',
    amount: '',
    currency: 'TRY',
    description: '',
    document_no: '',
  });
  // Toplu seçim state'leri
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txData, companiesData, projectsData, categoriesData] = await Promise.all([
        window.electronAPI.transaction.getAll({}),
        window.electronAPI.company.getAll(),
        window.electronAPI.project.getAll(),
        window.electronAPI.category.getAll(),
      ]);
      setTransactions(txData);
      setCompanies(companiesData);
      setProjects(projectsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTransaction = (tx: TransactionWithDetails) => {
    setSelectedTransaction(tx);
    setFormData({
      date: formatDateForInput(tx.date),
      type: tx.type,
      scope: tx.scope,
      company_id: tx.company_id ? String(tx.company_id) : '',
      project_id: tx.project_id ? String(tx.project_id) : '',
      category_id: tx.category_id ? String(tx.category_id) : '',
      amount: tx.amount.toString(),
      currency: tx.currency || 'TRY',
      description: tx.description,
      document_no: tx.document_no || '',
    });
    setEditMode(false);
    setShowModal(true);
  };

  const handleEditTransaction = (tx: TransactionWithDetails) => {
    setSelectedTransaction(tx);
    setFormData({
      date: formatDateForInput(tx.date),
      type: tx.type,
      scope: tx.scope,
      company_id: tx.company_id ? String(tx.company_id) : '',
      project_id: tx.project_id ? String(tx.project_id) : '',
      category_id: tx.category_id ? String(tx.category_id) : '',
      amount: tx.amount.toString(),
      currency: tx.currency || 'TRY',
      description: tx.description,
      document_no: tx.document_no || '',
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleSaveTransaction = async () => {
    if (!selectedTransaction) return;
    try {
      await window.electronAPI.transaction.update(selectedTransaction.id, {
        ...formData,
        amount: parseFloat(formData.amount),
        company_id: formData.company_id || undefined,
        project_id: formData.project_id || undefined,
        category_id: formData.category_id || undefined,
      });
      setShowModal(false);
      toast.success('İşlem başarıyla güncellendi');
      loadData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('İşlem güncellenirken hata oluştu');
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTransaction) return;
    try {
      await window.electronAPI.transaction.delete(selectedTransaction.id);
      setShowDeleteConfirm(false);
      setShowModal(false);
      toast.success('İşlem başarıyla silindi');
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('İşlem silinirken hata oluştu');
    }
  };

  // Toplu seçim fonksiyonları
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedTransactions.map((tx) => tx.id)));
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

  const closeModal = () => {
    setShowModal(false);
    setSelectedTransaction(null);
    setEditMode(false);
  };

  const handleExport = async () => {
    try {
      const exportData = formatRecordsForExport(filteredTransactions, transactionColumns);
      const result = await exportToCSV('islemler', exportData);
      if (result) {
        toast.success('Veriler başarıyla dışa aktarıldı');
      }
    } catch (error) {
      toast.error('Dışa aktarma sırasında hata oluştu');
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        !debouncedSearch ||
        tx.description.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (tx.company_name &&
          tx.company_name.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
        (tx.project_name && tx.project_name.toLowerCase().includes(debouncedSearch.toLowerCase()));
      const matchesScope = !filters.scope || tx.scope === filters.scope;
      const matchesType = !filters.type || tx.type === filters.type;
      const matchesCompany = !filters.company_id || tx.company_id === parseInt(filters.company_id);
      const matchesProject = !filters.project_id || tx.project_id === parseInt(filters.project_id);
      const matchesStartDate = !filters.start_date || tx.date >= filters.start_date;
      const matchesEndDate = !filters.end_date || tx.date <= filters.end_date;

      return (
        matchesSearch &&
        matchesScope &&
        matchesType &&
        matchesCompany &&
        matchesProject &&
        matchesStartDate &&
        matchesEndDate
      );
    });
  }, [
    transactions,
    debouncedSearch,
    filters.scope,
    filters.type,
    filters.company_id,
    filters.project_id,
    filters.start_date,
    filters.end_date,
  ]);

  // Pagination
  const pagination = usePagination({
    totalItems: filteredTransactions.length,
    initialPageSize: 25,
  });

  // Reset to first page when filters change
  useEffect(() => {
    pagination.goToPage(1);
  }, [
    debouncedSearch,
    filters.scope,
    filters.type,
    filters.company_id,
    filters.project_id,
    filters.start_date,
    filters.end_date,
  ]);

  const paginatedTransactions = useMemo(() => {
    return paginateArray(filteredTransactions, pagination.currentPage, pagination.pageSize);
  }, [filteredTransactions, pagination.currentPage, pagination.pageSize]);

  // Yeni 4 tip sistemi için hesaplamalar
  const totalInvoiceOut = filteredTransactions
    .filter((t) => t.type === 'invoice_out')
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
  const totalPaymentIn = filteredTransactions
    .filter((t) => t.type === 'payment_in')
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
  const totalInvoiceIn = filteredTransactions
    .filter((t) => t.type === 'invoice_in')
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);
  const totalPaymentOut = filteredTransactions
    .filter((t) => t.type === 'payment_out')
    .reduce((sum, t) => sum + (t.amount_try || t.amount), 0);

  // Kar-Zarar (faturalar bazında)
  const netProfit = totalInvoiceOut - totalInvoiceIn;
  // Nakit Akışı (ödemeler bazında)
  const netCashFlow = totalPaymentIn - totalPaymentOut;

  // İşlem tipi renk yardımcısı
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

  const getScopeLabel = (scope: string): { label: string; variant: BadgeVariant } => {
    switch (scope) {
      case 'cari':
        return { label: 'Cari', variant: 'info' };
      case 'project':
        return { label: 'Proje', variant: 'purple' };
      case 'company':
        return { label: 'Firma', variant: 'default' };
      default:
        return { label: scope, variant: 'default' };
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="page-title">Tüm İşlemler</h1>
            <p className="mt-1 text-sm text-gray-500">Sistemdeki tüm işlem hareketleri</p>
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <FiTrash2 size={14} />
              {selectedIds.size} işlem sil
            </button>
          )}
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 btn btn-secondary"
          title="Excel'e Aktar"
        >
          <FiDownload size={16} />
          Dışa Aktar
        </button>
      </div>

      {/* Stats - Satır 1: Faturalar ve Ödemeler */}
      <div className="grid grid-cols-2 gap-4 mb-4 md:grid-cols-4">
        <StatCard
          title="Satış Faturaları"
          value={formatCurrency(totalInvoiceOut)}
          subtitle={`${filteredTransactions.filter((t) => t.type === 'invoice_out').length} işlem`}
          color="green"
        />
        <StatCard
          title="Tahsilatlar"
          value={formatCurrency(totalPaymentIn)}
          subtitle={`${filteredTransactions.filter((t) => t.type === 'payment_in').length} işlem`}
          color="blue"
        />
        <StatCard
          title="Alış Faturaları"
          value={formatCurrency(totalInvoiceIn)}
          subtitle={`${filteredTransactions.filter((t) => t.type === 'invoice_in').length} işlem`}
          color="red"
        />
        <StatCard
          title="Ödemeler"
          value={formatCurrency(totalPaymentOut)}
          subtitle={`${filteredTransactions.filter((t) => t.type === 'payment_out').length} işlem`}
          color="orange"
        />
      </div>

      {/* Stats - Satır 2: Özetler */}
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
        <StatCard
          title="Kâr/Zarar (Faturalar)"
          value={formatCurrency(netProfit)}
          subtitle="Satış - Alış Faturaları"
          color={netProfit >= 0 ? 'green' : 'red'}
          highlighted
        />
        <StatCard
          title="Nakit Akışı"
          value={formatCurrency(netCashFlow)}
          subtitle="Tahsilat - Ödeme"
          color={netCashFlow >= 0 ? 'green' : 'red'}
          highlighted
        />
        <StatCard
          title="Net Durum"
          value={formatCurrency(netProfit + netCashFlow)}
          subtitle="Kâr/Zarar + Nakit"
          color={netProfit + netCashFlow >= 0 ? 'green' : 'red'}
          highlighted
        />
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            <div className="col-span-2">
              <Input
                placeholder="İşlem ara..."
                icon={FiSearch}
                value={filters.search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters({ ...filters, search: e.target.value })
                }
              />
            </div>
            <Select
              options={TRANSACTION_SCOPES}
              value={filters.scope}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFilters({ ...filters, scope: e.target.value })
              }
              placeholder="Kaynak"
            />
            <Select
              options={TRANSACTION_TYPES}
              value={filters.type}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFilters({ ...filters, type: e.target.value })
              }
              placeholder="Tür"
            />
            <Select
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              value={filters.company_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFilters({ ...filters, company_id: e.target.value })
              }
              placeholder="Cari"
            />
            <Input
              type="date"
              value={filters.start_date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFilters({ ...filters, start_date: e.target.value })
              }
              placeholder="Başlangıç"
            />
            <Input
              type="date"
              value={filters.end_date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFilters({ ...filters, end_date: e.target.value })
              }
              placeholder="Bitiş"
            />
          </div>
        </CardBody>
      </Card>

      {/* Table */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 spinner"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState
              icon={FiList}
              title="İşlem bulunamadı"
              description="Filtrelere uygun işlem kaydı yok"
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
                        selectedIds.size === paginatedTransactions.length
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Cari/Proje</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead className="w-20 text-center">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((tx) => {
                  const scopeConfig = getScopeLabel(tx.scope);
                  return (
                    <TableRow
                      key={tx.id}
                      className={`cursor-pointer ${selectedIds.has(tx.id) ? 'bg-blue-50' : ''}`}
                      onClick={() => handleViewTransaction(tx)}
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
                        <Badge variant={scopeConfig.variant}>{scopeConfig.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getTransactionColor(tx.type)} text-white`}
                        >
                          {TRANSACTION_TYPE_LABELS[tx.type]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tx.company_name ? (
                          <span
                            className="text-blue-600 cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/companies/${tx.company_id}`);
                            }}
                          >
                            {tx.company_name}
                          </span>
                        ) : tx.project_name ? (
                          <span
                            className="text-purple-600 cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/projects/${tx.project_id}`);
                            }}
                          >
                            {tx.project_name}
                          </span>
                        ) : (
                          <span className="text-gray-400">Firma Genel</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{tx.description}</p>
                        {tx.document_no && (
                          <p className="text-xs text-gray-500">Belge: {tx.document_no}</p>
                        )}
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
                      <TableCell
                        className={`text-right font-medium ${getTransactionTextColor(tx.type)}`}
                      >
                        {tx.type === 'invoice_out' || tx.type === 'payment_in' ? '+' : '-'}
                        {formatCurrency(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div
                          className="flex items-center justify-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleEditTransaction(tx)}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Düzenle"
                          >
                            <FiEdit2 size={16} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {filteredTransactions.length > 0 && (
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
              onPageChange={pagination.goToPage}
              onPageSizeChange={pagination.setPageSize}
              onFirstPage={pagination.goToFirstPage}
              onLastPage={pagination.goToLastPage}
              onPrevPage={pagination.goToPrevPage}
              onNextPage={pagination.goToNextPage}
            />
          )}
        </CardBody>
      </Card>

      {/* View/Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal} size="lg">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <span>{editMode ? 'İşlem Düzenle' : 'İşlem Detayı'}</span>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <FiEdit2 size={14} />
                Düzenle
              </button>
            )}
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Tarih</label>
              {editMode ? (
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                />
              ) : (
                <p className="py-2 text-gray-900">{formatDate(formData.date)}</p>
              )}
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Tür</label>
              {editMode ? (
                <Select
                  options={TRANSACTION_TYPES}
                  value={formData.type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormData({ ...formData, type: e.target.value as TransactionType })
                  }
                />
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getTransactionColor(formData.type)} text-white`}
                >
                  {TRANSACTION_TYPE_LABELS[formData.type]}
                </span>
              )}
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Kaynak</label>
              {editMode ? (
                <Select
                  options={TRANSACTION_SCOPES}
                  value={formData.scope}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormData({
                      ...formData,
                      scope: e.target.value as TransactionScope,
                      company_id: '',
                      project_id: '',
                    })
                  }
                />
              ) : (
                <Badge variant={getScopeLabel(formData.scope).variant}>
                  {getScopeLabel(formData.scope).label}
                </Badge>
              )}
            </div>
            {formData.scope === 'cari' && (
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Cari</label>
                {editMode ? (
                  <Select
                    options={companies.map((c) => ({ value: c.id, label: c.name }))}
                    value={formData.company_id}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setFormData({ ...formData, company_id: e.target.value })
                    }
                    placeholder="Cari Seçin"
                  />
                ) : (
                  <p className="py-2 text-gray-900">
                    {companies.find((c) => c.id === parseInt(formData.company_id))?.name || '-'}
                  </p>
                )}
              </div>
            )}
            {formData.scope === 'project' && (
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Proje</label>
                {editMode ? (
                  <Select
                    options={projects.map((p) => ({ value: p.id, label: p.name }))}
                    value={formData.project_id}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setFormData({ ...formData, project_id: e.target.value })
                    }
                    placeholder="Proje Seçin"
                  />
                ) : (
                  <p className="py-2 text-gray-900">
                    {projects.find((p) => p.id === parseInt(formData.project_id))?.name || '-'}
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Tutar</label>
              {editMode ? (
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                />
              ) : (
                <p className={`text-lg font-bold ${getTransactionTextColor(formData.type)}`}>
                  {formData.type === 'invoice_out' || formData.type === 'payment_in' ? '+' : '-'}
                  {formatCurrency(parseFloat(formData.amount))}
                </p>
              )}
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Kategori</label>
              {editMode ? (
                <Select
                  options={categories
                    .filter((c) => {
                      if (formData.type === 'invoice_out') return c.type === 'invoice_out';
                      if (formData.type === 'invoice_in') return c.type === 'invoice_in';
                      return c.type === 'payment';
                    })
                    .map((c) => ({ value: c.id, label: c.name }))}
                  value={formData.category_id}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFormData({ ...formData, category_id: e.target.value })
                  }
                  placeholder="Kategori Seçin"
                />
              ) : (
                <p className="py-2 text-gray-900">
                  {categories.find((c) => c.id === parseInt(formData.category_id))?.name || '-'}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="block mb-1 text-sm font-medium text-gray-700">Açıklama</label>
              {editMode ? (
                <Input
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="İşlem açıklaması"
                />
              ) : (
                <p className="py-2 text-gray-900">{formData.description || '-'}</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="block mb-1 text-sm font-medium text-gray-700">Belge No</label>
              {editMode ? (
                <Input
                  value={formData.document_no}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, document_no: e.target.value })
                  }
                  placeholder="Fatura/Makbuz numarası"
                />
              ) : (
                <p className="py-2 text-gray-900">{formData.document_no || '-'}</p>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex items-center justify-between w-full">
            <div>
              {editMode && (
                <button
                  onClick={handleDeleteClick}
                  className="flex items-center gap-2 btn btn-danger"
                >
                  <FiTrash2 size={16} />
                  Sil
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={closeModal} className="btn btn-secondary">
                {editMode ? 'İptal' : 'Kapat'}
              </button>
              {editMode && (
                <button onClick={handleSaveTransaction} className="btn btn-primary">
                  Kaydet
                </button>
              )}
            </div>
          </div>
        </ModalFooter>
      </Modal>

      {/* Silme Onay Dialogu */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="İşlemi Sil"
        message="Bu işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        type="danger"
        confirmText="Sil"
        cancelText="İptal"
      />

      {/* Toplu Silme Onay Dialogu */}
      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Toplu Silme"
        message={`Seçili ${selectedIds.size} işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        type="danger"
        confirmText="Tümünü Sil"
        cancelText="İptal"
      />
    </div>
  );
}

export default Transactions;

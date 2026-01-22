import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts, useDebounce, usePagination, paginateArray } from '../hooks';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiUser, FiUsers, FiDownload } from 'react-icons/fi';
import {
  Card,
  CardBody,
  Button,
  Input,
  Select,
  Modal,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TypeBadge,
  AccountTypeBadge,
  BalanceBadge,
  EmptyState,
  ConfirmDialog,
  Pagination,
} from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../utils/formatters';
import { COMPANY_TYPES, ACCOUNT_TYPES } from '../utils/constants';
import { companyColumns, formatRecordsForExport, exportToCSV } from '../utils/exportUtils';
import type { CompanyWithBalance, CompanyType, AccountType, CompanyFormData } from '../types';

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyWithBalance | null;
  onSave: (isNew: boolean) => void;
}

function Companies() {
  const navigate = useNavigate();
  const toast = useToast();
  const [companies, setCompanies] = useState<CompanyWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAccountType, setFilterAccountType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithBalance | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CompanyWithBalance | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNew: () => setModalOpen(true),
    onEscape: () => {
      if (modalOpen) {
        setModalOpen(false);
        setEditingCompany(null);
      }
    },
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.company.getWithBalance();
      setCompanies(data);
    } catch (error) {
      console.error('Companies loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await window.electronAPI.company.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success('Cari hesap başarıyla silindi');
      loadCompanies();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Silme sırasında hata oluştu');
    }
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedCompanies.map((c) => c.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      const idsArray = Array.from(selectedIds);
      let successCount = 0;
      let errorCount = 0;

      for (const id of idsArray) {
        try {
          await window.electronAPI.company.delete(id);
          successCount++;
        } catch {
          errorCount++;
        }
      }

      setBulkDeleteConfirm(false);
      setSelectedIds(new Set());

      if (errorCount === 0) {
        toast.success(`${successCount} cari hesap başarıyla silindi`);
      } else {
        toast.warning(`${successCount} silindi, ${errorCount} silinemedi`);
      }

      loadCompanies();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Toplu silme sırasında hata oluştu');
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleSave = (isNew: boolean) => {
    setModalOpen(false);
    setEditingCompany(null);
    toast.success(isNew ? 'Cari hesap başarıyla oluşturuldu' : 'Cari hesap başarıyla güncellendi');
    loadCompanies();
  };

  const handleExport = async () => {
    try {
      const exportData = formatRecordsForExport(filteredCompanies, companyColumns);
      const result = await exportToCSV('cari_hesaplar', exportData);
      if (result) {
        toast.success('Veriler başarıyla dışa aktarıldı');
      }
    } catch (error) {
      toast.error('Dışa aktarma sırasında hata oluştu');
    }
  };

  const debouncedSearch = useDebounce(search, 300);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesSearch = company.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesType = !filterType || company.type === filterType;
      const matchesAccountType = !filterAccountType || company.account_type === filterAccountType;
      return matchesSearch && matchesType && matchesAccountType;
    });
  }, [companies, debouncedSearch, filterType, filterAccountType]);

  // Pagination
  const pagination = usePagination({
    totalItems: filteredCompanies.length,
    initialPageSize: 25,
  });

  // Reset to first page when filters change
  useEffect(() => {
    pagination.goToPage(1);
  }, [debouncedSearch, filterType, filterAccountType]);

  const paginatedCompanies = useMemo(() => {
    return paginateArray(filteredCompanies, pagination.currentPage, pagination.pageSize);
  }, [filteredCompanies, pagination.currentPage, pagination.pageSize]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cari Hesaplar</h1>
          <p className="mt-1 text-sm text-gray-500">Müşteri, tedarikçi ve taşeron yönetimi</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => setBulkDeleteConfirm(true)}
                className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 btn"
              >
                <FiTrash2 size={16} />
                {selectedIds.size} cari sil
              </button>
              <div className="w-px h-6 bg-gray-300" />
            </>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 btn btn-secondary"
            title="Excel'e Aktar"
          >
            <FiDownload size={16} />
            Dışa Aktar
          </button>
          <Button icon={FiPlus} onClick={() => setModalOpen(true)}>
            Yeni Cari
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Cari ara..."
                icon={FiSearch}
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Select
                options={COMPANY_TYPES}
                value={filterType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFilterType(e.target.value)
                }
                placeholder="Tür"
              />
            </div>
            <div className="w-40">
              <Select
                options={ACCOUNT_TYPES}
                value={filterAccountType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFilterAccountType(e.target.value)
                }
                placeholder="Cari Tipi"
              />
            </div>
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
          ) : filteredCompanies.length === 0 ? (
            <EmptyState
              icon={FiUsers}
              title="Cari hesap bulunamadı"
              description="Yeni bir cari hesap ekleyerek başlayın"
              action={() => setModalOpen(true)}
              actionLabel="Yeni Cari Ekle"
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
                        paginatedCompanies.length > 0 &&
                        paginatedCompanies.every((c) => selectedIds.has(c.id))
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Cari Tipi</TableHead>
                  <TableHead>Ad/Ünvan</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead className="text-right">Alacak</TableHead>
                  <TableHead className="text-right">Borç</TableHead>
                  <TableHead className="text-right">Bakiye</TableHead>
                  <TableHead className="text-center">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCompanies.map((company) => (
                  <TableRow
                    key={company.id}
                    className={`cursor-pointer ${selectedIds.has(company.id) ? 'bg-blue-50' : ''}`}
                    onClick={() => navigate(`/companies/${company.id}`)}
                  >
                    <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(company.id)}
                        onChange={(e) => handleSelectOne(company.id, e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={company.type} />
                    </TableCell>
                    <TableCell>
                      <AccountTypeBadge accountType={company.account_type} />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-gray-900">{company.name}</span>
                    </TableCell>
                    <TableCell>{company.phone || '-'}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(company.receivable)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(company.payable)}
                    </TableCell>
                    <TableCell className="text-right">
                      <BalanceBadge amount={company.balance} size="sm" />
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center justify-center gap-1"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingCompany(company);
                            setModalOpen(true);
                          }}
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:text-yellow-600 hover:bg-yellow-50"
                          title="Düzenle"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(company)}
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:text-red-600 hover:bg-red-50"
                          title="Sil"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filteredCompanies.length > 0 && (
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

      {/* Company Modal */}
      <CompanyModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCompany(null);
        }}
        company={editingCompany}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Cari Hesabı Sil"
        message={`"${deleteConfirm?.name}" cari hesabını silmek istediğinize emin misiniz? Bu işlem geri alınabilir.`}
        type="danger"
        confirmText="Sil"
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Toplu Silme"
        message={`${selectedIds.size} cari hesabı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        type="danger"
        confirmText={`${selectedIds.size} Kayıt Sil`}
      />
    </div>
  );
}

// Company Modal Component
function CompanyModal({ isOpen, onClose, company, onSave }: CompanyModalProps) {
  const [formData, setFormData] = useState<CompanyFormData>({
    type: 'person',
    account_type: 'customer',
    name: '',
    tc_number: '',
    profession: '',
    tax_office: '',
    tax_number: '',
    trade_registry_no: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    bank_name: '',
    iban: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (company) {
      setFormData({
        type: company.type || 'person',
        account_type: company.account_type || 'customer',
        name: company.name || '',
        tc_number: company.tc_number || '',
        profession: company.profession || '',
        tax_office: company.tax_office || '',
        tax_number: company.tax_number || '',
        trade_registry_no: company.trade_registry_no || '',
        contact_person: company.contact_person || '',
        phone: company.phone || '',
        email: company.email || '',
        address: company.address || '',
        bank_name: company.bank_name || '',
        iban: company.iban || '',
        notes: company.notes || '',
      });
    } else {
      setFormData({
        type: 'person',
        account_type: '' as AccountType,
        name: '',
        tc_number: '',
        profession: '',
        tax_office: '',
        tax_number: '',
        trade_registry_no: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        bank_name: '',
        iban: '',
        notes: '',
      });
    }
  }, [company, isOpen]);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const tcInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const ibanInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const phoneDigits = formData.phone?.replace(/\D/g, '') || '';
    if (phoneDigits.length > 0 && phoneDigits.length < 11) {
      if (phoneInputRef.current) {
        phoneInputRef.current.setCustomValidity('Telefon numarası 11 haneli olmalıdır');
        phoneInputRef.current.reportValidity();
      }
      return;
    }

    if (
      formData.type === 'person' &&
      formData.tc_number &&
      formData.tc_number.length > 0 &&
      formData.tc_number.length < 11
    ) {
      if (tcInputRef.current) {
        tcInputRef.current.setCustomValidity('TC Kimlik No 11 haneli olmalıdır');
        tcInputRef.current.reportValidity();
      }
      return;
    }

    const ibanText = formData.iban?.replace(/\s/g, '') || '';
    const isIbanEmpty = ibanText === '' || ibanText === 'TR';
    const ibanNumbers = formData.iban?.replace(/[^0-9]/g, '') || '';
    if (!isIbanEmpty && ibanNumbers.length < 24) {
      if (ibanInputRef.current) {
        ibanInputRef.current.setCustomValidity('IBAN 24 haneli olmalıdır (TR hariç)');
        ibanInputRef.current.reportValidity();
      }
      return;
    }

    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        iban: isIbanEmpty ? '' : formData.iban,
      };

      if (company) {
        await window.electronAPI.company.update(company.id, dataToSave);
        onSave(false);
      } else {
        await window.electronAPI.company.create(dataToSave);
        onSave(true);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={company ? 'Cari Hesap Düzenle' : 'Yeni Cari Hesap'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ModalBody className="space-y-6">
          {/* Type Selection */}
          <div className="flex gap-4">
            <label className="flex-1">
              <input
                type="radio"
                name="type"
                value="person"
                checked={formData.type === 'person'}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, type: e.target.value as CompanyType })
                }
                className="sr-only"
              />
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.type === 'person'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FiUser
                    className={formData.type === 'person' ? 'text-blue-600' : 'text-gray-400'}
                    size={24}
                  />
                  <div>
                    <p className="font-medium">Şahıs</p>
                    <p className="text-xs text-gray-500">Bireysel hesap</p>
                  </div>
                </div>
              </div>
            </label>
            <label className="flex-1">
              <input
                type="radio"
                name="type"
                value="company"
                checked={formData.type === 'company'}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, type: e.target.value as CompanyType })
                }
                className="sr-only"
              />
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.type === 'company'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FiUsers
                    className={formData.type === 'company' ? 'text-blue-600' : 'text-gray-400'}
                    size={24}
                  />
                  <div>
                    <p className="font-medium">Kuruluş</p>
                    <p className="text-xs text-gray-500">Firma hesabı</p>
                  </div>
                </div>
              </div>
            </label>
          </div>

          {/* Account Type */}
          <Select
            label="Cari Tipi *"
            options={ACCOUNT_TYPES}
            value={formData.account_type}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setFormData({ ...formData, account_type: e.target.value as AccountType })
            }
            required
          />

          {/* Conditional Fields based on type */}
          {formData.type === 'person' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Ad Soyad *"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
                <Input
                  ref={tcInputRef}
                  label="TC Kimlik No"
                  value={formData.tc_number || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    tcInputRef.current?.setCustomValidity('');
                    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setFormData({ ...formData, tc_number: value });
                  }}
                  placeholder="12345678901"
                  maxLength={11}
                />
              </div>
              <Input
                label="Meslek/Uzmanlık"
                value={formData.profession || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, profession: e.target.value })
                }
              />
            </>
          ) : (
            <>
              <Input
                label="Firma Ünvanı *"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Vergi Dairesi"
                  value={formData.tax_office || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, tax_office: e.target.value })
                  }
                />
                <Input
                  label="Vergi No"
                  value={formData.tax_number || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, tax_number: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Ticaret Sicil No"
                  value={formData.trade_registry_no || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, trade_registry_no: e.target.value })
                  }
                />
                <Input
                  label="Yetkili Kişi"
                  value={formData.contact_person || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, contact_person: e.target.value })
                  }
                />
              </div>
            </>
          )}

          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              ref={phoneInputRef}
              label="Telefon"
              type="tel"
              value={formData.phone || ''}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Backspace') {
                  e.preventDefault();
                  phoneInputRef.current?.setCustomValidity('');
                  const currentDigits = formData.phone?.replace(/\D/g, '') || '';
                  if (currentDigits.length > 0) {
                    const newDigits = currentDigits.slice(0, -1);
                    if (newDigits.length === 0) {
                      setFormData({ ...formData, phone: '' });
                    } else {
                      let formatted = '';
                      if (newDigits.length >= 1) formatted += newDigits[0];
                      if (newDigits.length >= 2) formatted += '(' + newDigits[1];
                      if (newDigits.length >= 3) formatted += newDigits[2];
                      if (newDigits.length >= 4) formatted += newDigits[3] + ') ';
                      if (newDigits.length >= 5) formatted += newDigits[4];
                      if (newDigits.length >= 6) formatted += newDigits[5];
                      if (newDigits.length >= 7) formatted += newDigits[6] + ' ';
                      if (newDigits.length >= 8) formatted += newDigits[7];
                      if (newDigits.length >= 9) formatted += newDigits[8] + ' ';
                      if (newDigits.length >= 10) formatted += newDigits[9];
                      setFormData({ ...formData, phone: formatted });
                    }
                  }
                }
              }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                phoneInputRef.current?.setCustomValidity('');

                const newDigits = e.target.value.replace(/\D/g, '');
                if (newDigits.length === 0) {
                  setFormData({ ...formData, phone: '' });
                  return;
                }

                let digits = newDigits;
                if (!digits.startsWith('0')) {
                  digits = '0' + digits;
                }
                if (digits.length > 1 && digits[1] !== '5') {
                  digits = '05' + digits.slice(2);
                }
                digits = digits.slice(0, 11);

                let formatted = '';
                if (digits.length >= 1) formatted += digits[0];
                if (digits.length >= 2) formatted += '(' + digits[1];
                if (digits.length >= 3) formatted += digits[2];
                if (digits.length >= 4) formatted += digits[3] + ') ';
                if (digits.length >= 5) formatted += digits[4];
                if (digits.length >= 6) formatted += digits[5];
                if (digits.length >= 7) formatted += digits[6] + ' ';
                if (digits.length >= 8) formatted += digits[7];
                if (digits.length >= 9) formatted += digits[8] + ' ';
                if (digits.length >= 10) formatted += digits[9];
                if (digits.length >= 11) formatted += digits[10];

                setFormData({ ...formData, phone: formatted });
              }}
              placeholder="0(5XX) XXX XX XX"
              maxLength={16}
            />
            <Input
              ref={emailInputRef}
              label="E-posta"
              type="email"
              value={formData.email || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                emailInputRef.current?.setCustomValidity('');
                setFormData({ ...formData, email: e.target.value });
              }}
              placeholder="ornek@email.com"
            />
          </div>

          <Input
            label="Adres"
            value={formData.address || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, address: e.target.value })
            }
          />

          {/* Bank Info */}
          <div className="pt-4 border-t">
            <p className="mb-3 text-sm font-medium text-gray-700">Banka Bilgileri (Opsiyonel)</p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Banka"
                value={formData.bank_name || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, bank_name: e.target.value })
                }
              />
              <Input
                ref={ibanInputRef}
                label="IBAN"
                value={formData.iban || ''}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Backspace') {
                    e.preventDefault();
                    ibanInputRef.current?.setCustomValidity('');
                    const currentNumbers = formData.iban?.replace(/[^0-9]/g, '') || '';
                    if (currentNumbers.length > 0) {
                      const newNumbers = currentNumbers.slice(0, -1);
                      if (newNumbers.length === 0) {
                        setFormData({ ...formData, iban: '' });
                      } else {
                        let formatted = 'TR';
                        for (let i = 0; i < newNumbers.length; i++) {
                          if (i % 4 === 0) formatted += ' ';
                          formatted += newNumbers[i];
                        }
                        setFormData({ ...formData, iban: formatted });
                      }
                    }
                  }
                }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  ibanInputRef.current?.setCustomValidity('');

                  const value = e.target.value.toUpperCase();
                  const numbers = value.replace(/[^0-9]/g, '').slice(0, 24);

                  if (numbers.length === 0) {
                    setFormData({ ...formData, iban: '' });
                    return;
                  }

                  let formatted = 'TR';
                  for (let i = 0; i < numbers.length; i++) {
                    if (i % 4 === 0) formatted += ' ';
                    formatted += numbers[i];
                  }

                  setFormData({ ...formData, iban: formatted });
                }}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                maxLength={32}
              />
            </div>
          </div>

          <Input
            label="Notlar"
            value={formData.notes || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, notes: e.target.value })
            }
          />
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose} type="button">
            İptal
          </Button>
          <Button type="submit" loading={loading}>
            {company ? 'Güncelle' : 'Kaydet'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default Companies;

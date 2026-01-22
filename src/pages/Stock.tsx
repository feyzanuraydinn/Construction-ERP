import { useState, useEffect, useMemo } from 'react';
import {
  FiPlus,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiPackage,
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiAlertTriangle,
} from 'react-icons/fi';
import {
  Card,
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
  Badge,
  EmptyState,
  ConfirmDialog,
  Pagination,
} from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { useDebounce, useKeyboardShortcuts, usePagination, paginateArray } from '../hooks';
import { formatCurrency, formatDate, formatDateForInput, formatNumber } from '../utils/formatters';
import { MATERIAL_CATEGORIES, MATERIAL_UNITS, MOVEMENT_TYPES } from '../utils/constants';
import type { Material, StockMovementWithDetails, Project, Company, MovementType } from '../types';

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  onSave: (isNew: boolean) => void;
}

interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: Material[];
  projects: Project[];
  companies: Company[];
  onSave: (isNew: boolean) => void;
}

interface MaterialFormData {
  code: string;
  name: string;
  category: string;
  unit: string;
  min_stock: string;
  current_stock: string;
  notes: string;
}

interface MovementFormData {
  material_id: string;
  movement_type: MovementType;
  quantity: string;
  unit_price: string;
  project_id: string;
  company_id: string;
  date: string;
  description: string;
  document_no: string;
}

function Stock() {
  const toast = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [movements, setMovements] = useState<StockMovementWithDetails[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'materials' | 'movements'>('materials');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Material | null>(null);

  // Bulk selection state for materials
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<number>>(new Set());
  const [bulkDeleteMaterialConfirm, setBulkDeleteMaterialConfirm] = useState(false);

  // Bulk selection state for movements
  const [selectedMovementIds, setSelectedMovementIds] = useState<Set<number>>(new Set());
  const [bulkDeleteMovementConfirm, setBulkDeleteMovementConfirm] = useState(false);

  // Keyboard shortcuts - Ctrl+N opens appropriate modal based on active tab
  useKeyboardShortcuts({
    onNew: () => {
      if (activeTab === 'materials') {
        setMaterialModalOpen(true);
      } else {
        setMovementModalOpen(true);
      }
    },
    onEscape: () => {
      if (materialModalOpen) {
        setMaterialModalOpen(false);
        setEditingMaterial(null);
      }
      if (movementModalOpen) {
        setMovementModalOpen(false);
      }
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [materialsData, movementsData, projectsData, companiesData] = await Promise.all([
        window.electronAPI.material.getAll(),
        window.electronAPI.stock.getAll({}),
        window.electronAPI.project.getAll(),
        window.electronAPI.company.getAll(),
      ]);
      setMaterials(materialsData);
      setMovements(movementsData);
      setProjects(projectsData);
      setCompanies(companiesData);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async () => {
    if (!deleteConfirm) return;
    try {
      await window.electronAPI.material.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success('Malzeme başarıyla silindi');
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Silme sırasında hata oluştu');
    }
  };

  const handleMaterialSave = (isNew: boolean) => {
    setMaterialModalOpen(false);
    setEditingMaterial(null);
    toast.success(isNew ? 'Malzeme başarıyla oluşturuldu' : 'Malzeme başarıyla güncellendi');
    loadData();
  };

  const handleMovementSave = (_isNew: boolean) => {
    setMovementModalOpen(false);
    toast.success('Stok hareketi başarıyla kaydedildi');
    loadData();
  };

  // Bulk selection handlers for materials
  const handleSelectAllMaterials = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedMaterials.map((m) => m.id));
      setSelectedMaterialIds(allIds);
    } else {
      setSelectedMaterialIds(new Set());
    }
  };

  const handleSelectOneMaterial = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedMaterialIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedMaterialIds(newSelected);
  };

  const handleBulkDeleteMaterials = async () => {
    if (selectedMaterialIds.size === 0) return;
    try {
      const idsArray = Array.from(selectedMaterialIds);
      let successCount = 0;
      let errorCount = 0;
      for (const id of idsArray) {
        try {
          await window.electronAPI.material.delete(id);
          successCount++;
        } catch {
          errorCount++;
        }
      }
      setBulkDeleteMaterialConfirm(false);
      setSelectedMaterialIds(new Set());
      if (errorCount === 0) {
        toast.success(`${successCount} malzeme başarıyla silindi`);
      } else {
        toast.warning(`${successCount} silindi, ${errorCount} silinemedi`);
      }
      loadData();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Toplu silme sırasında hata oluştu');
    }
  };

  // Bulk selection handlers for movements
  const handleSelectAllMovements = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedMovements.map((m) => m.id));
      setSelectedMovementIds(allIds);
    } else {
      setSelectedMovementIds(new Set());
    }
  };

  const handleSelectOneMovement = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedMovementIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedMovementIds(newSelected);
  };

  const handleBulkDeleteMovements = async () => {
    if (selectedMovementIds.size === 0) return;
    try {
      const idsArray = Array.from(selectedMovementIds);
      let successCount = 0;
      let errorCount = 0;
      for (const id of idsArray) {
        try {
          await window.electronAPI.stock.delete(id);
          successCount++;
        } catch {
          errorCount++;
        }
      }
      setBulkDeleteMovementConfirm(false);
      setSelectedMovementIds(new Set());
      if (errorCount === 0) {
        toast.success(`${successCount} hareket başarıyla silindi`);
      } else {
        toast.warning(`${successCount} silindi, ${errorCount} silinemedi`);
      }
      loadData();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Toplu silme sırasında hata oluştu');
    }
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        m.code.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesCategory = !filterCategory || m.category === filterCategory;
      const matchesStatus =
        !filterStatus ||
        (filterStatus === 'low' && m.current_stock < m.min_stock) ||
        (filterStatus === 'ok' && m.current_stock >= m.min_stock);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [materials, debouncedSearch, filterCategory, filterStatus]);

  // Pagination for materials
  const materialsPagination = usePagination({
    totalItems: filteredMaterials.length,
    initialPageSize: 25,
  });

  // Pagination for movements
  const movementsPagination = usePagination({
    totalItems: movements.length,
    initialPageSize: 25,
  });

  // Reset to first page when filters change
  useEffect(() => {
    materialsPagination.goToPage(1);
  }, [debouncedSearch, filterCategory, filterStatus]);

  const paginatedMaterials = useMemo(() => {
    return paginateArray(
      filteredMaterials,
      materialsPagination.currentPage,
      materialsPagination.pageSize
    );
  }, [filteredMaterials, materialsPagination.currentPage, materialsPagination.pageSize]);

  const paginatedMovements = useMemo(() => {
    return paginateArray(movements, movementsPagination.currentPage, movementsPagination.pageSize);
  }, [movements, movementsPagination.currentPage, movementsPagination.pageSize]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Stok Yönetimi</h1>
          <p className="mt-1 text-sm text-gray-500">Malzeme ve stok takibi</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'materials' && selectedMaterialIds.size > 0 && (
            <>
              <button
                onClick={() => setBulkDeleteMaterialConfirm(true)}
                className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 btn"
              >
                <FiTrash2 size={16} />
                {selectedMaterialIds.size} malzeme sil
              </button>
              <div className="w-px h-6 bg-gray-300" />
            </>
          )}
          {activeTab === 'movements' && selectedMovementIds.size > 0 && (
            <>
              <button
                onClick={() => setBulkDeleteMovementConfirm(true)}
                className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 btn"
              >
                <FiTrash2 size={16} />
                {selectedMovementIds.size} hareket sil
              </button>
              <div className="w-px h-6 bg-gray-300" />
            </>
          )}
          <Button
            variant="secondary"
            icon={FiArrowDownCircle}
            onClick={() => setMovementModalOpen(true)}
          >
            Stok Hareketi
          </Button>
          <Button icon={FiPlus} onClick={() => setMaterialModalOpen(true)}>
            Yeni Malzeme
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('materials')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'materials'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Malzemeler
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'movements'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Stok Hareketleri
        </button>
      </div>

      {activeTab === 'materials' && (
        <>
          {/* Filters */}
          <Card className="mb-6">
            <CardBody>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Malzeme ara..."
                    icon={FiSearch}
                    value={search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  />
                </div>
                <div className="w-40">
                  <Select
                    options={MATERIAL_CATEGORIES}
                    value={filterCategory}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setFilterCategory(e.target.value)
                    }
                    placeholder="Kategori"
                  />
                </div>
                <div className="w-40">
                  <Select
                    options={[
                      { value: 'low', label: 'Kritik Stok' },
                      { value: 'ok', label: 'Normal' },
                    ]}
                    value={filterStatus}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setFilterStatus(e.target.value)
                    }
                    placeholder="Durum"
                  />
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Materials Table */}
          <Card>
            <CardBody className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-10 h-10 spinner"></div>
                </div>
              ) : filteredMaterials.length === 0 ? (
                <EmptyState
                  icon={FiPackage}
                  title="Malzeme bulunamadı"
                  description="Yeni malzeme ekleyerek başlayın"
                  action={() => setMaterialModalOpen(true)}
                  actionLabel="Yeni Malzeme"
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
                            paginatedMaterials.length > 0 &&
                            paginatedMaterials.every((m) => selectedMaterialIds.has(m.id))
                          }
                          onChange={(e) => handleSelectAllMaterials(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </TableHead>
                      <TableHead>Kod</TableHead>
                      <TableHead>Malzeme Adı</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Birim</TableHead>
                      <TableHead className="text-right">Mevcut Stok</TableHead>
                      <TableHead className="text-right">Min. Stok</TableHead>
                      <TableHead className="text-center">Durum</TableHead>
                      <TableHead className="text-center">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMaterials.map((material) => {
                      const isLowStock = material.current_stock < material.min_stock;
                      return (
                        <TableRow
                          key={material.id}
                          className={selectedMaterialIds.has(material.id) ? 'bg-blue-50' : ''}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedMaterialIds.has(material.id)}
                              onChange={(e) =>
                                handleSelectOneMaterial(material.id, e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm text-gray-500">{material.code}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-gray-900">{material.name}</span>
                          </TableCell>
                          <TableCell>
                            {MATERIAL_CATEGORIES.find((c) => c.value === material.category)
                              ?.label || material.category}
                          </TableCell>
                          <TableCell>{material.unit}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}
                          >
                            {formatNumber(material.current_stock, 2)}
                          </TableCell>
                          <TableCell className="text-right text-gray-500">
                            {formatNumber(material.min_stock, 2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {isLowStock ? (
                              <Badge variant="danger">
                                <FiAlertTriangle size={12} className="mr-1" /> Kritik
                              </Badge>
                            ) : (
                              <Badge variant="success">Normal</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingMaterial(material);
                                  setMaterialModalOpen(true);
                                }}
                                className="p-2 text-gray-500 transition-colors rounded-lg hover:text-yellow-600 hover:bg-yellow-50"
                              >
                                <FiEdit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(material)}
                                className="p-2 text-gray-500 transition-colors rounded-lg hover:text-red-600 hover:bg-red-50"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {filteredMaterials.length > 0 && (
                <Pagination
                  currentPage={materialsPagination.currentPage}
                  totalPages={materialsPagination.totalPages}
                  totalItems={materialsPagination.totalItems}
                  pageSize={materialsPagination.pageSize}
                  startIndex={materialsPagination.startIndex}
                  endIndex={materialsPagination.endIndex}
                  pageNumbers={materialsPagination.pageNumbers}
                  canPrevPage={materialsPagination.canPrevPage}
                  canNextPage={materialsPagination.canNextPage}
                  onPageChange={materialsPagination.goToPage}
                  onPageSizeChange={materialsPagination.setPageSize}
                  onFirstPage={materialsPagination.goToFirstPage}
                  onLastPage={materialsPagination.goToLastPage}
                  onPrevPage={materialsPagination.goToPrevPage}
                  onNextPage={materialsPagination.goToNextPage}
                />
              )}
            </CardBody>
          </Card>
        </>
      )}

      {activeTab === 'movements' && (
        <Card>
          <CardBody className="p-0">
            {movements.length === 0 ? (
              <EmptyState
                icon={FiPackage}
                title="Stok hareketi bulunamadı"
                action={() => setMovementModalOpen(true)}
                actionLabel="Yeni Hareket"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow hover={false}>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={
                          paginatedMovements.length > 0 &&
                          paginatedMovements.every((m) => selectedMovementIds.has(m.id))
                        }
                        onChange={(e) => handleSelectAllMovements(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Malzeme</TableHead>
                    <TableHead className="text-right">Miktar</TableHead>
                    <TableHead>Proje</TableHead>
                    <TableHead>Tedarikçi</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMovements.map((movement) => (
                    <TableRow
                      key={movement.id}
                      className={selectedMovementIds.has(movement.id) ? 'bg-blue-50' : ''}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedMovementIds.has(movement.id)}
                          onChange={(e) => handleSelectOneMovement(movement.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </TableCell>
                      <TableCell>{formatDate(movement.date)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            movement.movement_type === 'in'
                              ? 'success'
                              : movement.movement_type === 'out'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {movement.movement_type === 'in' && (
                            <FiArrowDownCircle size={12} className="mr-1" />
                          )}
                          {movement.movement_type === 'out' && (
                            <FiArrowUpCircle size={12} className="mr-1" />
                          )}
                          {MOVEMENT_TYPES.find((t) => t.value === movement.movement_type)?.label ||
                            movement.movement_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{movement.material_name}</span>
                        <span className="ml-2 text-xs text-gray-500">{movement.material_code}</span>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          movement.movement_type === 'in' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {movement.movement_type === 'in' ? '+' : '-'}
                        {formatNumber(movement.quantity, 2)} {movement.material_unit}
                      </TableCell>
                      <TableCell>{movement.project_name || '-'}</TableCell>
                      <TableCell>{movement.company_name || '-'}</TableCell>
                      <TableCell className="text-right">
                        {movement.total_price ? formatCurrency(movement.total_price) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {movements.length > 0 && (
              <Pagination
                currentPage={movementsPagination.currentPage}
                totalPages={movementsPagination.totalPages}
                totalItems={movementsPagination.totalItems}
                pageSize={movementsPagination.pageSize}
                startIndex={movementsPagination.startIndex}
                endIndex={movementsPagination.endIndex}
                pageNumbers={movementsPagination.pageNumbers}
                canPrevPage={movementsPagination.canPrevPage}
                canNextPage={movementsPagination.canNextPage}
                onPageChange={movementsPagination.goToPage}
                onPageSizeChange={movementsPagination.setPageSize}
                onFirstPage={movementsPagination.goToFirstPage}
                onLastPage={movementsPagination.goToLastPage}
                onPrevPage={movementsPagination.goToPrevPage}
                onNextPage={movementsPagination.goToNextPage}
              />
            )}
          </CardBody>
        </Card>
      )}

      {/* Material Modal */}
      <MaterialModal
        isOpen={materialModalOpen}
        onClose={() => {
          setMaterialModalOpen(false);
          setEditingMaterial(null);
        }}
        material={editingMaterial}
        onSave={handleMaterialSave}
      />

      {/* Movement Modal */}
      <MovementModal
        isOpen={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        materials={materials}
        projects={projects}
        companies={companies}
        onSave={handleMovementSave}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteMaterial}
        title="Malzemeyi Sil"
        message={`"${deleteConfirm?.name}" malzemesini silmek istediğinize emin misiniz?`}
        type="danger"
        confirmText="Sil"
      />

      {/* Bulk Delete Materials Confirmation */}
      <ConfirmDialog
        isOpen={bulkDeleteMaterialConfirm}
        onClose={() => setBulkDeleteMaterialConfirm(false)}
        onConfirm={handleBulkDeleteMaterials}
        title="Toplu Silme"
        message={`${selectedMaterialIds.size} malzemeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        type="danger"
        confirmText={`${selectedMaterialIds.size} Malzeme Sil`}
      />

      {/* Bulk Delete Movements Confirmation */}
      <ConfirmDialog
        isOpen={bulkDeleteMovementConfirm}
        onClose={() => setBulkDeleteMovementConfirm(false)}
        onConfirm={handleBulkDeleteMovements}
        title="Toplu Silme"
        message={`${selectedMovementIds.size} stok hareketini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        type="danger"
        confirmText={`${selectedMovementIds.size} Hareket Sil`}
      />
    </div>
  );
}

// Material Modal
function MaterialModal({ isOpen, onClose, material, onSave }: MaterialModalProps) {
  const [formData, setFormData] = useState<MaterialFormData>({
    code: '',
    name: '',
    category: '',
    unit: 'adet',
    min_stock: '',
    current_stock: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initForm = async () => {
      if (material) {
        setFormData({
          code: material.code,
          name: material.name,
          category: material.category || '',
          unit: material.unit,
          min_stock: material.min_stock ? String(material.min_stock) : '',
          current_stock: material.current_stock ? String(material.current_stock) : '',
          notes: material.notes || '',
        });
      } else {
        const code = await window.electronAPI.material.generateCode();
        setFormData({
          code,
          name: '',
          category: '',
          unit: 'adet',
          min_stock: '',
          current_stock: '0',
          notes: '',
        });
      }
    };
    if (isOpen) initForm();
  }, [material, isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...formData,
        min_stock: formData.min_stock ? parseFloat(formData.min_stock) : 0,
        current_stock: formData.current_stock ? parseFloat(formData.current_stock) : 0,
      };

      if (material) {
        await window.electronAPI.material.update(material.id, data);
        onSave(false);
      } else {
        await window.electronAPI.material.create(data);
        onSave(true);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={material ? 'Malzeme Düzenle' : 'Yeni Malzeme'}>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Malzeme Kodu"
              value={formData.code}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, code: e.target.value })
              }
              disabled={!!material}
            />
            <Select
              label="Kategori *"
              options={MATERIAL_CATEGORIES}
              value={formData.category}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, category: e.target.value })
              }
              required
            />
          </div>

          <Input
            label="Malzeme Adı *"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
          />

          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Birim *"
              options={MATERIAL_UNITS}
              value={formData.unit}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, unit: e.target.value })
              }
              required
            />
            <Input
              label="Minimum Stok"
              type="number"
              step="0.01"
              value={formData.min_stock}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, min_stock: e.target.value })
              }
            />
            {!material && (
              <Input
                label="Mevcut Stok"
                type="number"
                step="0.01"
                value={formData.current_stock}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, current_stock: e.target.value })
                }
              />
            )}
          </div>

          <Textarea
            label="Notlar"
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
            {material ? 'Güncelle' : 'Kaydet'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// Movement Modal
function MovementModal({
  isOpen,
  onClose,
  materials,
  projects,
  companies,
  onSave,
}: MovementModalProps) {
  const [formData, setFormData] = useState<MovementFormData>({
    material_id: '',
    movement_type: 'in',
    quantity: '',
    unit_price: '',
    project_id: '',
    company_id: '',
    date: formatDateForInput(new Date().toISOString()),
    description: '',
    document_no: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        material_id: '',
        movement_type: 'in',
        quantity: '',
        unit_price: '',
        project_id: '',
        company_id: '',
        date: formatDateForInput(new Date().toISOString()),
        description: '',
        document_no: '',
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...formData,
        quantity: parseFloat(formData.quantity),
        unit_price: formData.unit_price ? parseFloat(formData.unit_price) : undefined,
        project_id: formData.project_id || undefined,
        company_id: formData.company_id || undefined,
      };

      await window.electronAPI.stock.create(data);
      onSave(true);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedMaterial = materials.find((m) => m.id === parseInt(formData.material_id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Stok Hareketi" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ModalBody className="space-y-4">
          {/* Movement Type */}
          <div className="grid grid-cols-4 gap-2">
            {MOVEMENT_TYPES.map((type) => (
              <label key={type.value}>
                <input
                  type="radio"
                  name="movement_type"
                  value={type.value}
                  checked={formData.movement_type === type.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, movement_type: e.target.value as MovementType })
                  }
                  className="sr-only"
                />
                <div
                  className={`p-2 border-2 rounded-lg cursor-pointer text-center text-sm transition-all ${
                    formData.movement_type === type.value
                      ? type.value === 'in'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : type.value === 'out'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-yellow-500 bg-yellow-50 text-yellow-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {type.label.split(' ')[0]}
                </div>
              </label>
            ))}
          </div>

          <Select
            label="Malzeme *"
            options={materials.map((m) => ({
              value: m.id,
              label: `${m.code} - ${m.name} (Stok: ${m.current_stock} ${m.unit})`,
            }))}
            value={formData.material_id}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setFormData({ ...formData, material_id: e.target.value })
            }
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`Miktar * ${selectedMaterial ? `(${selectedMaterial.unit})` : ''}`}
              type="number"
              step="0.01"
              min="0"
              value={formData.quantity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, quantity: e.target.value })
              }
              required
            />
            {formData.movement_type === 'in' && (
              <Input
                label="Birim Fiyat (TL)"
                type="number"
                step="0.01"
                min="0"
                value={formData.unit_price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, unit_price: e.target.value })
                }
              />
            )}
          </div>

          {formData.movement_type === 'in' && (
            <Select
              label="Tedarikçi"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              value={formData.company_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, company_id: e.target.value })
              }
              placeholder="Tedarikçi seçin..."
            />
          )}

          {formData.movement_type === 'out' && (
            <Select
              label="Proje *"
              options={projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
              value={formData.project_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, project_id: e.target.value })
              }
              placeholder="Proje seçin..."
              required
            />
          )}

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
            <Input
              label="Belge No"
              value={formData.document_no}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, document_no: e.target.value })
              }
              placeholder="Irsaliye/Fatura"
            />
          </div>

          <Input
            label="Açıklama"
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose} type="button">
            İptal
          </Button>
          <Button type="submit" loading={loading}>
            Kaydet
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default Stock;

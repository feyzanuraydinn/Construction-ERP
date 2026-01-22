import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiFolder,
  FiHome,
  FiUser,
  FiDownload,
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
  StatusBadge,
  Badge,
  BalanceBadge,
  EmptyState,
  ConfirmDialog,
  Pagination,
} from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { useDebounce, useKeyboardShortcuts, usePagination, paginateArray } from '../hooks';
import { formatCurrency, formatDateForInput } from '../utils/formatters';
import { PROJECT_STATUSES, PROJECT_TYPES, OWNERSHIP_TYPES } from '../utils/constants';
import { projectColumns, formatRecordsForExport, exportToCSV } from '../utils/exportUtils';
import type {
  ProjectWithSummary,
  Company,
  ProjectStatus,
  ProjectType,
  OwnershipType,
} from '../types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectWithSummary | null;
  companies: Company[];
  onSave: (isNew: boolean) => void;
}

interface ProjectFormData {
  code: string;
  name: string;
  ownership_type: OwnershipType;
  client_company_id: string;
  status: ProjectStatus;
  project_type: ProjectType;
  location: string;
  total_area: string;
  unit_count: string;
  estimated_budget: string;
  planned_start: string;
  planned_end: string;
  actual_start: string;
  actual_end: string;
  description: string;
}

function Projects() {
  const navigate = useNavigate();
  const toast = useToast();
  const [projects, setProjects] = useState<ProjectWithSummary[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOwnership, setFilterOwnership] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithSummary | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectWithSummary | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNew: () => setModalOpen(true),
    onEscape: () => {
      if (modalOpen) {
        setModalOpen(false);
        setEditingProject(null);
      }
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsData, companiesData] = await Promise.all([
        window.electronAPI.project.getWithSummary(),
        window.electronAPI.company.getAll(),
      ]);
      setProjects(projectsData);
      setCompanies(companiesData);
    } catch (error) {
      console.error('Projects loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await window.electronAPI.project.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success('Proje başarıyla silindi');
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Silme sırasında hata oluştu');
    }
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedProjects.map((p) => p.id));
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
          await window.electronAPI.project.delete(id);
          successCount++;
        } catch {
          errorCount++;
        }
      }
      setBulkDeleteConfirm(false);
      setSelectedIds(new Set());
      if (errorCount === 0) {
        toast.success(`${successCount} proje başarıyla silindi`);
      } else {
        toast.warning(`${successCount} silindi, ${errorCount} silinemedi`);
      }
      loadData();
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
    setEditingProject(null);
    toast.success(isNew ? 'Proje başarıyla oluşturuldu' : 'Proje başarıyla güncellendi');
    loadData();
  };

  const handleExport = async () => {
    try {
      const exportData = formatRecordsForExport(filteredProjects, projectColumns);
      const result = await exportToCSV('projeler', exportData);
      if (result) {
        toast.success('Veriler başarıyla dışa aktarıldı');
      }
    } catch (error) {
      toast.error('Dışa aktarma sırasında hata oluştu');
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        project.code.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesStatus = !filterStatus || project.status === filterStatus;
      const matchesOwnership = !filterOwnership || project.ownership_type === filterOwnership;
      return matchesSearch && matchesStatus && matchesOwnership;
    });
  }, [projects, debouncedSearch, filterStatus, filterOwnership]);

  // Pagination
  const pagination = usePagination({
    totalItems: filteredProjects.length,
    initialPageSize: 25,
  });

  // Reset to first page when filters change
  useEffect(() => {
    pagination.goToPage(1);
  }, [debouncedSearch, filterStatus, filterOwnership]);

  const paginatedProjects = useMemo(() => {
    return paginateArray(filteredProjects, pagination.currentPage, pagination.pageSize);
  }, [filteredProjects, pagination.currentPage, pagination.pageSize]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Projeler</h1>
          <p className="mt-1 text-sm text-gray-500">İnşaat projelerini yönetin</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => setBulkDeleteConfirm(true)}
                className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 btn"
              >
                <FiTrash2 size={16} />
                {selectedIds.size} proje sil
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
            Yeni Proje
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Proje ara..."
                icon={FiSearch}
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Select
                options={PROJECT_STATUSES}
                value={filterStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFilterStatus(e.target.value)
                }
                placeholder="Durum"
              />
            </div>
            <div className="w-44">
              <Select
                options={OWNERSHIP_TYPES}
                value={filterOwnership}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFilterOwnership(e.target.value)
                }
                placeholder="Sahiplik"
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
          ) : filteredProjects.length === 0 ? (
            <EmptyState
              icon={FiFolder}
              title="Proje bulunamadı"
              description="Yeni bir proje ekleyerek başlayın"
              action={() => setModalOpen(true)}
              actionLabel="Yeni Proje"
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
                        paginatedProjects.length > 0 &&
                        paginatedProjects.every((p) => selectedIds.has(p.id))
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </TableHead>
                  <TableHead>Kod</TableHead>
                  <TableHead>Proje Adı</TableHead>
                  <TableHead>Sahiplik</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Bütçe</TableHead>
                  <TableHead className="text-right">Harcanan</TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead className="text-right">Kar/Zarar</TableHead>
                  <TableHead className="text-center">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProjects.map((project) => {
                  const budgetUsed = project.estimated_budget
                    ? (project.total_expense / project.estimated_budget) * 100
                    : 0;
                  return (
                    <TableRow
                      key={project.id}
                      className={`cursor-pointer ${selectedIds.has(project.id) ? 'bg-blue-50' : ''}`}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(project.id)}
                          onChange={(e) => handleSelectOne(project.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-gray-500">{project.code}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-gray-900">{project.name}</span>
                        {project.client_name && (
                          <p className="text-xs text-gray-500">{project.client_name}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={project.ownership_type === 'own' ? 'info' : 'purple'}>
                          {project.ownership_type === 'own' ? (
                            <>
                              <FiHome size={12} className="mr-1" /> Kendi
                            </>
                          ) : (
                            <>
                              <FiUser size={12} className="mr-1" /> Müşteri
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={project.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(project.estimated_budget) || '-'}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(project.total_expense)}
                      </TableCell>
                      <TableCell className="text-center">
                        {project.estimated_budget ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 overflow-hidden bg-gray-200 rounded-full">
                              <div
                                className={`h-full rounded-full ${
                                  budgetUsed > 90
                                    ? 'bg-red-500'
                                    : budgetUsed > 70
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                              />
                            </div>
                            <span className="w-10 text-xs text-gray-500">
                              {budgetUsed.toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <BalanceBadge amount={project.profit_loss} size="sm" />
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center justify-center gap-1"
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setEditingProject(project);
                              setModalOpen(true);
                            }}
                            className="p-2 text-gray-500 transition-colors rounded-lg hover:text-yellow-600 hover:bg-yellow-50"
                            title="Düzenle"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(project)}
                            className="p-2 text-gray-500 transition-colors rounded-lg hover:text-red-600 hover:bg-red-50"
                            title="Sil"
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
          {filteredProjects.length > 0 && (
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

      {/* Project Modal */}
      <ProjectModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProject(null);
        }}
        project={editingProject}
        companies={companies}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Projeyi Sil"
        message={`"${deleteConfirm?.name}" projesini silmek istediğinize emin misiniz?`}
        type="danger"
        confirmText="Sil"
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Toplu Silme"
        message={`${selectedIds.size} projeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        type="danger"
        confirmText={`${selectedIds.size} Proje Sil`}
      />
    </div>
  );
}

// Project Modal Component
function ProjectModal({ isOpen, onClose, project, companies, onSave }: ProjectModalProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    code: '',
    name: '',
    ownership_type: 'own',
    client_company_id: '',
    status: 'planned',
    project_type: 'residential',
    location: '',
    total_area: '',
    unit_count: '',
    estimated_budget: '',
    planned_start: '',
    planned_end: '',
    actual_start: '',
    actual_end: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initForm = async () => {
      if (project) {
        setFormData({
          code: project.code || '',
          name: project.name || '',
          ownership_type: project.ownership_type || 'own',
          client_company_id: project.client_company_id ? String(project.client_company_id) : '',
          status: project.status || 'planned',
          project_type: project.project_type || 'residential',
          location: project.location || '',
          total_area: project.total_area ? String(project.total_area) : '',
          unit_count: project.unit_count ? String(project.unit_count) : '',
          estimated_budget: project.estimated_budget ? String(project.estimated_budget) : '',
          planned_start: formatDateForInput(project.planned_start) || '',
          planned_end: formatDateForInput(project.planned_end) || '',
          actual_start: formatDateForInput(project.actual_start) || '',
          actual_end: formatDateForInput(project.actual_end) || '',
          description: project.description || '',
        });
      } else {
        const code = await window.electronAPI.project.generateCode();
        setFormData({
          code,
          name: '',
          ownership_type: 'own',
          client_company_id: '',
          status: '' as ProjectStatus,
          project_type: '' as ProjectType,
          location: '',
          total_area: '',
          unit_count: '',
          estimated_budget: '',
          planned_start: '',
          planned_end: '',
          actual_start: '',
          actual_end: '',
          description: '',
        });
      }
    };
    if (isOpen) initForm();
  }, [project, isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...formData,
        total_area: formData.total_area ? parseFloat(formData.total_area) : undefined,
        unit_count: formData.unit_count ? parseInt(formData.unit_count) : undefined,
        estimated_budget: formData.estimated_budget
          ? parseFloat(formData.estimated_budget)
          : undefined,
        client_company_id:
          formData.ownership_type === 'client' ? formData.client_company_id : undefined,
      };

      if (project) {
        await window.electronAPI.project.update(project.id, data);
        onSave(false);
      } else {
        await window.electronAPI.project.create(data);
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
      title={project ? 'Proje Düzenle' : 'Yeni Proje'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ModalBody className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Proje Kodu"
              value={formData.code}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, code: e.target.value })
              }
              disabled={!!project}
            />
            <Select
              label="Durum *"
              options={PROJECT_STATUSES}
              value={formData.status}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, status: e.target.value as ProjectStatus })
              }
              required
            />
          </div>

          <Input
            label="Proje Adı *"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, name: e.target.value })
            }
            required
          />

          {/* Ownership Type */}
          <div>
            <label className="label">Proje Sahipliği</label>
            <div className="flex gap-4">
              <label className="flex-1">
                <input
                  type="radio"
                  name="ownership"
                  value="own"
                  checked={formData.ownership_type === 'own'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({
                      ...formData,
                      ownership_type: e.target.value as OwnershipType,
                      client_company_id: '',
                    })
                  }
                  className="sr-only"
                />
                <div
                  className={`p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${
                    formData.ownership_type === 'own'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <FiHome className="mx-auto mb-1" />
                  <span className="text-sm font-medium">Kendi Projemiz</span>
                </div>
              </label>
              <label className="flex-1">
                <input
                  type="radio"
                  name="ownership"
                  value="client"
                  checked={formData.ownership_type === 'client'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, ownership_type: e.target.value as OwnershipType })
                  }
                  className="sr-only"
                />
                <div
                  className={`p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${
                    formData.ownership_type === 'client'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <FiUser className="mx-auto mb-1" />
                  <span className="text-sm font-medium">Müşteri Projesi</span>
                </div>
              </label>
            </div>
          </div>

          {formData.ownership_type === 'client' && (
            <Select
              label="İlgili Cari Hesap"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              value={formData.client_company_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, client_company_id: e.target.value })
              }
              placeholder="Cari hesap seçin..."
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Proje Tipi *"
              options={PROJECT_TYPES}
              value={formData.project_type}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, project_type: e.target.value as ProjectType })
              }
              required
            />
            <Input
              label="Tahmini Bütçe (TL)"
              type="number"
              value={formData.estimated_budget}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, estimated_budget: e.target.value })
              }
            />
          </div>

          <Input
            label="Konum/Adres"
            value={formData.location}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, location: e.target.value })
            }
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Toplam Alan (m2)"
              type="number"
              value={formData.total_area}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, total_area: e.target.value })
              }
            />
            <Input
              label="Birim Sayısı"
              type="number"
              value={formData.unit_count}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, unit_count: e.target.value })
              }
              placeholder="Daire, dükkan sayısı"
            />
          </div>

          {/* Dates */}
          <div className="pt-4 border-t">
            <p className="mb-3 text-sm font-medium text-gray-700">Tarihler</p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Planlanan Başlangıç"
                type="date"
                value={formData.planned_start}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, planned_start: e.target.value })
                }
              />
              <Input
                label="Planlanan Bitiş"
                type="date"
                value={formData.planned_end}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, planned_end: e.target.value })
                }
              />
              <Input
                label="Gerçek Başlangıç"
                type="date"
                value={formData.actual_start}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, actual_start: e.target.value })
                }
              />
              <Input
                label="Gerçek Bitiş"
                type="date"
                value={formData.actual_end}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, actual_end: e.target.value })
                }
              />
            </div>
          </div>

          <Textarea
            label="Açıklama"
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={2}
          />
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={onClose} type="button">
            İptal
          </Button>
          <Button type="submit" loading={loading}>
            {project ? 'Güncelle' : 'Kaydet'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default Projects;

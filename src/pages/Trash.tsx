import { useState, useEffect } from 'react';
import { FiTrash2, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  EmptyState,
  ConfirmDialog,
} from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { formatDate, formatCurrency } from '../utils/formatters';
import type { TrashItem, BadgeVariant } from '../types';

interface ConfirmDialogState {
  open: boolean;
  type: string;
  item: TrashItem | null;
}

const TYPE_LABELS: Record<string, string> = {
  company: 'Cari Hesap',
  project: 'Proje',
  transaction: 'İşlem',
  material: 'Malzeme',
};

const TYPE_COLORS: Record<string, BadgeVariant> = {
  company: 'info',
  project: 'purple',
  transaction: 'success',
  material: 'warning',
};

function Trash() {
  const toast = useToast();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    type: '',
    item: null,
  });

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    try {
      const data = await window.electronAPI.trash.getAll();
      setItems(data);
    } catch (error) {
      console.error('Trash load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = (item: TrashItem) => {
    setConfirmDialog({ open: true, type: 'restore', item });
  };

  const handleRestoreConfirm = async () => {
    if (!confirmDialog.item) return;
    try {
      await window.electronAPI.trash.restore(confirmDialog.item.id);
      setConfirmDialog({ open: false, type: '', item: null });
      toast.success('Öğe başarıyla geri yüklendi');
      loadTrash();
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('Geri yükleme sırasında hata oluştu');
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmDialog.item) return;
    try {
      await window.electronAPI.trash.permanentDelete(confirmDialog.item.id);
      setConfirmDialog({ open: false, type: '', item: null });
      toast.success('Öğe kalıcı olarak silindi');
      loadTrash();
    } catch (error) {
      console.error('Permanent delete error:', error);
      toast.error('Silme sırasında hata oluştu');
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await window.electronAPI.trash.empty();
      setConfirmDialog({ open: false, type: '', item: null });
      toast.success('Çöp kutusu boşaltıldı');
      loadTrash();
    } catch (error) {
      console.error('Empty trash error:', error);
      toast.error('Çöp kutusu boşaltılırken hata oluştu');
    }
  };

  const getItemName = (item: TrashItem): string => {
    const data = JSON.parse(item.data);
    switch (item.type) {
      case 'company':
        return data.name;
      case 'project':
        return data.name;
      case 'transaction':
        return `${data.description || 'İşlem'} - ${formatCurrency(data.amount)}`;
      case 'material':
        return data.name;
      default:
        return 'Bilinmeyen';
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Çöp Kutusu</h1>
          <p className="text-gray-500 text-sm mt-1">
            Silinen öğeler 30 gün içinde otomatik olarak kalıcı silinir
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="danger"
            icon={FiTrash2}
            onClick={() => setConfirmDialog({ open: true, type: 'empty', item: null })}
          >
            Çöp Kutusunu Boşalt
          </Button>
        )}
      </div>

      {/* Warning */}
      {items.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <FiAlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm text-amber-800 font-medium">Dikkat</p>
            <p className="text-sm text-amber-700">
              Kalıcı olarak silinen öğeler geri getirilemez. İlişkili işlemler ve veriler de
              silinecektir.
            </p>
          </div>
        </div>
      )}

      {/* Trash List */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Silinen Öğeler ({items.length})</h3>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={FiTrash2}
              title="Çöp kutusu boş"
              description="Silinen öğeler burada görünecektir"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow hover={false}>
                  <TableHead>Tür</TableHead>
                  <TableHead>Öğe</TableHead>
                  <TableHead>Silinme Tarihi</TableHead>
                  <TableHead> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={TYPE_COLORS[item.type] || 'default'}>
                        {TYPE_LABELS[item.type] || item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{getItemName(item)}</span>
                    </TableCell>
                    <TableCell>{formatDate(item.deleted_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleRestoreClick(item)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Geri Yükle"
                        >
                          <FiRefreshCw size={16} />
                        </button>
                        <button
                          onClick={() => setConfirmDialog({ open: true, type: 'delete', item })}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Kalıcı Olarak Sil"
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
        </CardBody>
      </Card>

      {/* Confirm Dialog - Restore */}
      <ConfirmDialog
        isOpen={confirmDialog.open && confirmDialog.type === 'restore'}
        onClose={() => setConfirmDialog({ open: false, type: '', item: null })}
        onConfirm={handleRestoreConfirm}
        title="Geri Yükle"
        message={`"${confirmDialog.item ? getItemName(confirmDialog.item) : ''}" öğesini geri yüklemek istediğinizden emin misiniz?`}
        confirmText="Geri Yükle"
        type="success"
      />

      {/* Confirm Dialog - Permanent Delete */}
      <ConfirmDialog
        isOpen={confirmDialog.open && confirmDialog.type === 'delete'}
        onClose={() => setConfirmDialog({ open: false, type: '', item: null })}
        onConfirm={handlePermanentDelete}
        title="Kalıcı Olarak Sil"
        message={`"${confirmDialog.item ? getItemName(confirmDialog.item) : ''}" öğesini kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Kalıcı Sil"
        type="danger"
      />

      {/* Confirm Dialog - Empty Trash */}
      <ConfirmDialog
        isOpen={confirmDialog.open && confirmDialog.type === 'empty'}
        onClose={() => setConfirmDialog({ open: false, type: '', item: null })}
        onConfirm={handleEmptyTrash}
        title="Çöp Kutusunu Boşalt"
        message={`Çöp kutusundaki ${items.length} öğenin tamamını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Tümünü Sil"
        type="danger"
      />
    </div>
  );
}

export default Trash;

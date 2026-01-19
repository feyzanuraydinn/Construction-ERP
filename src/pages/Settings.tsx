import { useState, useEffect } from 'react';
import {
  FiDatabase,
  FiPlus,
  FiX,
  FiFolder,
  FiRefreshCw,
  FiDownload,
  FiCloud,
  FiCloudOff,
  FiUploadCloud,
  FiCheck,
  FiLink,
  FiSettings,
} from 'react-icons/fi';
import { Card, CardHeader, CardBody, Button, Input, Select, ConfirmDialog } from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import type { Category } from '../types';

interface BackupInfo {
  exists: boolean;
  path?: string;
  size?: number;
  date?: string;
}

interface DriveBackupFile {
  id: string;
  name: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
}

type CategoryType = 'invoice_out' | 'invoice_in' | 'payment';

interface NewCategory {
  name: string;
  type: CategoryType;
  color: string;
}

const CATEGORY_TYPES = [
  { value: 'invoice_out', label: 'Satış Faturası (Gelir)' },
  { value: 'invoice_in', label: 'Alış Faturası (Gider)' },
  { value: 'payment', label: 'Ödeme/Tahsilat Türü' },
];

const COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#64748b',
  '#71717a',
  '#78716c',
];

function Settings() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<boolean>(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const [newCategory, setNewCategory] = useState<NewCategory>({
    name: '',
    type: '' as CategoryType,
    color: '#ef4444',
  });

  // Google Drive states
  const [driveHasCredentials, setDriveHasCredentials] = useState<boolean | null>(null);
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[] | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveBackupsLoading, setDriveBackupsLoading] = useState(false);
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [credentials, setCredentials] = useState({ clientId: '', clientSecret: '' });
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([
        loadCategories(),
        loadBackupInfo(),
        checkDriveStatus(),
        loadAppVersion(),
      ]);
      setInitialLoading(false);
    };
    loadAll();
  }, []);

  const loadAppVersion = async () => {
    try {
      const version = await window.electronAPI.app.getVersion();
      setAppVersion(version);
    } catch (error) {
      console.error('Failed to get app version:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await window.electronAPI.category.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Categories load error:', error);
    }
  };

  const loadBackupInfo = async () => {
    try {
      const backups = await window.electronAPI.backup.list();
      if (backups.length > 0) {
        const latest = backups[0]; // En son yedek
        setBackupInfo({
          exists: true,
          path: latest.path,
          size: latest.size,
          date: latest.date,
        });
      } else {
        setBackupInfo({ exists: false });
      }
    } catch (error) {
      console.error('Backup info load error:', error);
    }
  };

  const checkDriveStatus = async () => {
    try {
      const hasCredentials = await window.electronAPI.gdrive.hasCredentials();
      setDriveHasCredentials(hasCredentials);
      if (hasCredentials) {
        const isConnected = await window.electronAPI.gdrive.isConnected();
        setDriveConnected(isConnected);
        if (isConnected) {
          loadDriveBackups();
        }
      }
    } catch (error) {
      console.error('Drive status check error:', error);
    }
  };

  const handleSaveCredentials = async () => {
    if (!credentials.clientId.trim() || !credentials.clientSecret.trim()) {
      toast.error('Client ID ve Client Secret gereklidir');
      return;
    }
    setDriveLoading(true);
    try {
      await window.electronAPI.gdrive.saveCredentials(
        credentials.clientId,
        credentials.clientSecret
      );
      setDriveHasCredentials(true);
      setShowCredentialsForm(false);
      toast.success('Credentials kaydedildi');
    } catch (error) {
      toast.error('Kaydetme hatası');
    } finally {
      setDriveLoading(false);
    }
  };

  const loadDriveBackups = async () => {
    setDriveBackupsLoading(true);
    try {
      const data = await window.electronAPI.gdrive.listBackups();
      setDriveBackups(data);
    } catch (error) {
      console.error('Drive backups load error:', error);
      setDriveBackups([]);
    } finally {
      setDriveBackupsLoading(false);
    }
  };

  const handleDriveConnect = async () => {
    setDriveLoading(true);
    try {
      const result = await window.electronAPI.gdrive.connect();
      if (result.success) {
        setDriveConnected(true);
        toast.success('Google Drive bağlantısı başarılı');
        loadDriveBackups();
      } else {
        toast.error(result.error || 'Bağlantı başarısız');
      }
    } catch (error) {
      toast.error('Bağlantı hatası');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDriveDisconnect = async () => {
    setDriveLoading(true);
    try {
      await window.electronAPI.gdrive.disconnect();
      setDriveConnected(false);
      setDriveBackups([]);
      toast.success('Google Drive bağlantısı kesildi');
    } catch (error) {
      toast.error('Bağlantı kesilemedi');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDriveUpload = async () => {
    setDriveLoading(true);
    try {
      const result = await window.electronAPI.gdrive.uploadBackup();
      if (result.success) {
        toast.success("Yedek Google Drive'a yüklendi");
        loadDriveBackups();
        loadBackupInfo();
      } else {
        toast.error(result.error || 'Yükleme başarısız');
      }
    } catch (error) {
      toast.error('Yükleme hatası');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDriveDownload = async (file: DriveBackupFile) => {
    setDriveLoading(true);
    try {
      const result = await window.electronAPI.gdrive.downloadBackup(file.id, file.name);
      if (result.success) {
        toast.success('Yedek indirildi');
        loadBackupInfo();
      } else {
        toast.error(result.error || 'İndirme başarısız');
      }
    } catch (error) {
      toast.error('İndirme hatası');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleBackup = async () => {
    setLoading(true);
    try {
      await window.electronAPI.backup.create();
      toast.success('Yedek başarıyla oluşturuldu');
      loadBackupInfo();
    } catch (error) {
      toast.error('Yedek oluşturulamadı');
      console.error('Backup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!backupInfo?.path) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.backup.restore(backupInfo.path);
      if (result.success) {
        toast.success('Yedek başarıyla geri yüklendi. Sayfa yenilenecek...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error('Geri yükleme başarısız: ' + result.error);
      }
    } catch (error) {
      toast.error('Geri yükleme sırasında hata oluştu');
      console.error('Restore error:', error);
    } finally {
      setLoading(false);
      setRestoreConfirm(false);
    }
  };

  const handleOpenFolder = async () => {
    await window.electronAPI.backup.openFolder();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatBackupDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newCategory.name.trim()) return;

    try {
      await window.electronAPI.category.create(newCategory);
      setNewCategory({ name: '', type: '' as CategoryType, color: '#ef4444' });
      loadCategories();
    } catch (error) {
      console.error('Category create error:', error);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await window.electronAPI.category.delete(id);
      loadCategories();
    } catch (error) {
      console.error('Category delete error:', error);
    }
  };

  const groupedCategories = CATEGORY_TYPES.reduce((acc: Record<string, Category[]>, type) => {
    // Varsayılan kategoriler en başta, sonra diğerleri alfabetik
    acc[type.value] = categories
      .filter((c) => c.type === type.value)
      .sort((a, b) => {
        // Varsayılan olanlar en başa
        if (a.is_default === 1 && b.is_default !== 1) return -1;
        if (a.is_default !== 1 && b.is_default === 1) return 1;
        // Sonra alfabetik sıra
        return a.name.localeCompare(b.name, 'tr');
      });
    return acc;
  }, {});

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Ayarlar</h1>
          <p className="mt-1 text-sm text-gray-500">Uygulama ayarlarI ve yedekleme</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Backup Section */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-semibold">Yerel Yedekleme</h3>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={FiFolder} onClick={handleOpenFolder}>
                Klasörü Aç
              </Button>
              <Button size="sm" icon={FiDatabase} onClick={handleBackup} loading={loading}>
                Yedek Oluştur
              </Button>
            </div>
          </CardHeader>
          <CardBody className="h-[160px]">
            <p className="mb-4 text-sm text-gray-600">
              Veritabanının yedeğini alarak verilerinizi güvence altına alın. Uygulama kapatılırken
              otomatik yedek alınır.
            </p>
            {backupInfo === null ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
            ) : !backupInfo.exists ? (
              <div className="py-6 text-center text-gray-500 rounded-lg bg-gray-50">
                <FiDatabase size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Henüz yedek yok</p>
                <p className="mt-1 text-xs text-gray-400">İlk yedeğinizi oluşturun</p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <FiCheck size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Son Yedek</p>
                      <p className="text-xs text-gray-500">
                        {formatBackupDate(backupInfo.date!)} • {formatFileSize(backupInfo.size!)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={FiRefreshCw}
                    onClick={() => setRestoreConfirm(true)}
                  >
                    Geri Yükle
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Google Drive Cloud Backup */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiCloud className={driveConnected ? 'text-green-500' : 'text-gray-400'} />
              <h3 className="font-semibold">Google Drive Yedekleme</h3>
              {driveConnected && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                  <FiCheck size={12} />
                  Bağlı
                </span>
              )}
            </div>
            {!initialLoading && (
              <div className="flex gap-2">
                {driveHasCredentials === false && (
                  <Button
                    size="sm"
                    icon={FiSettings}
                    onClick={() => setShowCredentialsForm(!showCredentialsForm)}
                  >
                    Yapılandır
                  </Button>
                )}
                {driveHasCredentials && !driveConnected && (
                  <Button size="sm" icon={FiLink} onClick={handleDriveConnect} loading={driveLoading}>
                    Google ile Bağlan
                  </Button>
                )}
                {driveConnected && (
                  <>
                    <Button
                      size="sm"
                      icon={FiUploadCloud}
                      onClick={handleDriveUpload}
                      loading={driveLoading}
                    >
                      Yükle
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={FiCloudOff}
                      onClick={handleDriveDisconnect}
                    >
                      Bağlantıyı Kes
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardHeader>
          <CardBody className="p-0 h-[160px]">
            {/* Loading State */}
            {initialLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
            )}

            {/* Credentials Form */}
            {!initialLoading && showCredentialsForm && (
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <p className="mb-3 text-xs text-gray-500">
                  Google Cloud Console'dan OAuth 2.0 credentials oluşturun. Redirect URI:{' '}
                  <code className="px-1 py-0.5 bg-gray-200 rounded">
                    http://localhost:8089/oauth2callback
                  </code>
                </p>
                <div className="space-y-3">
                  <Input
                    label="Client ID"
                    value={credentials.clientId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCredentials({ ...credentials, clientId: e.target.value })
                    }
                    placeholder="xxxx.apps.googleusercontent.com"
                  />
                  <Input
                    label="Client Secret"
                    type="password"
                    value={credentials.clientSecret}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCredentials({ ...credentials, clientSecret: e.target.value })
                    }
                    placeholder="GOCSPX-..."
                  />
                  <Button size="sm" onClick={handleSaveCredentials} loading={driveLoading}>
                    Kaydet
                  </Button>
                </div>
              </div>
            )}

            {/* Not Configured */}
            {!initialLoading && driveHasCredentials === false && !showCredentialsForm && (
              <div className="py-8 text-center text-gray-500">
                <FiCloud size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Google Drive yapılandırılmamış</p>
                <p className="mt-1 text-xs text-gray-400">
                  Yapılandır butonuna tıklayarak başlayın
                </p>
              </div>
            )}

            {/* Not Connected */}
            {!initialLoading && driveHasCredentials && !driveConnected && !showCredentialsForm && (
              <div className="py-8 text-center text-gray-500">
                <FiCloud size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Google Drive'a bağlı değil</p>
                <p className="mt-1 text-xs text-gray-400">
                  Yedeklerinizi bulutta saklamak için bağlanın
                </p>
              </div>
            )}

            {/* Drive Backup Info */}
            {!initialLoading && driveConnected && (
              <div className="p-3">
                {driveBackupsLoading || driveBackups === null ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                  </div>
                ) : driveBackups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                    <FiCloud size={24} className="mb-1 opacity-50" />
                    <p className="text-sm">Henüz bulut yedeği yok</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FiCloud size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Bulut Yedeği</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(parseInt(driveBackups[0].size))} •{' '}
                          {formatBackupDate(driveBackups[0].modifiedTime)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={FiDownload}
                      onClick={() => handleDriveDownload(driveBackups[0])}
                      loading={driveLoading}
                    >
                      İndir
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Add Category */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Yeni Kategori Ekle</h3>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <Input
                label="Kategori Adı *"
                value={newCategory.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewCategory({ ...newCategory, name: e.target.value })
                }
                placeholder="Örn: Yeni Kategori"
                required
              />
              <Select
                label="Kategori Türü *"
                options={CATEGORY_TYPES}
                value={newCategory.type}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setNewCategory({ ...newCategory, type: e.target.value as CategoryType })
                }
                required
              />
              <div>
                <label className="label">Renk</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategory({ ...newCategory, color })}
                      className={`w-8 h-8 rounded-lg transition-transform ${
                        newCategory.color === color
                          ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <Button type="submit" icon={FiPlus}>
                Ekle
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* Categories List */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Mevcut Kategoriler</h3>
          </CardHeader>
          <CardBody className="p-0">
            <div className="max-h-[400px] overflow-y-auto">
              {CATEGORY_TYPES.map((type) => (
                <div key={type.value}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                    {type.label}
                  </div>
                  {groupedCategories[type.value]?.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-gray-400">Kategori yok</div>
                  ) : (
                    groupedCategories[type.value]?.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between px-4 py-2 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-sm">{category.name}</span>
                          {category.is_default === 1 && (
                            <span className="text-xs text-gray-400">(varsayılan)</span>
                          )}
                        </div>
                        {category.is_default !== 1 && (
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="p-1 text-gray-400 transition-colors hover:text-red-500"
                          >
                            <FiX size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* App Info - Full width at bottom */}
        <div className="lg:col-span-2">
          <Card>
            <CardBody className="py-3">
              <div className="flex flex-wrap items-center justify-center text-sm text-gray-500 gap-x-8 gap-y-2">
                <span>
                  <strong className="text-gray-700">İnşaat ERP</strong> v{appVersion || '...'}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Restore Confirmation */}
      <ConfirmDialog
        isOpen={restoreConfirm}
        onClose={() => setRestoreConfirm(false)}
        onConfirm={handleRestore}
        title="Yedeği Geri Yükle"
        message={`"${backupInfo?.date ? formatBackupDate(backupInfo.date) : ''}" tarihli yedeği geri yüklemek istediğinize emin misiniz? Mevcut veriler bu yedekle değiştirilecek.`}
        type="warning"
        confirmText="Geri Yükle"
      />
    </div>
  );
}

export default Settings;

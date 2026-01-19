import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  IpcMainInvokeEvent,
  dialog,
  shell,
  session,
} from 'electron';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import ERPDatabase, { TransactionFilters, StockMovementFilters } from '../database/database';
import { googleDriveService } from './googleDrive';
import { validateBackupPath, exchangeRateLimiter } from '../utils/security';
import { initAutoUpdater, checkForUpdates } from './autoUpdater';
import { mainLogger } from './logger';
import { rateLimiter } from './rateLimiter';
import {
  companySchema,
  projectSchema,
  projectPartySchema,
  transactionSchema,
  transactionFiltersSchema,
  materialSchema,
  stockMovementSchema,
  stockMovementFiltersSchema,
  categorySchema,
  gdriveCredentialsSchema,
  exportToExcelSchema,
  exportToPDFSchema,
  validateInput,
  validateId,
} from '../utils/schemas';
import { UI, API, LIMITS, TIMING, FALLBACKS } from '../utils/constants';

let mainWindow: BrowserWindow | null = null;
let db: ERPDatabase;
let isQuitting = false;
let autoBackupInterval: NodeJS.Timeout | null = null;
let lastBackupTime: Date | null = null;

const isDev = !app.isPackaged;

// Remove default menu bar (File, Edit, View, etc.)
Menu.setApplicationMenu(null);

// İnternet bağlantısı kontrolü
async function checkInternetConnection(): Promise<boolean> {
  try {
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Otomatik yedekleme ve cloud sync fonksiyonu
async function autoBackupAndSync(): Promise<void> {
  const backupDir = path.join(app.getPath('userData'), 'backups');

  // Local yedek al
  db.createBackup(backupDir);
  lastBackupTime = new Date();
  db.clearDirty(); // Yedek alındı, dirty flag'i temizle

  // İnternet varsa cloud'a yükle
  if (googleDriveService.hasCredentials() && googleDriveService.isConnected()) {
    const hasInternet = await checkInternetConnection();
    if (hasInternet) {
      try {
        const backupPath = path.join(backupDir, 'latest_backup.db');
        await googleDriveService.uploadBackup(backupPath);
        mainLogger.info('Backup synced to cloud', 'CloudSync');
      } catch (error) {
        mainLogger.error('Cloud sync error', 'CloudSync', error);
      }
    } else {
      mainLogger.info('No internet connection, backup saved locally only', 'CloudSync');
    }
  }
}

// Yedeklenmemiş değişiklik var mı kontrol et
function hasUnbackedChanges(): boolean {
  return db.isDirty();
}

// Otomatik yedekleme başlat
function startAutoBackup(): void {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
  }

  autoBackupInterval = setInterval(async () => {
    // Sadece değişiklik varsa yedekle
    if (db.isDirty()) {
      mainLogger.info('Auto backup: Changes detected, backing up...', 'AutoBackup');
      await autoBackupAndSync();
    } else {
      mainLogger.debug('Auto backup: No changes, skipping', 'AutoBackup');
    }
  }, TIMING.AUTO_BACKUP_INTERVAL);

  mainLogger.info(`Auto backup started (interval: ${TIMING.AUTO_BACKUP_INTERVAL / 1000}s)`, 'AutoBackup');
}

// Otomatik yedekleme durdur
function stopAutoBackup(): void {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
    mainLogger.info('Auto backup stopped', 'AutoBackup');
  }
}

// Uygulama başlangıcında sync kontrolü
async function startupSync(): Promise<void> {
  if (!googleDriveService.hasCredentials() || !googleDriveService.isConnected()) {
    return;
  }

  const hasInternet = await checkInternetConnection();
  if (!hasInternet) {
    mainLogger.info('Startup sync: No internet connection', 'CloudSync');
    return;
  }

  const backupDir = path.join(app.getPath('userData'), 'backups');
  const localBackupPath = path.join(backupDir, 'latest_backup.db');

  // Check if local backup exists
  if (!fs.existsSync(localBackupPath)) {
    mainLogger.info('Startup sync: No local backup found', 'CloudSync');
    return;
  }

  try {
    const cloudBackup = await googleDriveService.getLatestBackup();
    const localStats = fs.statSync(localBackupPath);
    const localDate = localStats.mtime;

    if (cloudBackup) {
      const cloudDate = new Date(cloudBackup.modifiedTime);

      // Upload to cloud if local is newer
      if (localDate > cloudDate) {
        mainLogger.info('Startup sync: Local backup is newer, uploading to cloud...', 'CloudSync');
        await googleDriveService.uploadBackup(localBackupPath);
      } else {
        mainLogger.info('Startup sync: Cloud backup is up to date', 'CloudSync');
      }
    } else {
      // No cloud backup exists, upload local
      mainLogger.info('Startup sync: No cloud backup found, uploading...', 'CloudSync');
      await googleDriveService.uploadBackup(localBackupPath);
    }
  } catch (error) {
    mainLogger.error('Startup sync error', 'CloudSync', error);
  }
}

function createWindow(): void {
  // Icon path - Windows için .ico, diğerleri için .png
  let iconPath: string;
  if (isDev) {
    iconPath = path.join(__dirname, '../../public/icon.ico');
  } else {
    // Production'da resources klasöründen veya build klasöründen al
    iconPath = path.join(process.resourcesPath, 'icon.ico');
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, '../build/icon.ico');
    }
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, '../../build/icon.ico');
    }
  }
  mainLogger.debug(`Icon path: ${iconPath}, Exists: ${fs.existsSync(iconPath)}`, 'Window');

  // Ekran boyutlarını al
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    minWidth: UI.MIN_WINDOW_WIDTH,
    minHeight: UI.MIN_WINDOW_HEIGHT,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: iconPath,
    show: false,
    backgroundColor: '#0f172a',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();

    // Initialize auto-updater (only in production)
    if (!isDev) {
      initAutoUpdater(mainWindow!);
      // Check for updates after a short delay
      setTimeout(() => checkForUpdates(), 5000);
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html'));
  }

  // Kapatma onayı - sadece yedeklenmemiş değişiklik varsa sor
  mainWindow.on('close', async (e) => {
    if (isQuitting) return;

    // Otomatik yedeklemeyi durdur
    stopAutoBackup();

    // Yedeklenmemiş değişiklik yoksa direkt kapat
    if (!hasUnbackedChanges()) {
      mainLogger.info('Closing: No unbacked changes', 'Main');
      isQuitting = true;
      return;
    }

    e.preventDefault();

    const result = await dialog.showMessageBox(mainWindow!, {
      type: 'question',
      buttons: ['Yedekle ve Kapat', 'Yedeklemeden Kapat', 'İptal'],
      defaultId: 0,
      cancelId: 2,
      title: 'Yedeklenmemiş Değişiklikler',
      message: 'Son yedeklemeden bu yana değişiklikler var.',
      detail: 'Kapatmadan önce yedek almak ister misiniz?',
    });

    if (result.response === 0) {
      // Yedekle ve Kapat
      mainLogger.info('Closing: Backing up before close', 'Main');
      await autoBackupAndSync();
      isQuitting = true;
      mainWindow?.close();
    } else if (result.response === 1) {
      // Yedeklemeden Kapat
      mainLogger.info('Closing: User chose not to backup', 'Main');
      isQuitting = true;
      mainWindow?.close();
    } else {
      // İptal - otomatik yedeklemeyi yeniden başlat
      startAutoBackup();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize logger
  mainLogger.init();
  mainLogger.info('Application starting...', 'Main');

  // Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws://localhost:* http://localhost:*; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
            : "default-src 'self'; script-src 'self'; connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com https://api.exchangerate-api.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;",
        ],
      },
    });
  });

  // Disable navigation to external URLs
  app.on('web-contents-created', (_, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.origin !== 'file://' && !navigationUrl.startsWith('http://localhost')) {
        event.preventDefault();
        mainLogger.warn(`Blocked navigation to: ${navigationUrl}`, 'Security');
      }
    });

    // Block new window creation
    contents.setWindowOpenHandler(({ url }) => {
      // Allow opening external links in system browser
      if (url.startsWith('https://') || url.startsWith('http://')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });
  });

  db = new ERPDatabase();
  await db.init(app.getPath('userData'));
  googleDriveService.init(app.getPath('userData'));
  createWindow();

  mainLogger.info('Application initialized', 'Main');

  // Otomatik yedeklemeyi başlat (5 dakikada bir)
  startAutoBackup();

  // Arka planda başlangıç sync kontrolü yap
  startupSync().catch((err) => mainLogger.error('Startup sync error:', err));
});

app.on('window-all-closed', () => {
  stopAutoBackup();
  if (db) db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ==================== IPC HANDLERS ====================

// Company handlers
ipcMain.handle('company:getAll', () => db.getAllCompanies());
ipcMain.handle('company:getWithBalance', () => db.getCompaniesWithBalance());
ipcMain.handle('company:getById', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.getCompanyById(validation.data!);
});
ipcMain.handle('company:create', (_: IpcMainInvokeEvent, data: unknown) => {
  const validation = validateInput(companySchema, data);
  if (!validation.success) throw new Error(validation.error);
  return db.createCompany(validation.data!);
});
ipcMain.handle('company:update', (_: IpcMainInvokeEvent, id: unknown, data: unknown) => {
  const idValidation = validateId(id);
  if (!idValidation.success) throw new Error(idValidation.error);
  const dataValidation = validateInput(companySchema, data);
  if (!dataValidation.success) throw new Error(dataValidation.error);
  return db.updateCompany(idValidation.data!, dataValidation.data!);
});
ipcMain.handle('company:delete', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.deleteCompany(validation.data!);
});

// Project handlers
ipcMain.handle('project:getAll', () => db.getAllProjects());
ipcMain.handle('project:getWithSummary', () => db.getProjectsWithSummary());
ipcMain.handle('project:getById', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.getProjectById(validation.data!);
});
ipcMain.handle('project:create', (_: IpcMainInvokeEvent, data: unknown) => {
  const validation = validateInput(projectSchema, data);
  if (!validation.success) throw new Error(validation.error);
  return db.createProject(validation.data!);
});
ipcMain.handle('project:update', (_: IpcMainInvokeEvent, id: unknown, data: unknown) => {
  const idValidation = validateId(id);
  if (!idValidation.success) throw new Error(idValidation.error);
  const dataValidation = validateInput(projectSchema, data);
  if (!dataValidation.success) throw new Error(dataValidation.error);
  return db.updateProject(idValidation.data!, dataValidation.data!);
});
ipcMain.handle('project:delete', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.deleteProject(validation.data!);
});
ipcMain.handle('project:generateCode', () => db.generateProjectCode());
ipcMain.handle('project:getParties', (_: IpcMainInvokeEvent, projectId: unknown) => {
  const validation = validateId(projectId);
  if (!validation.success) throw new Error(validation.error);
  return db.getProjectParties(validation.data!);
});
ipcMain.handle('project:addParty', (_: IpcMainInvokeEvent, data: unknown) => {
  const validation = validateInput(projectPartySchema, data);
  if (!validation.success) throw new Error(validation.error);
  return db.addProjectParty(validation.data!);
});
ipcMain.handle('project:removeParty', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.removeProjectParty(validation.data!);
});

// Transaction handlers
ipcMain.handle('transaction:getAll', (_: IpcMainInvokeEvent, filters: unknown = {}) => {
  const validation = validateInput(transactionFiltersSchema, filters || {});
  if (!validation.success) throw new Error(validation.error);
  return db.getAllTransactions(validation.data! as TransactionFilters);
});
ipcMain.handle(
  'transaction:getByCompany',
  (_: IpcMainInvokeEvent, companyId: unknown, filters: unknown = {}) => {
    const idValidation = validateId(companyId);
    if (!idValidation.success) throw new Error(idValidation.error);
    const filtersValidation = validateInput(transactionFiltersSchema, filters || {});
    if (!filtersValidation.success) throw new Error(filtersValidation.error);
    return db.getTransactionsByCompany(
      idValidation.data!,
      filtersValidation.data! as TransactionFilters
    );
  }
);
ipcMain.handle(
  'transaction:getByProject',
  (_: IpcMainInvokeEvent, projectId: unknown, filters: unknown = {}) => {
    const idValidation = validateId(projectId);
    if (!idValidation.success) throw new Error(idValidation.error);
    const filtersValidation = validateInput(transactionFiltersSchema, filters || {});
    if (!filtersValidation.success) throw new Error(filtersValidation.error);
    return db.getTransactionsByProject(
      idValidation.data!,
      filtersValidation.data! as TransactionFilters
    );
  }
);
ipcMain.handle('transaction:create', (_: IpcMainInvokeEvent, data: unknown) => {
  const validation = validateInput(transactionSchema, data);
  if (!validation.success) throw new Error(validation.error);
  return db.createTransaction(validation.data!);
});
ipcMain.handle('transaction:update', (_: IpcMainInvokeEvent, id: unknown, data: unknown) => {
  const idValidation = validateId(id);
  if (!idValidation.success) throw new Error(idValidation.error);
  const dataValidation = validateInput(transactionSchema, data);
  if (!dataValidation.success) throw new Error(dataValidation.error);
  return db.updateTransaction(idValidation.data!, dataValidation.data!);
});
ipcMain.handle('transaction:delete', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.deleteTransaction(validation.data!);
});

// Material handlers
ipcMain.handle('material:getAll', () => db.getAllMaterials());
ipcMain.handle('material:getById', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.getMaterialById(validation.data!);
});
ipcMain.handle('material:create', (_: IpcMainInvokeEvent, data: unknown) => {
  const validation = validateInput(materialSchema, data);
  if (!validation.success) throw new Error(validation.error);
  return db.createMaterial(validation.data!);
});
ipcMain.handle('material:update', (_: IpcMainInvokeEvent, id: unknown, data: unknown) => {
  const idValidation = validateId(id);
  if (!idValidation.success) throw new Error(idValidation.error);
  const dataValidation = validateInput(materialSchema, data);
  if (!dataValidation.success) throw new Error(dataValidation.error);
  return db.updateMaterial(idValidation.data!, dataValidation.data!);
});
ipcMain.handle('material:delete', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.deleteMaterial(validation.data!);
});
ipcMain.handle('material:generateCode', () => db.generateMaterialCode());
ipcMain.handle('material:getLowStock', () => db.getLowStockMaterials());

// Stock movement handlers
ipcMain.handle('stock:getAll', (_: IpcMainInvokeEvent, filters: unknown = {}) => {
  const validation = validateInput(stockMovementFiltersSchema, filters || {});
  if (!validation.success) throw new Error(validation.error);
  return db.getAllStockMovements(validation.data! as StockMovementFilters);
});
ipcMain.handle('stock:create', (_: IpcMainInvokeEvent, data: unknown) => {
  const validation = validateInput(stockMovementSchema, data);
  if (!validation.success) throw new Error(validation.error);
  return db.createStockMovement(validation.data!);
});
ipcMain.handle('stock:delete', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.deleteStockMovement(validation.data!);
});

// Category handlers
ipcMain.handle('category:getAll', (_: IpcMainInvokeEvent, type?: string) =>
  db.getAllCategories(type || null)
);
ipcMain.handle('category:create', (_: IpcMainInvokeEvent, data: unknown) => {
  const validation = validateInput(categorySchema, data);
  if (!validation.success) throw new Error(validation.error);
  return db.createCategory(validation.data!);
});
ipcMain.handle('category:delete', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.deleteCategory(validation.data!);
});

// Trash handlers
ipcMain.handle('trash:getAll', () => db.getTrashItems());
ipcMain.handle('trash:restore', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.restoreFromTrash(validation.data!);
});
ipcMain.handle('trash:permanentDelete', (_: IpcMainInvokeEvent, id: unknown) => {
  const validation = validateId(id);
  if (!validation.success) throw new Error(validation.error);
  return db.permanentDeleteFromTrash(validation.data!);
});
ipcMain.handle('trash:empty', () => db.emptyTrash());

// Dashboard handlers
ipcMain.handle('dashboard:getStats', () => db.getDashboardStats());
ipcMain.handle('dashboard:getRecentTransactions', (_: IpcMainInvokeEvent, limit: unknown) => {
  const validation = validateId(limit);
  if (!validation.success) return db.getRecentTransactions(10);
  return db.getRecentTransactions(validation.data!);
});
ipcMain.handle('dashboard:getTopDebtors', (_: IpcMainInvokeEvent, limit: unknown) => {
  const validation = validateId(limit);
  if (!validation.success) return db.getTopDebtors(5);
  return db.getTopDebtors(validation.data!);
});
ipcMain.handle('dashboard:getTopCreditors', (_: IpcMainInvokeEvent, limit: unknown) => {
  const validation = validateId(limit);
  if (!validation.success) return db.getTopCreditors(5);
  return db.getTopCreditors(validation.data!);
});

// Analytics handlers
ipcMain.handle('analytics:getMonthlyStats', (_: IpcMainInvokeEvent, year: unknown) => {
  const validation = validateId(year);
  if (!validation.success) return db.getMonthlyStats(new Date().getFullYear());
  return db.getMonthlyStats(validation.data!);
});
ipcMain.handle(
  'analytics:getProjectCategoryBreakdown',
  (_: IpcMainInvokeEvent, projectId: unknown) => {
    const validation = validateId(projectId);
    if (!validation.success) throw new Error(validation.error);
    return db.getProjectCategoryBreakdown(validation.data!);
  }
);
ipcMain.handle(
  'analytics:getCompanyMonthlyStats',
  (_: IpcMainInvokeEvent, companyId: unknown, year: unknown) => {
    const companyValidation = validateId(companyId);
    if (!companyValidation.success) throw new Error(companyValidation.error);
    const yearValidation = validateId(year);
    if (!yearValidation.success)
      return db.getCompanyMonthlyStats(companyValidation.data!, new Date().getFullYear());
    return db.getCompanyMonthlyStats(companyValidation.data!, yearValidation.data!);
  }
);

// Backup handlers
ipcMain.handle('backup:create', async () => {
  const backupDir = path.join(app.getPath('userData'), 'backups');
  mainLogger.info(`Creating backup in: ${backupDir}`, 'Backup');

  try {
    const backupPath = db.createBackup(backupDir);
    mainLogger.info(`Local backup created: ${backupPath}`, 'Backup');

    // Cloud sync if connected
    if (googleDriveService.hasCredentials() && googleDriveService.isConnected()) {
      const hasInternet = await checkInternetConnection();
      if (hasInternet) {
        try {
          await googleDriveService.uploadBackup(backupPath);
          mainLogger.info('Backup synced to Google Drive', 'Backup');
        } catch (cloudError) {
          mainLogger.error('Cloud sync failed', 'Backup', cloudError);
        }
      } else {
        mainLogger.info('No internet - local backup only', 'Backup');
      }
    } else {
      mainLogger.info('Google Drive not connected - local backup only', 'Backup');
    }

    return backupPath;
  } catch (error) {
    mainLogger.error('Backup creation failed', 'Backup', error);
    throw error;
  }
});

ipcMain.handle('backup:list', () => {
  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) {
    return [];
  }
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith('.db'))
    .map((name) => {
      const filePath = path.join(backupDir, name);
      const stats = fs.statSync(filePath);
      return {
        name,
        path: filePath,
        size: stats.size,
        date: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return files;
});

ipcMain.handle('backup:restore', async (_: IpcMainInvokeEvent, backupPath: string) => {
  try {
    // Validate backup path to prevent directory traversal attacks
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!validateBackupPath(backupDir, backupPath)) {
      return { success: false, error: 'Geçersiz yedek dosyası yolu' };
    }

    // Verify file exists and is a valid SQLite database
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Yedek dosyası bulunamadı' };
    }

    // Close current database connection
    db.close();

    // Copy backup file to database location (must match database.ts path: data/insaat-erp.db)
    const dbDir = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'insaat-erp.db');
    fs.copyFileSync(backupPath, dbPath);

    // Reinitialize database
    db = new ERPDatabase();
    await db.init(app.getPath('userData'));

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('backup:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Yedek Klasörü Seç',
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('backup:openFolder', async () => {
  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  shell.openPath(backupDir);
});

// Export handlers - optimized for large datasets

ipcMain.handle(
  'export:toExcel',
  async (_: IpcMainInvokeEvent, data: { type: string; records: unknown[]; filename?: string }) => {
    const { type, records, filename } = data;
    const defaultFilename = filename || `${type}_${new Date().toISOString().split('T')[0]}.xlsx`;

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Excel Olarak Kaydet',
      defaultPath: defaultFilename,
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return '';
    }

    // Convert records to Excel
    if (records.length === 0) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['Veri bulunamadı']]);
      XLSX.utils.book_append_sheet(wb, ws, 'Veri');
      XLSX.writeFile(wb, result.filePath);
      return result.filePath;
    }

    // Create workbook
    const wb = XLSX.utils.book_new();

    // For large datasets, process in batches
    if (records.length > API.EXPORT_BATCH_SIZE) {
      // Get headers
      const headers = Object.keys(records[0] as object);

      // Initialize worksheet with headers
      const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([headers]);

      // Process records in batches to avoid memory issues
      for (let i = 0; i < records.length; i += API.EXPORT_BATCH_SIZE) {
        const batch = records.slice(i, Math.min(i + API.EXPORT_BATCH_SIZE, records.length));
        const batchData = batch.map((record) =>
          headers.map((header) => {
            const val = (record as Record<string, unknown>)[header];
            return val === null || val === undefined ? '' : val;
          })
        );

        // Append batch to worksheet starting from current row
        XLSX.utils.sheet_add_aoa(ws, batchData, { origin: i + 1 });

        // Notify progress for large exports
        if (mainWindow && records.length > API.LARGE_EXPORT_THRESHOLD) {
          const progress = Math.round(((i + batch.length) / records.length) * 100);
          mainWindow.webContents.send('export:progress', { progress, total: records.length });
        }
      }

      // Calculate column widths from sample (first 100 rows for performance)
      const sampleSize = Math.min(100, records.length);
      const colWidths = headers.map((header, idx) => {
        let maxWidth = header.length;
        for (let i = 0; i < sampleSize; i++) {
          const val = (records[i] as Record<string, unknown>)[header];
          if (val !== null && val !== undefined) {
            const len = String(val).length;
            if (len > maxWidth) maxWidth = len;
          }
        }
        return {
          wch: Math.min(
            Math.max(maxWidth + 2, LIMITS.MIN_EXCEL_COLUMN_WIDTH),
            LIMITS.MAX_EXCEL_COLUMN_WIDTH
          ),
        };
      });
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Veri');
    } else {
      // Standard processing for smaller datasets
      const ws = XLSX.utils.json_to_sheet(records as object[]);

      // Set column widths for better readability
      const headers = Object.keys(records[0] as object);
      const colWidths = headers.map((header) => {
        let maxWidth = header.length;
        records.forEach((record) => {
          const val = (record as Record<string, unknown>)[header];
          if (val !== null && val !== undefined) {
            const len = String(val).length;
            if (len > maxWidth) maxWidth = len;
          }
        });
        return {
          wch: Math.min(
            Math.max(maxWidth + 2, LIMITS.MIN_EXCEL_COLUMN_WIDTH),
            LIMITS.MAX_EXCEL_COLUMN_WIDTH
          ),
        };
      });
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Veri');
    }

    // Write file with compression for large files
    const writeOptions: XLSX.WritingOptions = {
      compression: records.length > API.EXPORT_BATCH_SIZE, // Enable compression for large files
    };

    XLSX.writeFile(wb, result.filePath, writeOptions);
    return result.filePath;
  }
);

ipcMain.handle(
  'export:toPDF',
  async (_: IpcMainInvokeEvent, data: { type: string; html: string; filename?: string }) => {
    const { type, filename } = data;
    const defaultFilename = filename || `${type}_${new Date().toISOString().split('T')[0]}.pdf`;

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'PDF Olarak Kaydet',
      defaultPath: defaultFilename,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return '';
    }

    // Use electron's printToPDF
    const pdfData = await mainWindow!.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: 'A4',
      margins: {
        top: 1,
        bottom: 1,
        left: 1,
        right: 1,
      },
    });

    fs.writeFileSync(result.filePath, pdfData);
    return result.filePath;
  }
);

// Exchange rate handler with rate limiting
let cachedRates: { USD: number; EUR: number; timestamp: number } | null = null;

ipcMain.handle('exchange:getRates', async () => {
  // Return cached rates if still valid
  if (cachedRates && Date.now() - cachedRates.timestamp < TIMING.EXCHANGE_RATE_CACHE) {
    return { USD: cachedRates.USD, EUR: cachedRates.EUR };
  }

  // Check rate limit
  if (!exchangeRateLimiter.canMakeRequest()) {
    mainLogger.warn('Exchange rate API rate limit exceeded', 'ExchangeRate');
    // Return cached rates if available, otherwise fallback
    if (cachedRates) {
      return { USD: cachedRates.USD, EUR: cachedRates.EUR };
    }
    return { USD: FALLBACKS.USD_RATE, EUR: FALLBACKS.EUR_RATE };
  }

  try {
    const response = await fetch(API.EXCHANGE_RATE_URL);
    const data = (await response.json()) as { rates: { TRY: number; EUR: number } };
    const rates = {
      USD: data.rates.TRY,
      EUR: data.rates.TRY / data.rates.EUR,
    };

    // Cache the rates
    cachedRates = { ...rates, timestamp: Date.now() };

    return rates;
  } catch (error) {
    mainLogger.error('Exchange rate fetch error', 'ExchangeRate', error);
    // Return cached rates if available
    if (cachedRates) {
      return { USD: cachedRates.USD, EUR: cachedRates.EUR };
    }
    return { USD: FALLBACKS.USD_RATE, EUR: FALLBACKS.EUR_RATE };
  }
});

// Google Drive handlers
ipcMain.handle('gdrive:hasCredentials', () => googleDriveService.hasCredentials());
ipcMain.handle('gdrive:isConnected', () => googleDriveService.isConnected());

ipcMain.handle(
  'gdrive:saveCredentials',
  (_: IpcMainInvokeEvent, clientId: unknown, clientSecret: unknown) => {
    const validation = validateInput(gdriveCredentialsSchema, { clientId, clientSecret });
    if (!validation.success) throw new Error(validation.error);
    googleDriveService.saveCredentials(validation.data!.clientId, validation.data!.clientSecret);
    return { success: true };
  }
);

ipcMain.handle('gdrive:connect', async () => {
  return googleDriveService.startAuth();
});

ipcMain.handle('gdrive:disconnect', async () => {
  await googleDriveService.disconnect();
  return { success: true };
});

ipcMain.handle('gdrive:listBackups', async () => {
  return googleDriveService.listBackups();
});

ipcMain.handle('gdrive:uploadBackup', async () => {
  // First create a local backup, then upload
  const backupDir = path.join(app.getPath('userData'), 'backups');
  const backupPath = await db.createBackup(backupDir);
  return googleDriveService.uploadBackup(backupPath);
});

ipcMain.handle(
  'gdrive:downloadBackup',
  async (_: IpcMainInvokeEvent, fileId: unknown, fileName: unknown) => {
    if (typeof fileId !== 'string' || !fileId) throw new Error('Geçersiz dosya ID');
    if (typeof fileName !== 'string' || !fileName) throw new Error('Geçersiz dosya adı');
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const destPath = path.join(backupDir, fileName);
    return googleDriveService.downloadBackup(fileId, destPath);
  }
);

ipcMain.handle('gdrive:deleteBackup', async (_: IpcMainInvokeEvent, fileId: unknown) => {
  if (typeof fileId !== 'string' || !fileId) throw new Error('Geçersiz dosya ID');
  return googleDriveService.deleteBackup(fileId);
});

// App info
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// Database health check
ipcMain.handle('db:checkIntegrity', () => db.checkIntegrity());
ipcMain.handle('db:checkForeignKeys', () => db.checkForeignKeys());
ipcMain.handle('db:getStats', () => db.getStats());

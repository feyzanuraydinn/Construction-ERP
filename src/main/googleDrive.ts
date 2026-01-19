import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { shell, app, safeStorage } from 'electron';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// OAuth credentials - build sırasında veya config dosyasından yüklenir
let CLIENT_ID = '';
let CLIENT_SECRET = '';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const REDIRECT_PORT = 8089;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

interface DriveFile {
  id: string;
  name: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
}

class GoogleDriveService {
  private oauth2Client: OAuth2Client | null = null;
  private tokenPath: string = '';
  private configPath: string = '';

  init(userDataPath: string): void {
    this.tokenPath = path.join(userDataPath, 'google-drive-token.json');
    this.configPath = path.join(userDataPath, 'google-drive-credentials.json');
    this.loadCredentials();
    if (CLIENT_ID && CLIENT_SECRET) {
      this.initOAuth2Client();
    }
  }

  private loadCredentials(): void {
    // Önce uygulama dizinindeki credentials dosyasını kontrol et
    try {
      if (fs.existsSync(this.configPath)) {
        const fileData = fs.readFileSync(this.configPath, 'utf-8');
        const data = JSON.parse(fileData);

        // Check if credentials are encrypted (v2 format)
        if (data.encrypted && data.clientId && data.clientSecret) {
          // Decrypt using Electron's safeStorage
          if (safeStorage.isEncryptionAvailable()) {
            try {
              CLIENT_ID = safeStorage.decryptString(Buffer.from(data.clientId, 'base64'));
              CLIENT_SECRET = safeStorage.decryptString(Buffer.from(data.clientSecret, 'base64'));
            } catch {
              console.error('Failed to decrypt credentials, they may be corrupted');
              CLIENT_ID = '';
              CLIENT_SECRET = '';
            }
          } else {
            console.warn('safeStorage not available, cannot decrypt credentials');
          }
        } else {
          // Legacy unencrypted format - migrate to encrypted
          CLIENT_ID = data.clientId || '';
          CLIENT_SECRET = data.clientSecret || '';
          // Re-save with encryption if we have valid credentials
          if (CLIENT_ID && CLIENT_SECRET) {
            this.saveCredentials(CLIENT_ID, CLIENT_SECRET);
          }
        }
      }
    } catch (error) {
      console.error('Credentials load error:', error);
    }
  }

  saveCredentials(clientId: string, clientSecret: string): void {
    CLIENT_ID = clientId;
    CLIENT_SECRET = clientSecret;

    // Encrypt credentials using Electron's safeStorage (uses OS keychain/credential manager)
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedClientId = safeStorage.encryptString(clientId).toString('base64');
      const encryptedClientSecret = safeStorage.encryptString(clientSecret).toString('base64');
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(
          {
            encrypted: true,
            clientId: encryptedClientId,
            clientSecret: encryptedClientSecret,
            version: 2,
          },
          null,
          2
        )
      );
    } else {
      // Fallback to unencrypted if safeStorage not available (rare)
      console.warn('safeStorage not available, storing credentials unencrypted');
      fs.writeFileSync(this.configPath, JSON.stringify({ clientId, clientSecret }, null, 2));
    }

    this.initOAuth2Client();
  }

  hasCredentials(): boolean {
    return !!CLIENT_ID && !!CLIENT_SECRET;
  }

  private initOAuth2Client(): void {
    this.oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

    // Load saved token if exists
    try {
      if (fs.existsSync(this.tokenPath)) {
        const tokenData = fs.readFileSync(this.tokenPath, 'utf-8');
        const data = JSON.parse(tokenData);

        // Check if token is encrypted
        if (data.encrypted && data.token) {
          if (safeStorage.isEncryptionAvailable()) {
            try {
              const decryptedToken = safeStorage.decryptString(Buffer.from(data.token, 'base64'));
              const tokens = JSON.parse(decryptedToken);
              this.oauth2Client.setCredentials(tokens);
            } catch {
              console.error('Failed to decrypt token');
            }
          }
        } else {
          // Legacy unencrypted format
          this.oauth2Client.setCredentials(data);
          // Migrate to encrypted format
          this.saveToken(data);
        }
      }
    } catch (error) {
      console.error('Token load error:', error);
    }
  }

  private saveToken(tokens: Record<string, unknown>): void {
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedToken = safeStorage.encryptString(JSON.stringify(tokens)).toString('base64');
      fs.writeFileSync(
        this.tokenPath,
        JSON.stringify(
          {
            encrypted: true,
            token: encryptedToken,
            version: 2,
          },
          null,
          2
        )
      );
    } else {
      fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2));
    }
  }

  isConnected(): boolean {
    if (!this.oauth2Client) return false;
    const credentials = this.oauth2Client.credentials;
    return !!credentials && !!credentials.access_token;
  }

  async startAuth(): Promise<{ success: boolean; error?: string }> {
    if (!this.oauth2Client) {
      return { success: false, error: 'Google Drive yapılandırması eksik' };
    }

    return new Promise((resolve) => {
      const authUrl = this.oauth2Client!.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      });

      // Create temporary HTTP server to receive OAuth callback
      const server = http.createServer(async (req, res) => {
        if (req.url?.startsWith('/oauth2callback')) {
          const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

          // Handle OAuth error (access_denied, etc.)
          if (error) {
            const errorMsg =
              error === 'access_denied'
                ? "Erişim reddedildi. Google Cloud Console'da test kullanıcısı olarak eklendiğinizden emin olun."
                : `OAuth hatası: ${error}`;
            res.end(`
              <html>
                <head><title>Hata</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                  <h1 style="color: #ef4444;">✕ Bağlantı Reddedildi</h1>
                  <p>${errorMsg}</p>
                </body>
              </html>
            `);
            server.close();
            resolve({ success: false, error: errorMsg });
            return;
          }

          if (code) {
            try {
              const { tokens } = await this.oauth2Client!.getToken(code);
              this.oauth2Client!.setCredentials(tokens);

              // Save tokens (encrypted)
              this.saveToken(tokens as Record<string, unknown>);

              res.end(`
                <html>
                  <head><title>Bağlantı Başarılı</title></head>
                  <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1 style="color: #22c55e;">✓ Google Drive Bağlantısı Başarılı!</h1>
                    <p>Bu pencereyi kapatabilirsiniz.</p>
                    <script>setTimeout(() => window.close(), 2000);</script>
                  </body>
                </html>
              `);

              server.close();
              resolve({ success: true });
            } catch (error) {
              res.end(`
                <html>
                  <head><title>Hata</title></head>
                  <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1 style="color: #ef4444;">✕ Bağlantı Hatası</h1>
                    <p>${String(error)}</p>
                  </body>
                </html>
              `);
              server.close();
              resolve({ success: false, error: String(error) });
            }
          } else {
            res.end(`
              <html>
                <head><title>Hata</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                  <h1 style="color: #ef4444;">✕ Yetkilendirme Kodu Alınamadı</h1>
                </body>
              </html>
            `);
            server.close();
            resolve({ success: false, error: 'Authorization code not received' });
          }
        }
      });

      server.listen(REDIRECT_PORT, () => {
        // Open browser for authentication
        shell.openExternal(authUrl);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        resolve({ success: false, error: 'Zaman aşımı - Yetkilendirme tamamlanmadı' });
      }, 300000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.oauth2Client) {
      this.oauth2Client.revokeCredentials();
    }
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
    this.oauth2Client = null;
    if (CLIENT_ID && CLIENT_SECRET) {
      this.initOAuth2Client();
    }
  }

  async uploadBackup(
    filePath: string
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    if (!this.oauth2Client || !this.isConnected()) {
      return { success: false, error: 'Google Drive bağlantısı yok' };
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const fileName = 'latest_backup.db'; // Her zaman aynı isim

      // Get or create backup folder
      const folderId = await this.getOrCreateBackupFolder();

      // Önce mevcut yedekleri sil (sadece tek yedek tutuyoruz)
      if (folderId) {
        await this.deleteAllBackupsInFolder(folderId);
      }

      const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : undefined,
      };

      const media = {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(filePath),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name',
      });

      return { success: true, fileId: response.data.id || undefined };
    } catch (error) {
      console.error('Upload error:', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  private async deleteAllBackupsInFolder(folderId: string): Promise<void> {
    if (!this.oauth2Client) return;

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id)',
      });

      const files = response.data.files || [];
      for (const file of files) {
        if (file.id) {
          await drive.files.delete({ fileId: file.id });
        }
      }
    } catch (error) {
      console.error('Delete all backups error:', error);
    }
  }

  private formatError(error: unknown): string {
    const errorStr = String(error);
    if (errorStr.includes('API has not been used') || errorStr.includes('it is disabled')) {
      return "Google Drive API etkin değil. Google Cloud Console'da Drive API'yi etkinleştirin.";
    }
    if (errorStr.includes('invalid_grant')) {
      return 'Oturum süresi doldu. Lütfen tekrar bağlanın.';
    }
    if (errorStr.includes('insufficient permissions')) {
      return 'Yetersiz izin. Uygulamaya Drive erişimi verin.';
    }
    return errorStr;
  }

  private async getOrCreateBackupFolder(): Promise<string | null> {
    if (!this.oauth2Client) return null;

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const folderName = 'InsaatERP_Backups';

      // Search for existing folder
      const searchResponse = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        return searchResponse.data.files[0].id || null;
      }

      // Create new folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      const createResponse = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
      });

      return createResponse.data.id || null;
    } catch (error) {
      console.error('Folder error:', error);
      return null;
    }
  }

  async listBackups(): Promise<DriveFile[]> {
    if (!this.oauth2Client || !this.isConnected()) {
      return [];
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const folderId = await this.getOrCreateBackupFolder();

      if (!folderId) return [];

      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name, size, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 1, // Sadece tek yedek var
      });

      return (response.data.files || []).map((file) => ({
        id: file.id || '',
        name: file.name || '',
        size: file.size || '0',
        createdTime: file.createdTime || '',
        modifiedTime: file.modifiedTime || '',
      }));
    } catch (error) {
      console.error('List error:', error);
      return [];
    }
  }

  async getLatestBackup(): Promise<DriveFile | null> {
    const backups = await this.listBackups();
    return backups.length > 0 ? backups[0] : null;
  }

  async downloadBackup(
    fileId: string,
    destPath: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.oauth2Client || !this.isConnected()) {
      return { success: false, error: 'Google Drive bağlantısı yok' };
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: 'media',
        },
        { responseType: 'stream' }
      );

      const dest = fs.createWriteStream(destPath);

      return new Promise((resolve) => {
        (response.data as NodeJS.ReadableStream)
          .pipe(dest)
          .on('finish', () => resolve({ success: true }))
          .on('error', (error: Error) => resolve({ success: false, error: error.message }));
      });
    } catch (error) {
      console.error('Download error:', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  async deleteBackup(fileId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.oauth2Client || !this.isConnected()) {
      return { success: false, error: 'Google Drive bağlantısı yok' };
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      await drive.files.delete({ fileId });
      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      return { success: false, error: this.formatError(error) };
    }
  }
}

export const googleDriveService = new GoogleDriveService();
export default googleDriveService;

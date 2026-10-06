import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

export interface IStorageService {
  uploadFile(file: Express.Multer.File, folder?: string): Promise<string>;
  deleteFile(fileUrlOrKey: string): Promise<boolean>;
  getUrl(fileKey: string): string;
}

class LocalStorageService implements IStorageService {
  private baseUploadDir: string;

  constructor() {
    this.baseUploadDir = path.resolve(__dirname, '../../', config.storage.uploadDir);
    this.ensureDirectoryExists(this.baseUploadDir);
    this.ensureDirectoryExists(path.join(this.baseUploadDir, 'covers'));
    this.ensureDirectoryExists(path.join(this.baseUploadDir, 'avatars'));
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, folder = 'covers'): Promise<string> {
    const targetDir = path.join(this.baseUploadDir, folder);
    this.ensureDirectoryExists(targetDir);

    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${folder}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const destination = path.join(targetDir, filename);

    if (file.path && fs.existsSync(file.path)) {
      fs.renameSync(file.path, destination);
    } else if (file.buffer) {
      fs.writeFileSync(destination, file.buffer);
    }

    return `/uploads/${folder}/${filename}`;
  }

  async deleteFile(fileUrlOrKey: string): Promise<boolean> {
    try {
      if (!fileUrlOrKey || !fileUrlOrKey.startsWith('/uploads/')) {
        return false;
      }
      const relativePath = fileUrlOrKey.replace('/uploads/', '');
      const fullPath = path.join(this.baseUploadDir, relativePath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[StorageService] Error deleting file:', err);
      return false;
    }
  }

  getUrl(fileKey: string): string {
    if (fileKey.startsWith('http://') || fileKey.startsWith('https://')) {
      return fileKey;
    }
    return fileKey.startsWith('/') ? fileKey : `/${fileKey}`;
  }
}

export const StorageService: IStorageService = new LocalStorageService();

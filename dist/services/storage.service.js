"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
class LocalStorageService {
    baseUploadDir;
    constructor() {
        this.baseUploadDir = path_1.default.resolve(__dirname, '../../', env_1.config.storage.uploadDir);
        this.ensureDirectoryExists(this.baseUploadDir);
        this.ensureDirectoryExists(path_1.default.join(this.baseUploadDir, 'covers'));
        this.ensureDirectoryExists(path_1.default.join(this.baseUploadDir, 'avatars'));
    }
    ensureDirectoryExists(dirPath) {
        if (!fs_1.default.existsSync(dirPath)) {
            fs_1.default.mkdirSync(dirPath, { recursive: true });
        }
    }
    async uploadFile(file, folder = 'covers') {
        const targetDir = path_1.default.join(this.baseUploadDir, folder);
        this.ensureDirectoryExists(targetDir);
        const ext = path_1.default.extname(file.originalname) || '.jpg';
        const filename = `${folder}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const destination = path_1.default.join(targetDir, filename);
        if (file.path && fs_1.default.existsSync(file.path)) {
            fs_1.default.renameSync(file.path, destination);
        }
        else if (file.buffer) {
            fs_1.default.writeFileSync(destination, file.buffer);
        }
        return `/uploads/${folder}/${filename}`;
    }
    async deleteFile(fileUrlOrKey) {
        try {
            if (!fileUrlOrKey || !fileUrlOrKey.startsWith('/uploads/')) {
                return false;
            }
            const relativePath = fileUrlOrKey.replace('/uploads/', '');
            const fullPath = path_1.default.join(this.baseUploadDir, relativePath);
            if (fs_1.default.existsSync(fullPath)) {
                fs_1.default.unlinkSync(fullPath);
                return true;
            }
            return false;
        }
        catch (err) {
            console.error('[StorageService] Error deleting file:', err);
            return false;
        }
    }
    getUrl(fileKey) {
        if (fileKey.startsWith('http://') || fileKey.startsWith('https://')) {
            return fileKey;
        }
        return fileKey.startsWith('/') ? fileKey : `/${fileKey}`;
    }
}
exports.StorageService = new LocalStorageService();

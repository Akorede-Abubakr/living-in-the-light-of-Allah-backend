import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const chatApiFormat = process.env.AI_CHAT_API_FORMAT || 'native';
if (chatApiFormat !== 'native') {
  throw new Error('AI_CHAT_API_FORMAT must be native.');
}

function positiveInteger(name: string, fallback: number, maximum: number): number {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Set a unique JWT_SECRET of at least 32 characters in production.');
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/brightmind_publishing',
  jwtSecret: process.env.JWT_SECRET || 'brightmind_default_secret_key_change_in_prod_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:5174',
  ai: {
    // Speech has its own endpoint; RunPod chat uses the native /chat protocol.
    url: process.env.AI_ASR_SERVICE_URL || process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
    token: process.env.AI_ASR_SERVICE_TOKEN || process.env.AI_SERVICE_TOKEN || '',
    chatUrl: process.env.AI_SERVICE_URL || '',
    chatToken: process.env.AI_SERVICE_TOKEN || '',
    chatApiFormat,
    chatTimeoutMs: positiveInteger('AI_CHAT_TIMEOUT_MS', 135000, 330000),
    timeoutMs: positiveInteger('AI_SERVICE_TIMEOUT_MS', 780000, 1800000),
    uploadTimeoutMs: positiveInteger('AI_UPLOAD_TIMEOUT_MS', 30000, 120000),
    maxUploadBytes: positiveInteger('AI_MAX_UPLOAD_BYTES', 10485760, 52428800),
    rateLimitWindowMs: positiveInteger('AI_RATE_LIMIT_WINDOW_MS', 900000, 86400000),
    rateLimitMax: positiveInteger('AI_RATE_LIMIT_MAX', 5, 1000),
    maxConcurrent: positiveInteger('AI_MAX_CONCURRENT_REQUESTS', 2, 20),
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    mockMode: process.env.PAYSTACK_MOCK_MODE === 'true' || !process.env.PAYSTACK_SECRET_KEY,
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
  },
};

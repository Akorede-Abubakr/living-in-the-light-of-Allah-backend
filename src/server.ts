import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './config/env';
import { createCorsOptions } from './config/cors';
import { connectDB } from './config/db';
import apiRoutes from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// Create uploads directory if not exists
const uploadDir = path.resolve(__dirname, '../', config.storage.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Security Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration for Frontend and Admin
app.use(cors(createCorsOptions(config.nodeEnv, config.frontendUrl, config.adminUrl)));

// Parsers
const jsonParser = express.json({ limit: '10mb' });
// Chat authenticates before parsing and applies its own smaller body limit.
app.use((req, res, next) => /^\/api\/ai\/(chat\/?$|books(?:\/|$))/i.test(req.path) ? next() : jsonParser(req, res, next));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logger
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Static uploads folder
app.use('/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'BrightMind Publishing API',
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api', apiRoutes);

// Global Error Handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  await connectDB();

  app.listen(config.port, () => {
    console.log(`BrightMind API running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Frontend Origin: ${config.frontendUrl}`);
    console.log(`Admin Origin: ${config.adminUrl}`);

  });
};

startServer();

export default app;

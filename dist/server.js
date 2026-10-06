"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middlewares/errorHandler");
const app = (0, express_1.default)();
// Create uploads directory if not exists
const uploadDir = path_1.default.resolve(__dirname, '../', env_1.config.storage.uploadDir);
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Security Middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// CORS configuration for Frontend and Admin
const allowedOrigins = [
    env_1.config.frontendUrl,
    env_1.config.adminUrl,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
            callback(null, true);
        }
        else {
            callback(null, true); // Permissive in dev
        }
    },
    credentials: true,
}));
// Parsers
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// Logger
if (env_1.config.nodeEnv === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
// Static uploads folder
app.use('/uploads', express_1.default.static(uploadDir));
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
app.use('/api', routes_1.default);
// Global Error Handler
app.use(errorHandler_1.errorHandler);
// Start server
const startServer = async () => {
    await (0, db_1.connectDB)();
    app.listen(env_1.config.port, () => {
        console.log(`=============================================`);
        console.log(`🚀 BrightMind API running on port ${env_1.config.port}`);
        console.log(`📚 Environment: ${env_1.config.nodeEnv}`);
        console.log(`🌐 Frontend Origin: ${env_1.config.frontendUrl}`);
        console.log(`👑 Admin Origin: ${env_1.config.adminUrl}`);
        console.log(`=============================================`);
    });
};
startServer();
exports.default = app;

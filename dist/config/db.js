"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const connectDB = async () => {
    try {
        const conn = await mongoose_1.default.connect(env_1.config.mongoUri, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log(`[Database] MongoDB Connected: ${conn.connection.host} (${conn.connection.name})`);
    }
    catch (error) {
        console.error(`[Database] MongoDB Connection Error:`, error);
        console.log(`[Database] Tip: Ensure MongoDB service or local mongod is running on ${env_1.config.mongoUri}`);
        // Do not terminate process immediately in development so server can report status
    }
};
exports.connectDB = connectDB;
mongoose_1.default.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB disconnected');
});
mongoose_1.default.connection.on('reconnected', () => {
    console.log('[Database] MongoDB reconnected');
});

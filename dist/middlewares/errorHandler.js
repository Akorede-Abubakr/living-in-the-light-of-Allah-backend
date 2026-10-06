"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    // Handle Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid resource identifier format: ${err.value}`;
    }
    // Handle Mongoose Duplicate Key Error (E11000)
    if (err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyValue)[0];
        message = `A record with this ${field} already exists: "${err.keyValue[field]}"`;
    }
    // Handle Mongoose Validation Error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        const errorMessages = Object.values(err.errors).map((e) => e.message);
        message = errorMessages.join(', ');
    }
    // Handle JWT Error
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid authorization token';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Authorization token has expired';
    }
    if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
        console.error('[Error Handler]', err);
    }
    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};
exports.errorHandler = errorHandler;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessControlService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Book_1 = require("../models/Book");
const Order_1 = require("../models/Order");
const User_1 = require("../models/User");
class AccessControlService {
    /**
     * Evaluates a user's access rights to a book
     */
    static async checkBookAccess(userId, bookId) {
        const book = await Book_1.Book.findById(bookId);
        if (!book) {
            throw new Error('Book not found');
        }
        const totalPages = book.pageCount || 1;
        let previewLimit = book.previewPages || 5;
        if (book.previewPercentage && book.previewPercentage > 0) {
            const calculatedFromPct = Math.max(1, Math.ceil((totalPages * book.previewPercentage) / 100));
            previewLimit = Math.min(previewLimit, calculatedFromPct);
        }
        // Cap preview limit to total pages
        previewLimit = Math.min(previewLimit, totalPages);
        // If unauthenticated -> preview only
        if (!userId) {
            return {
                hasFullAccess: false,
                previewLimit,
                totalPages,
                isPurchased: false,
                isAdmin: false,
                book,
            };
        }
        // Check user role
        const user = await User_1.User.findById(userId);
        if (user && user.role === 'admin') {
            return {
                hasFullAccess: true,
                previewLimit: totalPages,
                totalPages,
                isPurchased: true,
                isAdmin: true,
                book,
            };
        }
        // Check if user has a completed order containing this book
        const completedOrder = await Order_1.Order.findOne({
            user: new mongoose_1.default.Types.ObjectId(userId),
            'items.book': new mongoose_1.default.Types.ObjectId(bookId),
            paymentStatus: 'completed',
            accessGranted: true,
        });
        const isPurchased = !!completedOrder;
        return {
            hasFullAccess: isPurchased,
            previewLimit: isPurchased ? totalPages : previewLimit,
            totalPages,
            isPurchased,
            isAdmin: false,
            book,
        };
    }
    /**
     * Validates if a specific page can be viewed by the user
     */
    static async canViewPage(userId, bookId, pageNumber) {
        const access = await this.checkBookAccess(userId, bookId);
        if (access.hasFullAccess) {
            return {
                allowed: true,
                previewLimit: access.previewLimit,
                totalPages: access.totalPages,
                isPurchased: true,
            };
        }
        const isWithinPreview = pageNumber <= access.previewLimit;
        return {
            allowed: isWithinPreview,
            previewLimit: access.previewLimit,
            totalPages: access.totalPages,
            isPurchased: false,
        };
    }
}
exports.AccessControlService = AccessControlService;

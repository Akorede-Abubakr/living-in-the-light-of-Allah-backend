"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookmarkController = void 0;
const Bookmark_1 = require("../models/Bookmark");
const Page_1 = require("../models/Page");
const mongoose_1 = __importDefault(require("mongoose"));
class BookmarkController {
    /**
     * Get all bookmarks for a specific book
     */
    static async getBookBookmarks(req, res) {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }
        const { bookId } = req.params;
        const bookmarks = await Bookmark_1.Bookmark.find({
            user: req.user._id,
            book: new mongoose_1.default.Types.ObjectId(bookId),
        })
            .populate('chapter', 'title order')
            .sort({ pageNumber: 1 });
        res.status(200).json({
            success: true,
            data: bookmarks,
        });
    }
    /**
     * Get all bookmarks across user's library
     */
    static async getMyBookmarks(req, res) {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }
        const bookmarks = await Bookmark_1.Bookmark.find({ user: req.user._id })
            .populate('book', 'title author coverImage slug')
            .populate('chapter', 'title order')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: bookmarks,
        });
    }
    /**
     * Create or toggle a bookmark on a page
     */
    static async createBookmark(req, res) {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }
        const { bookId, pageNumber, chapterId, note } = req.body;
        if (!bookId || !pageNumber) {
            res.status(400).json({ success: false, message: 'bookId and pageNumber are required' });
            return;
        }
        // Check if bookmark already exists -> toggle delete or update
        const existing = await Bookmark_1.Bookmark.findOne({
            user: req.user._id,
            book: bookId,
            pageNumber: Number(pageNumber),
        });
        if (existing) {
            // If no note update provided, toggle off
            if (note === undefined) {
                await Bookmark_1.Bookmark.findByIdAndDelete(existing._id);
                res.status(200).json({
                    success: true,
                    action: 'removed',
                    message: 'Bookmark removed',
                });
                return;
            }
            existing.note = note;
            await existing.save();
            res.status(200).json({
                success: true,
                action: 'updated',
                message: 'Bookmark updated',
                data: existing,
            });
            return;
        }
        let chId = chapterId;
        if (!chId) {
            const pageDoc = await Page_1.Page.findOne({ book: bookId, pageNumber: Number(pageNumber) });
            if (pageDoc)
                chId = pageDoc.chapter;
        }
        const bookmark = await Bookmark_1.Bookmark.create({
            user: req.user._id,
            book: bookId,
            chapter: chId,
            pageNumber: Number(pageNumber),
            note: note || '',
        });
        res.status(201).json({
            success: true,
            action: 'created',
            message: 'Page bookmarked successfully',
            data: bookmark,
        });
    }
    /**
     * Delete a bookmark by ID
     */
    static async deleteBookmark(req, res) {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }
        const { id } = req.params;
        const bookmark = await Bookmark_1.Bookmark.findOneAndDelete({
            _id: id,
            user: req.user._id,
        });
        if (!bookmark) {
            res.status(404).json({ success: false, message: 'Bookmark not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Bookmark removed successfully',
        });
    }
}
exports.BookmarkController = BookmarkController;

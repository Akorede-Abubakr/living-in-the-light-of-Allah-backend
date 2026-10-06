"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChapterController = void 0;
const Chapter_1 = require("../models/Chapter");
const Page_1 = require("../models/Page");
const Book_1 = require("../models/Book");
class ChapterController {
    static async getChaptersByBook(req, res) {
        const { bookId } = req.params;
        const chapters = await Chapter_1.Chapter.find({ book: bookId }).sort({ order: 1 });
        const chaptersWithPages = await Promise.all(chapters.map(async (ch) => {
            const pages = await Page_1.Page.find({ chapter: ch._id }).sort({ chapterPageNumber: 1, pageNumber: 1 });
            return {
                ...ch.toObject(),
                pages,
                pageCount: pages.length,
            };
        }));
        res.status(200).json({
            success: true,
            data: chaptersWithPages,
        });
    }
    static async createChapter(req, res) {
        const { bookId } = req.params;
        const { title, description, order } = req.body;
        if (!title) {
            res.status(400).json({ success: false, message: 'Chapter title is required' });
            return;
        }
        const book = await Book_1.Book.findById(bookId);
        if (!book) {
            res.status(404).json({ success: false, message: 'Book not found' });
            return;
        }
        let chapterOrder = order;
        if (chapterOrder === undefined) {
            const highest = await Chapter_1.Chapter.findOne({ book: bookId }).sort({ order: -1 });
            chapterOrder = highest ? highest.order + 1 : 1;
        }
        const chapter = await Chapter_1.Chapter.create({
            book: bookId,
            title,
            description: description || '',
            order: chapterOrder,
        });
        res.status(201).json({
            success: true,
            message: 'Chapter created successfully',
            data: chapter,
        });
    }
    static async updateChapter(req, res) {
        const { id } = req.params;
        const { title, description, order } = req.body;
        const updates = {};
        if (title)
            updates.title = title;
        if (description !== undefined)
            updates.description = description;
        if (order !== undefined)
            updates.order = Number(order);
        const chapter = await Chapter_1.Chapter.findByIdAndUpdate(id, updates, { new: true });
        if (!chapter) {
            res.status(404).json({ success: false, message: 'Chapter not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Chapter updated successfully',
            data: chapter,
        });
    }
    static async deleteChapter(req, res) {
        const { id } = req.params;
        const chapter = await Chapter_1.Chapter.findById(id);
        if (!chapter) {
            res.status(404).json({ success: false, message: 'Chapter not found' });
            return;
        }
        // Delete associated pages
        await Page_1.Page.deleteMany({ chapter: id });
        await Chapter_1.Chapter.findByIdAndDelete(id);
        // Recalculate book pageCount
        const totalPages = await Page_1.Page.countDocuments({ book: chapter.book });
        await Book_1.Book.findByIdAndUpdate(chapter.book, { pageCount: totalPages });
        res.status(200).json({
            success: true,
            message: 'Chapter and its pages deleted successfully',
        });
    }
    static async reorderChapters(req, res) {
        const { bookId } = req.params;
        const { chapterOrders } = req.body; // Array of { id: string, order: number }
        if (!Array.isArray(chapterOrders)) {
            res.status(400).json({ success: false, message: 'chapterOrders array is required' });
            return;
        }
        await Promise.all(chapterOrders.map((item) => Chapter_1.Chapter.findByIdAndUpdate(item.id, { order: item.order })));
        const updated = await Chapter_1.Chapter.find({ book: bookId }).sort({ order: 1 });
        res.status(200).json({
            success: true,
            message: 'Chapters reordered successfully',
            data: updated,
        });
    }
}
exports.ChapterController = ChapterController;

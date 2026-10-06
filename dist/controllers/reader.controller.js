"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderController = void 0;
const Book_1 = require("../models/Book");
const Chapter_1 = require("../models/Chapter");
const Page_1 = require("../models/Page");
const Bookmark_1 = require("../models/Bookmark");
const ReadingProgress_1 = require("../models/ReadingProgress");
const access_service_1 = require("../services/access.service");
class ReaderController {
    /**
     * Returns book reader metadata, chapter outline, access state, bookmarks & saved progress
     */
    static async getReaderMeta(req, res) {
        const { bookId } = req.params;
        const userId = req.user?._id?.toString();
        const book = await Book_1.Book.findById(bookId).populate('category', 'name slug');
        if (!book) {
            res.status(404).json({ success: false, message: 'Book not found' });
            return;
        }
        const access = await access_service_1.AccessControlService.checkBookAccess(userId, bookId);
        // Get all chapters with their page ranges
        const chapters = await Chapter_1.Chapter.find({ book: bookId }).sort({ order: 1 });
        const chaptersStructure = await Promise.all(chapters.map(async (ch) => {
            const pages = await Page_1.Page.find({ chapter: ch._id })
                .select('_id pageNumber chapterPageNumber title')
                .sort({ chapterPageNumber: 1 });
            const firstPage = pages[0]?.pageNumber || 1;
            const lastPage = pages[pages.length - 1]?.pageNumber || firstPage;
            return {
                id: ch._id,
                title: ch.title,
                order: ch.order,
                description: ch.description,
                startPage: firstPage,
                endPage: lastPage,
                pageCount: pages.length,
                pages,
            };
        }));
        // Get total pages in database
        const totalPages = await Page_1.Page.countDocuments({ book: bookId });
        // Fetch user-specific bookmarks and reading progress if authenticated
        let bookmarks = [];
        let progress = null;
        if (userId) {
            bookmarks = await Bookmark_1.Bookmark.find({ user: userId, book: bookId }).sort({ pageNumber: 1 });
            progress = await ReadingProgress_1.ReadingProgress.findOne({ user: userId, book: bookId });
        }
        res.status(200).json({
            success: true,
            data: {
                book: {
                    id: book._id,
                    title: book.title,
                    subtitle: book.subtitle,
                    author: book.author,
                    coverImage: book.coverImage,
                    price: book.price,
                    currency: book.currency,
                    pageCount: totalPages || book.pageCount,
                },
                hasFullAccess: access.hasFullAccess,
                isPurchased: access.isPurchased,
                isAdmin: access.isAdmin,
                previewLimit: access.previewLimit,
                totalPages: totalPages || book.pageCount,
                chapters: chaptersStructure,
                bookmarks,
                savedProgress: progress
                    ? {
                        currentPage: progress.currentPage,
                        percentage: progress.percentage,
                        lastReadAt: progress.lastReadAt,
                    }
                    : null,
            },
        });
    }
    /**
     * Returns preview pages only (pages <= previewLimit)
     */
    static async getPreviewPages(req, res) {
        const { bookId } = req.params;
        const userId = req.user?._id?.toString();
        const book = await Book_1.Book.findById(bookId);
        if (!book) {
            res.status(404).json({ success: false, message: 'Book not found' });
            return;
        }
        const access = await access_service_1.AccessControlService.checkBookAccess(userId, bookId);
        const maxPage = access.hasFullAccess ? 999999 : access.previewLimit;
        const pages = await Page_1.Page.find({ book: bookId, pageNumber: { $lte: maxPage } })
            .populate('chapter', 'title order')
            .sort({ pageNumber: 1 });
        res.status(200).json({
            success: true,
            data: {
                previewLimit: access.previewLimit,
                totalPages: book.pageCount,
                hasFullAccess: access.hasFullAccess,
                pages,
            },
        });
    }
    /**
     * Fetches a single page by pageNumber with strict backend access enforcement
     */
    static async getPageByNumber(req, res) {
        const { bookId, pageNumber } = req.params;
        const targetPageNumber = parseInt(pageNumber, 10);
        const userId = req.user?._id?.toString();
        if (isNaN(targetPageNumber) || targetPageNumber < 1) {
            res.status(400).json({ success: false, message: 'Invalid page number' });
            return;
        }
        const book = await Book_1.Book.findById(bookId);
        if (!book) {
            res.status(404).json({ success: false, message: 'Book not found' });
            return;
        }
        const access = await access_service_1.AccessControlService.checkBookAccess(userId, bookId);
        // If page requested is beyond preview limit and user has no full access:
        if (!access.hasFullAccess && targetPageNumber > access.previewLimit) {
            res.status(403).json({
                success: false,
                previewExceeded: true,
                previewLimit: access.previewLimit,
                totalPages: book.pageCount,
                requestedPage: targetPageNumber,
                book: {
                    id: book._id,
                    title: book.title,
                    author: book.author,
                    coverImage: book.coverImage,
                    price: book.price,
                    currency: book.currency,
                },
                message: "You've reached the end of the free preview. Continue reading the full book by purchasing it.",
            });
            return;
        }
        const page = await Page_1.Page.findOne({ book: bookId, pageNumber: targetPageNumber }).populate('chapter', 'title order description');
        if (!page) {
            res.status(404).json({ success: false, message: `Page ${targetPageNumber} not found in this book.` });
            return;
        }
        // Determine next and prev page numbers
        const totalPages = await Page_1.Page.countDocuments({ book: bookId });
        const hasNext = targetPageNumber < totalPages;
        const hasPrev = targetPageNumber > 1;
        // Check if user has bookmark on this page
        let isBookmarked = false;
        let bookmarkId = null;
        if (userId) {
            const bkmk = await Bookmark_1.Bookmark.findOne({ user: userId, book: bookId, pageNumber: targetPageNumber });
            if (bkmk) {
                isBookmarked = true;
                bookmarkId = bkmk._id;
            }
        }
        res.status(200).json({
            success: true,
            data: {
                page: {
                    id: page._id,
                    pageNumber: page.pageNumber,
                    chapterPageNumber: page.chapterPageNumber,
                    title: page.title,
                    content: page.content,
                    wordCount: page.wordCount,
                    chapter: page.chapter,
                },
                pagination: {
                    currentPage: targetPageNumber,
                    totalPages: totalPages || book.pageCount,
                    hasNext,
                    hasPrev,
                    nextPage: hasNext ? targetPageNumber + 1 : null,
                    prevPage: hasPrev ? targetPageNumber - 1 : null,
                    isWithinPreview: targetPageNumber <= access.previewLimit,
                    isPreviewEnd: !access.hasFullAccess && targetPageNumber === access.previewLimit,
                },
                access: {
                    hasFullAccess: access.hasFullAccess,
                    previewLimit: access.previewLimit,
                    isPurchased: access.isPurchased,
                },
                isBookmarked,
                bookmarkId,
            },
        });
    }
    /**
     * Returns full book content for purchased readers & admins
     */
    static async getFullBook(req, res) {
        const { bookId } = req.params;
        const userId = req.user?._id?.toString();
        const access = await access_service_1.AccessControlService.checkBookAccess(userId, bookId);
        if (!access.hasFullAccess) {
            res.status(403).json({
                success: false,
                message: 'Full book access requires purchasing this book.',
                previewLimit: access.previewLimit,
            });
            return;
        }
        const chapters = await Chapter_1.Chapter.find({ book: bookId }).sort({ order: 1 });
        const chaptersWithFullPages = await Promise.all(chapters.map(async (ch) => {
            const pages = await Page_1.Page.find({ chapter: ch._id }).sort({ chapterPageNumber: 1 });
            return {
                ...ch.toObject(),
                pages,
            };
        }));
        res.status(200).json({
            success: true,
            data: {
                book: access.book,
                chapters: chaptersWithFullPages,
            },
        });
    }
}
exports.ReaderController = ReaderController;

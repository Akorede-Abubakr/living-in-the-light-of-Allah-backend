"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageController = void 0;
const Page_1 = require("../models/Page");
const Chapter_1 = require("../models/Chapter");
const Book_1 = require("../models/Book");
class PageController {
    static async getPagesByChapter(req, res) {
        const { chapterId } = req.params;
        const pages = await Page_1.Page.find({ chapter: chapterId }).sort({ chapterPageNumber: 1, pageNumber: 1 });
        res.status(200).json({
            success: true,
            data: pages,
        });
    }
    static async getPageById(req, res) {
        const { id } = req.params;
        const page = await Page_1.Page.findById(id).populate('chapter', 'title order').populate('book', 'title author');
        if (!page) {
            res.status(404).json({ success: false, message: 'Page not found' });
            return;
        }
        res.status(200).json({
            success: true,
            data: page,
        });
    }
    static async createPage(req, res) {
        const { chapterId } = req.params;
        const { title, content, pageNumber, chapterPageNumber } = req.body;
        if (!content) {
            res.status(400).json({ success: false, message: 'Page content is required' });
            return;
        }
        const chapter = await Chapter_1.Chapter.findById(chapterId);
        if (!chapter) {
            res.status(404).json({ success: false, message: 'Chapter not found' });
            return;
        }
        // Determine global pageNumber if not explicitly provided
        let globalPageNum = pageNumber;
        if (!globalPageNum) {
            const highestGlobal = await Page_1.Page.findOne({ book: chapter.book }).sort({ pageNumber: -1 });
            globalPageNum = highestGlobal ? highestGlobal.pageNumber + 1 : 1;
        }
        // Determine chapterPageNumber if not provided
        let chPageNum = chapterPageNumber;
        if (!chPageNum) {
            const highestInChapter = await Page_1.Page.findOne({ chapter: chapterId }).sort({ chapterPageNumber: -1 });
            chPageNum = highestInChapter ? highestInChapter.chapterPageNumber + 1 : 1;
        }
        // Calculate approximate word count
        const wordCount = content.trim().split(/\s+/).length;
        const page = await Page_1.Page.create({
            book: chapter.book,
            chapter: chapterId,
            pageNumber: globalPageNum,
            chapterPageNumber: chPageNum,
            title: title || '',
            content,
            wordCount,
        });
        // Update book total page count
        const totalBookPages = await Page_1.Page.countDocuments({ book: chapter.book });
        await Book_1.Book.findByIdAndUpdate(chapter.book, { pageCount: totalBookPages });
        res.status(201).json({
            success: true,
            message: 'Page created successfully',
            data: page,
        });
    }
    static async updatePage(req, res) {
        const { id } = req.params;
        const { title, content, pageNumber, chapterPageNumber } = req.body;
        const page = await Page_1.Page.findById(id);
        if (!page) {
            res.status(404).json({ success: false, message: 'Page not found' });
            return;
        }
        if (title !== undefined)
            page.title = title;
        if (content !== undefined) {
            page.content = content;
            page.wordCount = content.trim().split(/\s+/).length;
        }
        if (pageNumber !== undefined)
            page.pageNumber = Number(pageNumber);
        if (chapterPageNumber !== undefined)
            page.chapterPageNumber = Number(chapterPageNumber);
        await page.save();
        res.status(200).json({
            success: true,
            message: 'Page updated successfully',
            data: page,
        });
    }
    static async deletePage(req, res) {
        const { id } = req.params;
        const page = await Page_1.Page.findById(id);
        if (!page) {
            res.status(404).json({ success: false, message: 'Page not found' });
            return;
        }
        const bookId = page.book;
        await Page_1.Page.findByIdAndDelete(id);
        // Update book total page count
        const totalBookPages = await Page_1.Page.countDocuments({ book: bookId });
        await Book_1.Book.findByIdAndUpdate(bookId, { pageCount: totalBookPages });
        res.status(200).json({
            success: true,
            message: 'Page deleted successfully',
        });
    }
}
exports.PageController = PageController;

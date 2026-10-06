import { Request, Response } from 'express';
import { Page } from '../models/Page';
import { Chapter } from '../models/Chapter';
import { Book } from '../models/Book';
import { AuthRequest } from '../middlewares/auth';

export class PageController {
  static async getPagesByChapter(req: Request, res: Response): Promise<void> {
    const { chapterId } = req.params;

    const pages = await Page.find({ chapter: chapterId }).sort({ chapterPageNumber: 1, pageNumber: 1 });

    res.status(200).json({
      success: true,
      data: pages,
    });
  }

  static async getPageById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const page = await Page.findById(id).populate('chapter', 'title order').populate('book', 'title author');

    if (!page) {
      res.status(404).json({ success: false, message: 'Page not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: page,
    });
  }

  static async createPage(req: AuthRequest, res: Response): Promise<void> {
    const { chapterId } = req.params;
    const { title, content, pageNumber, chapterPageNumber } = req.body;

    if (!content) {
      res.status(400).json({ success: false, message: 'Page content is required' });
      return;
    }

    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      res.status(404).json({ success: false, message: 'Chapter not found' });
      return;
    }

    // Determine global pageNumber if not explicitly provided
    let globalPageNum = pageNumber;
    if (!globalPageNum) {
      const highestGlobal = await Page.findOne({ book: chapter.book }).sort({ pageNumber: -1 });
      globalPageNum = highestGlobal ? highestGlobal.pageNumber + 1 : 1;
    }

    // Determine chapterPageNumber if not provided
    let chPageNum = chapterPageNumber;
    if (!chPageNum) {
      const highestInChapter = await Page.findOne({ chapter: chapterId }).sort({ chapterPageNumber: -1 });
      chPageNum = highestInChapter ? highestInChapter.chapterPageNumber + 1 : 1;
    }

    // Calculate approximate word count
    const wordCount = content.trim().split(/\s+/).length;

    const page = await Page.create({
      book: chapter.book,
      chapter: chapterId,
      pageNumber: globalPageNum,
      chapterPageNumber: chPageNum,
      title: title || '',
      content,
      wordCount,
    });

    // Update book total page count
    const totalBookPages = await Page.countDocuments({ book: chapter.book });
    await Book.findByIdAndUpdate(chapter.book, { pageCount: totalBookPages });

    res.status(201).json({
      success: true,
      message: 'Page created successfully',
      data: page,
    });
  }

  static async updatePage(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { title, content, pageNumber, chapterPageNumber } = req.body;

    const page = await Page.findById(id);
    if (!page) {
      res.status(404).json({ success: false, message: 'Page not found' });
      return;
    }

    if (title !== undefined) page.title = title;
    if (content !== undefined) {
      page.content = content;
      page.wordCount = content.trim().split(/\s+/).length;
    }
    if (pageNumber !== undefined) page.pageNumber = Number(pageNumber);
    if (chapterPageNumber !== undefined) page.chapterPageNumber = Number(chapterPageNumber);

    await page.save();

    res.status(200).json({
      success: true,
      message: 'Page updated successfully',
      data: page,
    });
  }

  static async deletePage(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;

    const page = await Page.findById(id);
    if (!page) {
      res.status(404).json({ success: false, message: 'Page not found' });
      return;
    }

    const bookId = page.book;
    await Page.findByIdAndDelete(id);

    // Update book total page count
    const totalBookPages = await Page.countDocuments({ book: bookId });
    await Book.findByIdAndUpdate(bookId, { pageCount: totalBookPages });

    res.status(200).json({
      success: true,
      message: 'Page deleted successfully',
    });
  }
}

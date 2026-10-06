import { Request, Response } from 'express';
import { Chapter } from '../models/Chapter';
import { Page } from '../models/Page';
import { Book } from '../models/Book';
import { AuthRequest } from '../middlewares/auth';

export class ChapterController {
  static async getChaptersByBook(req: Request, res: Response): Promise<void> {
    const { bookId } = req.params;

    const chapters = await Chapter.find({ book: bookId }).sort({ order: 1 });

    const chaptersWithPages = await Promise.all(
      chapters.map(async (ch) => {
        const pages = await Page.find({ chapter: ch._id }).sort({ chapterPageNumber: 1, pageNumber: 1 });
        return {
          ...ch.toObject(),
          pages,
          pageCount: pages.length,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: chaptersWithPages,
    });
  }

  static async createChapter(req: AuthRequest, res: Response): Promise<void> {
    const { bookId } = req.params;
    const { title, description, order } = req.body;

    if (!title) {
      res.status(400).json({ success: false, message: 'Chapter title is required' });
      return;
    }

    const book = await Book.findById(bookId);
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    let chapterOrder = order;
    if (chapterOrder === undefined) {
      const highest = await Chapter.findOne({ book: bookId }).sort({ order: -1 });
      chapterOrder = highest ? highest.order + 1 : 1;
    }

    const chapter = await Chapter.create({
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

  static async updateChapter(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { title, description, order } = req.body;

    const updates: any = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (order !== undefined) updates.order = Number(order);

    const chapter = await Chapter.findByIdAndUpdate(id, updates, { new: true });
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

  static async deleteChapter(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      res.status(404).json({ success: false, message: 'Chapter not found' });
      return;
    }

    // Delete associated pages
    await Page.deleteMany({ chapter: id });
    await Chapter.findByIdAndDelete(id);

    // Recalculate book pageCount
    const totalPages = await Page.countDocuments({ book: chapter.book });
    await Book.findByIdAndUpdate(chapter.book, { pageCount: totalPages });

    res.status(200).json({
      success: true,
      message: 'Chapter and its pages deleted successfully',
    });
  }

  static async reorderChapters(req: AuthRequest, res: Response): Promise<void> {
    const { bookId } = req.params;
    const { chapterOrders } = req.body; // Array of { id: string, order: number }

    if (!Array.isArray(chapterOrders)) {
      res.status(400).json({ success: false, message: 'chapterOrders array is required' });
      return;
    }

    await Promise.all(
      chapterOrders.map((item) => Chapter.findByIdAndUpdate(item.id, { order: item.order }))
    );

    const updated = await Chapter.find({ book: bookId }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      message: 'Chapters reordered successfully',
      data: updated,
    });
  }
}

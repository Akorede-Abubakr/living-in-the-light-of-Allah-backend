import { Response } from 'express';
import { ReadingProgress } from '../models/ReadingProgress';
import { Book } from '../models/Book';
import { Chapter } from '../models/Chapter';
import { Page } from '../models/Page';
import { AuthRequest } from '../middlewares/auth';
import mongoose from 'mongoose';

export class ProgressController {
  /**
   * Save or update user reading progress
   */
  static async saveProgress(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { bookId, chapterId, pageNumber, totalPages } = req.body;

    if (!bookId || pageNumber === undefined) {
      res.status(400).json({ success: false, message: 'bookId and pageNumber are required' });
      return;
    }

    const book = await Book.findById(bookId);
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    // Determine total pages
    const actualTotalPages = totalPages || book.pageCount || (await Page.countDocuments({ book: bookId })) || 1;
    const currPage = Math.max(1, Number(pageNumber));
    const percentage = Math.min(100, Math.round((currPage / actualTotalPages) * 100));
    const isFinished = percentage >= 100 || currPage >= actualTotalPages;

    // Find chapter if not provided
    let currChapterId = chapterId;
    if (!currChapterId) {
      const pageDoc = await Page.findOne({ book: bookId, pageNumber: currPage });
      if (pageDoc) {
        currChapterId = pageDoc.chapter;
      }
    }

    const progress = await ReadingProgress.findOneAndUpdate(
      { user: req.user._id, book: bookId },
      {
        user: req.user._id,
        book: bookId,
        currentChapter: currChapterId,
        currentPage: currPage,
        totalPages: actualTotalPages,
        percentage,
        isFinished,
        lastReadAt: new Date(),
      },
      { new: true, upsert: true, runValidators: true }
    ).populate('currentChapter', 'title order');

    res.status(200).json({
      success: true,
      data: progress,
    });
  }

  /**
   * Get progress for a specific book
   */
  static async getProgress(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { bookId } = req.params;

    const progress = await ReadingProgress.findOne({
      user: req.user._id,
      book: new mongoose.Types.ObjectId(bookId),
    }).populate('currentChapter', 'title order');

    res.status(200).json({
      success: true,
      data: progress || null,
    });
  }

  /**
   * Get all recently read books (Continue Reading section)
   */
  static async getRecentProgress(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const progressList = await ReadingProgress.find({ user: req.user._id })
      .populate({
        path: 'book',
        populate: { path: 'category', select: 'name slug' },
      })
      .populate('currentChapter', 'title order')
      .sort({ lastReadAt: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      data: progressList,
    });
  }
}

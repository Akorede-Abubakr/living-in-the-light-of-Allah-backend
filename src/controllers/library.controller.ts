import { Response } from 'express';
import { Order } from '../models/Order';
import { Book } from '../models/Book';
import { ReadingProgress } from '../models/ReadingProgress';
import { AuthRequest } from '../middlewares/auth';
import mongoose from 'mongoose';

export class LibraryController {
  /**
   * Retrieves all books purchased by the user with their reading progress
   */
  static async getMyLibrary(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const userId = req.user._id;

    // Find all completed orders for this user
    const completedOrders = await Order.find({
      user: userId,
      paymentStatus: 'completed',
      accessGranted: true,
    }).sort({ createdAt: -1 });

    // Collect unique book IDs
    const bookIdSet = new Set<string>();
    const orderBookMap = new Map<string, Date>();

    completedOrders.forEach((ord) => {
      ord.items.forEach((item) => {
        const idStr = item.book.toString();
        bookIdSet.add(idStr);
        if (!orderBookMap.has(idStr)) {
          orderBookMap.set(idStr, ord.paidAt || ord.createdAt);
        }
      });
    });

    const bookIds = Array.from(bookIdSet).map((id) => new mongoose.Types.ObjectId(id));

    // Fetch the actual book details
    const books = await Book.find({ _id: { $in: bookIds } }).populate('category', 'name slug');

    // Fetch user's reading progress for all these books
    const progressList = await ReadingProgress.find({
      user: userId,
      book: { $in: bookIds },
    }).populate('currentChapter', 'title order');

    const progressMap = new Map<string, any>();
    progressList.forEach((p) => {
      progressMap.set(p.book.toString(), p);
    });

    // Merge books with reading progress
    const libraryItems = books.map((b) => {
      const bookIdStr = (b._id as any).toString();
      const progress = progressMap.get(bookIdStr);
      const purchasedAt = orderBookMap.get(bookIdStr);

      return {
        book: b,
        purchasedAt,
        progress: progress
          ? {
              currentPage: progress.currentPage,
              totalPages: progress.totalPages || b.pageCount,
              percentage: progress.percentage,
              lastReadAt: progress.lastReadAt,
              isFinished: progress.isFinished,
              currentChapter: progress.currentChapter,
            }
          : {
              currentPage: 1,
              totalPages: b.pageCount || 1,
              percentage: 0,
              lastReadAt: null,
              isFinished: false,
              currentChapter: null,
            },
      };
    });

    res.status(200).json({
      success: true,
      data: libraryItems,
    });
  }

  /**
   * Checks if user owns a specific book
   */
  static async checkOwnership(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(200).json({ success: true, isPurchased: false });
      return;
    }

    const { bookId } = req.params;

    if (req.user.role === 'admin') {
      res.status(200).json({ success: true, isPurchased: true, isAdmin: true });
      return;
    }

    const completedOrder = await Order.findOne({
      user: req.user._id,
      'items.book': new mongoose.Types.ObjectId(bookId),
      paymentStatus: 'completed',
      accessGranted: true,
    });

    res.status(200).json({
      success: true,
      isPurchased: !!completedOrder,
    });
  }
}

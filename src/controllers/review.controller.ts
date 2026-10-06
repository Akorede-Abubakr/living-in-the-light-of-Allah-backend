import { Request, Response } from 'express';
import { Review } from '../models/Review';
import { Book } from '../models/Book';
import { Order } from '../models/Order';
import { AuthRequest } from '../middlewares/auth';
import mongoose from 'mongoose';

export class ReviewController {
  /**
   * Recalculates aggregate rating and reviewCount for a book
   */
  private static async updateBookAggregateRating(bookId: string | mongoose.Types.ObjectId): Promise<void> {
    const stats = await Review.aggregate([
      { $match: { book: new mongoose.Types.ObjectId(bookId.toString()), isModerated: true } },
      {
        $group: {
          _id: '$book',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      await Book.findByIdAndUpdate(bookId, {
        rating: Math.round(stats[0].avgRating * 10) / 10,
        reviewCount: stats[0].count,
      });
    } else {
      await Book.findByIdAndUpdate(bookId, {
        rating: 5.0,
        reviewCount: 0,
      });
    }
  }

  /**
   * Get all reviews for a book
   */
  static async getBookReviews(req: Request, res: Response): Promise<void> {
    const { bookId } = req.params;

    const reviews = await Review.find({ book: bookId, isModerated: true })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    // Calculate rating distribution
    const counts = [0, 0, 0, 0, 0]; // 1, 2, 3, 4, 5 stars
    reviews.forEach((r) => {
      const idx = Math.min(5, Math.max(1, r.rating)) - 1;
      counts[idx]++;
    });

    res.status(200).json({
      success: true,
      data: {
        reviews,
        total: reviews.length,
        distribution: {
          5: counts[4],
          4: counts[3],
          3: counts[2],
          2: counts[1],
          1: counts[0],
        },
      },
    });
  }

  /**
   * Create a review for a book (checks if user purchased or is authenticated)
   */
  static async createReview(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { bookId } = req.params;
    const { rating, title, comment } = req.body;

    if (!rating || !comment) {
      res.status(400).json({ success: false, message: 'Rating and comment are required' });
      return;
    }

    const book = await Book.findById(bookId);
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    // Check if user already reviewed this book
    const existing = await Review.findOne({ user: req.user._id, book: bookId });
    if (existing) {
      existing.rating = Number(rating);
      existing.title = title || '';
      existing.comment = comment;
      await existing.save();

      await ReviewController.updateBookAggregateRating(bookId);

      res.status(200).json({
        success: true,
        message: 'Review updated successfully',
        data: existing,
      });
      return;
    }

    // Check if user has verified purchase
    const order = await Order.findOne({
      user: req.user._id,
      'items.book': new mongoose.Types.ObjectId(bookId),
      paymentStatus: 'completed',
    });

    const isVerifiedPurchase = !!order || req.user.role === 'admin';

    const review = await Review.create({
      user: req.user._id,
      book: bookId,
      rating: Number(rating),
      title: title || '',
      comment,
      isVerifiedPurchase,
      isModerated: true,
    });

    await ReviewController.updateBookAggregateRating(bookId);

    res.status(201).json({
      success: true,
      message: 'Thank you! Your review has been published.',
      data: review,
    });
  }

  /**
   * Delete a review (by reviewer or admin)
   */
  static async deleteReview(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    if (req.user.role !== 'admin' && review.user.toString() !== req.user._id.toString()) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own review' });
      return;
    }

    const bookId = review.book;
    await Review.findByIdAndDelete(id);
    await ReviewController.updateBookAggregateRating(bookId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  }

  /**
   * Admin: List all reviews across bookstore for moderation
   */
  static async getAdminReviews(req: AuthRequest, res: Response): Promise<void> {
    const { search, rating, page = '1', limit = '15' } = req.query;

    const queryObj: any = {};
    if (rating && !isNaN(Number(rating))) {
      queryObj.rating = Number(rating);
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit as string, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      Review.find(queryObj)
        .populate('user', 'name email avatar')
        .populate('book', 'title author coverImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Review.countDocuments(queryObj),
    ]);

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }
}

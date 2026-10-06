import { Request, Response } from 'express';
import { Book, IBook } from '../models/Book';
import { Chapter } from '../models/Chapter';
import { Page } from '../models/Page';
import { Category } from '../models/Category';
import { Review } from '../models/Review';
import { AuthRequest } from '../middlewares/auth';
import { AccessControlService } from '../services/access.service';
import { StorageService } from '../services/storage.service';
import { ReadingProgress } from '../models/ReadingProgress';

export class BookController {
  static async getBooks(req: Request, res: Response): Promise<void> {
    const {
      q,
      category,
      minPrice,
      maxPrice,
      sortBy = 'featured',
      page = '1',
      limit = '12',
      status = 'published',
      featured,
      popular,
    } = req.query;

    const queryObj: any = {};

    // Only allow non-published status if explicitly requested
    if (status) {
      queryObj.status = status;
    }

    // Search query
    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      queryObj.$or = [
        { title: regex },
        { author: regex },
        { subtitle: regex },
        { description: regex },
        { tags: { $in: [regex] } },
      ];
    }

    // Category filter
    if (category && typeof category === 'string' && category !== 'all') {
      const catDoc = await Category.findOne({
        $or: [{ _id: category.match(/^[0-9a-fA-F]{24}$/) ? category : null }, { slug: category }],
      });
      if (catDoc) {
        queryObj.category = catDoc._id;
      }
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      queryObj.price = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) {
        queryObj.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
        queryObj.price.$lte = Number(maxPrice);
      }
    }

    // Featured & Popular flags
    if (featured === 'true') {
      queryObj.isFeatured = true;
    }
    if (popular === 'true') {
      queryObj.isPopular = true;
    }

    // Sorting
    let sortOptions: any = {};
    switch (sortBy) {
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'popular':
        sortOptions = { isPopular: -1, reviewCount: -1, rating: -1 };
        break;
      case 'price_asc':
        sortOptions = { price: 1 };
        break;
      case 'price_desc':
        sortOptions = { price: -1 };
        break;
      case 'rating':
        sortOptions = { rating: -1, reviewCount: -1 };
        break;
      case 'title':
        sortOptions = { title: 1 };
        break;
      case 'featured':
      default:
        sortOptions = { isFeatured: -1, createdAt: -1 };
        break;
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit as string, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [books, total] = await Promise.all([
      Book.find(queryObj)
        .populate('category', 'name slug icon')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Book.countDocuments(queryObj),
    ]);

    res.status(200).json({
      success: true,
      data: books,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }

  static async getFeaturedBooks(req: Request, res: Response): Promise<void> {
    const books = await Book.find({ isFeatured: true, status: 'published' })
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 })
      .limit(8);

    res.status(200).json({ success: true, data: books });
  }

  static async getPopularBooks(req: Request, res: Response): Promise<void> {
    const books = await Book.find({ status: 'published' })
      .populate('category', 'name slug icon')
      .sort({ isPopular: -1, rating: -1, reviewCount: -1 })
      .limit(8);

    res.status(200).json({ success: true, data: books });
  }

  static async getNewReleases(req: Request, res: Response): Promise<void> {
    const books = await Book.find({ status: 'published' })
      .populate('category', 'name slug icon')
      .sort({ publicationDate: -1, createdAt: -1 })
      .limit(8);

    res.status(200).json({ success: true, data: books });
  }

  static async getBookById(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;

    const book = await Book.findById(id).populate('category', 'name slug description icon');
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    // Get chapters outline
    const chapters = await Chapter.find({ book: book._id }).sort({ order: 1 });

    // Populate chapter pages count
    const chaptersOutline = await Promise.all(
      chapters.map(async (ch) => {
        const pageCount = await Page.countDocuments({ chapter: ch._id });
        return {
          id: ch._id,
          title: ch.title,
          order: ch.order,
          description: ch.description,
          pageCount,
        };
      })
    );

    // Get access info if user is authenticated
    let isPurchased = false;
    let readingProgress: any = null;
    let previewLimit = book.previewPages || 5;

    if (req.user) {
      const accessStatus = await AccessControlService.checkBookAccess(req.user._id.toString(), id);
      isPurchased = accessStatus.hasFullAccess;
      previewLimit = accessStatus.previewLimit;

      readingProgress = await ReadingProgress.findOne({
        user: req.user._id,
        book: book._id,
      }).populate('currentChapter', 'title order');
    }

    // Related books from same category or author
    const relatedBooks = await Book.find({
      _id: { $ne: book._id },
      category: book.category,
      status: 'published',
    })
      .populate('category', 'name slug')
      .limit(4);

    res.status(200).json({
      success: true,
      data: {
        ...book.toObject(),
        chapters: chaptersOutline,
        previewLimit,
        isPurchased,
        readingProgress,
        relatedBooks,
      },
    });
  }

  static async getBookBySlug(req: AuthRequest, res: Response): Promise<void> {
    const { slug } = req.params;
    const book = await Book.findOne({ slug });

    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    req.params.id = (book._id as any).toString();
    return BookController.getBookById(req, res);
  }

  static async createBook(req: AuthRequest, res: Response): Promise<void> {
    const {
      title,
      subtitle,
      author,
      authorBio,
      description,
      price,
      originalPrice,
      currency = 'USD',
      category,
      language = 'English',
      isbn,
      publicationDate,
      pageCount = 0,
      previewPages = 5,
      previewPercentage = 15,
      status = 'published',
      isFeatured = false,
      isPopular = false,
      isNewRelease = true,
      tags = [],
    } = req.body;

    if (!title || !author || !description || price === undefined || !category) {
      res.status(400).json({
        success: false,
        message: 'Please provide required fields: title, author, description, price, and category.',
      });
      return;
    }

    let coverImage = req.body.coverImage || '/uploads/covers/placeholder.jpg';
    if (req.file) {
      coverImage = await StorageService.uploadFile(req.file, 'covers');
    }

    let baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    let slug = baseSlug;
    let count = 1;
    while (await Book.findOne({ slug })) {
      slug = `${baseSlug}-${count++}`;
    }

    const parsedTags = typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : tags;

    const book = await Book.create({
      title,
      subtitle,
      slug,
      author,
      authorBio,
      description,
      coverImage,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      currency,
      category,
      language,
      isbn,
      publicationDate: publicationDate ? new Date(publicationDate) : new Date(),
      pageCount: Number(pageCount),
      previewPages: Number(previewPages),
      previewPercentage: Number(previewPercentage),
      status,
      isFeatured: String(isFeatured) === 'true' || isFeatured === true,
      isPopular: String(isPopular) === 'true' || isPopular === true,
      isNewRelease: String(isNewRelease) === 'true' || isNewRelease === true,
      tags: parsedTags,
    });

    res.status(201).json({
      success: true,
      message: 'Book created successfully',
      data: book,
    });
  }

  static async updateBook(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const updates: any = { ...req.body };

    if (req.file) {
      updates.coverImage = await StorageService.uploadFile(req.file, 'covers');
    }

    if (updates.tags && typeof updates.tags === 'string') {
      updates.tags = updates.tags.split(',').map((t: string) => t.trim());
    }

    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.originalPrice !== undefined) updates.originalPrice = Number(updates.originalPrice);
    if (updates.pageCount !== undefined) updates.pageCount = Number(updates.pageCount);
    if (updates.previewPages !== undefined) updates.previewPages = Number(updates.previewPages);
    if (updates.previewPercentage !== undefined) updates.previewPercentage = Number(updates.previewPercentage);
    if (updates.isFeatured !== undefined) updates.isFeatured = String(updates.isFeatured) === 'true';
    if (updates.isPopular !== undefined) updates.isPopular = String(updates.isPopular) === 'true';
    if (updates.isNewRelease !== undefined) updates.isNewRelease = String(updates.isNewRelease) === 'true';

    const book = await Book.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Book updated successfully',
      data: book,
    });
  }

  static async deleteBook(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;

    const book = await Book.findById(id);
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    // Delete associated chapters, pages, reviews, reading progress
    await Promise.all([
      Chapter.deleteMany({ book: id }),
      Page.deleteMany({ book: id }),
      Review.deleteMany({ book: id }),
      ReadingProgress.deleteMany({ book: id }),
      Book.findByIdAndDelete(id),
      StorageService.deleteFile(book.coverImage),
    ]);

    res.status(200).json({
      success: true,
      message: 'Book and its associated content deleted successfully',
    });
  }

  static async toggleStatus(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'published', 'archived'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status value' });
      return;
    }

    const book = await Book.findByIdAndUpdate(id, { status }, { new: true });
    if (!book) {
      res.status(404).json({ success: false, message: 'Book not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Book status changed to ${status}`,
      data: book,
    });
  }
}

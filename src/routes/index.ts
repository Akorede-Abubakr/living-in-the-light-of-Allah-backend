import { Router } from 'express';
import authRoutes from './auth.routes';
import bookRoutes from './book.routes';
import categoryRoutes from './category.routes';
import chapterRoutes from './chapter.routes';
import pageRoutes from './page.routes';
import readerRoutes from './reader.routes';
import orderRoutes from './order.routes';
import libraryRoutes from './library.routes';
import progressRoutes from './progress.routes';
import bookmarkRoutes from './bookmark.routes';
import reviewRoutes from './review.routes';
import blogRoutes from './blog.routes';
import adminRoutes from './admin.routes';
import aiRoutes from './ai.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/books', bookRoutes);
router.use('/categories', categoryRoutes);
router.use('/chapters', chapterRoutes);
router.use('/pages', pageRoutes);
router.use('/reader', readerRoutes);
router.use('/orders', orderRoutes);
router.use('/library', libraryRoutes);
router.use('/progress', progressRoutes);
router.use('/bookmarks', bookmarkRoutes);
router.use('/reviews', reviewRoutes);
router.use('/blogs', blogRoutes);
router.use('/admin', adminRoutes);
router.use('/ai', aiRoutes);

export default router;

import { Router } from 'express';
import { BookController } from '../controllers/book.controller';
import { protect, optionalAuth, adminOnly } from '../middlewares/auth';
import { upload } from '../middlewares/upload';

const router = Router();

router.get('/', BookController.getBooks);
router.get('/featured', BookController.getFeaturedBooks);
router.get('/popular', BookController.getPopularBooks);
router.get('/new-releases', BookController.getNewReleases);
router.get('/slug/:slug', optionalAuth, BookController.getBookBySlug);
router.get('/:id', optionalAuth, BookController.getBookById);

// Admin Routes
router.post('/', protect, adminOnly, upload.single('coverImage'), BookController.createBook);
router.patch('/:id', protect, adminOnly, upload.single('coverImage'), BookController.updateBook);
router.patch('/:id/status', protect, adminOnly, BookController.toggleStatus);
router.delete('/:id', protect, adminOnly, BookController.deleteBook);

export default router;

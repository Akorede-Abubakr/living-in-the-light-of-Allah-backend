import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';
import { protect, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/book/:bookId', ReviewController.getBookReviews);
router.post('/book/:bookId', protect, ReviewController.createReview);
router.delete('/:id', protect, ReviewController.deleteReview);
router.get('/admin', protect, adminOnly, ReviewController.getAdminReviews);

export default router;

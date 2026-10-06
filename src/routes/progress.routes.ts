import { Router } from 'express';
import { ProgressController } from '../controllers/progress.controller';
import { protect } from '../middlewares/auth';

const router = Router();

router.post('/', protect, ProgressController.saveProgress);
router.get('/recent', protect, ProgressController.getRecentProgress);
router.get('/:bookId', protect, ProgressController.getProgress);

export default router;

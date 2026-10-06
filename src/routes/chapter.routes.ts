import { Router } from 'express';
import { ChapterController } from '../controllers/chapter.controller';
import { protect, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/book/:bookId', ChapterController.getChaptersByBook);
router.post('/book/:bookId', protect, adminOnly, ChapterController.createChapter);
router.patch('/reorder/:bookId', protect, adminOnly, ChapterController.reorderChapters);
router.patch('/:id', protect, adminOnly, ChapterController.updateChapter);
router.delete('/:id', protect, adminOnly, ChapterController.deleteChapter);

export default router;

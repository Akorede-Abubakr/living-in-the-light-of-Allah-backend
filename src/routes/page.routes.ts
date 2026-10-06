import { Router } from 'express';
import { PageController } from '../controllers/page.controller';
import { protect, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/chapter/:chapterId', PageController.getPagesByChapter);
router.get('/:id', PageController.getPageById);
router.post('/chapter/:chapterId', protect, adminOnly, PageController.createPage);
router.patch('/:id', protect, adminOnly, PageController.updatePage);
router.delete('/:id', protect, adminOnly, PageController.deletePage);

export default router;

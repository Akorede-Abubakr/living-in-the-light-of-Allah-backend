import { Router } from 'express';
import { ReaderController } from '../controllers/reader.controller';
import { optionalAuth, protect } from '../middlewares/auth';

const router = Router();

router.get('/:bookId/meta', optionalAuth, ReaderController.getReaderMeta);
router.get('/:bookId/preview', optionalAuth, ReaderController.getPreviewPages);
router.get('/:bookId/page/:pageNumber', optionalAuth, ReaderController.getPageByNumber);
router.get('/:bookId/full', protect, ReaderController.getFullBook);

export default router;

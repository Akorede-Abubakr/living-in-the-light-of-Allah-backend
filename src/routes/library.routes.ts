import { Router } from 'express';
import { LibraryController } from '../controllers/library.controller';
import { protect, optionalAuth } from '../middlewares/auth';

const router = Router();

router.get('/', protect, LibraryController.getMyLibrary);
router.get('/check/:bookId', optionalAuth, LibraryController.checkOwnership);

export default router;

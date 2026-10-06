import { Router } from 'express';
import { BookmarkController } from '../controllers/bookmark.controller';
import { protect } from '../middlewares/auth';

const router = Router();

router.get('/my-bookmarks', protect, BookmarkController.getMyBookmarks);
router.get('/book/:bookId', protect, BookmarkController.getBookBookmarks);
router.post('/', protect, BookmarkController.createBookmark);
router.delete('/:id', protect, BookmarkController.deleteBookmark);

export default router;

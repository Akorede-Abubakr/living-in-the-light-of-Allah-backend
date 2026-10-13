import { Router } from 'express';
import { BlogController } from '../controllers/blog.controller';
import { protect, adminOnly } from '../middlewares/auth';

const router = Router();

// Admin routes (placed first so /admin/all is not captured by /:slug)
router.get('/admin/all', protect, adminOnly, BlogController.getAllBlogsAdmin);
router.post('/', protect, adminOnly, BlogController.createBlog);
router.put('/:id', protect, adminOnly, BlogController.updateBlog);
router.delete('/:id', protect, adminOnly, BlogController.deleteBlog);

// Public routes
router.get('/', BlogController.getPublishedBlogs);
router.get('/:slug', BlogController.getBlogBySlug);

export default router;

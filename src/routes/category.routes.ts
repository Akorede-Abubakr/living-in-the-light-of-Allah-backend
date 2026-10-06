import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { protect, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/', CategoryController.getCategories);
router.get('/slug/:slug', CategoryController.getCategoryBySlug);
router.post('/', protect, adminOnly, CategoryController.createCategory);
router.patch('/:id', protect, adminOnly, CategoryController.updateCategory);
router.delete('/:id', protect, adminOnly, CategoryController.deleteCategory);

export default router;

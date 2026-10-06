import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { protect, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/overview', protect, adminOnly, AdminController.getOverviewStats);
router.get('/users', protect, adminOnly, AdminController.getAdminUsers);
router.get('/users/:id', protect, adminOnly, AdminController.getUserDetail);
router.patch('/users/:id/status', protect, adminOnly, AdminController.toggleUserStatus);

export default router;

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { protect } from '../middlewares/auth';
import { upload } from '../middlewares/upload';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', protect, AuthController.getMe);
router.patch('/profile', protect, upload.single('avatar'), AuthController.updateProfile);
router.patch('/change-password', protect, AuthController.changePassword);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.delete('/account', protect, AuthController.deleteAccount);

export default router;

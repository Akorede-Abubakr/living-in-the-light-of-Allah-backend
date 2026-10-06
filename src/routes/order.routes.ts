import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { protect, adminOnly } from '../middlewares/auth';

const router = Router();

router.post('/initialize', protect, OrderController.initializeOrder);
router.post('/verify', protect, OrderController.verifyOrder);
router.post('/webhook', OrderController.paystackWebhook);
router.get('/my-orders', protect, OrderController.getMyOrders);
router.get('/admin', protect, adminOnly, OrderController.getAllOrders);
router.get('/:id', protect, OrderController.getOrderById);

export default router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const Order_1 = require("../models/Order");
const payment_service_1 = require("../services/payment.service");
class OrderController {
    /**
     * Initializes a new order & payment transaction
     */
    static async initializeOrder(req, res) {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }
        const { bookIds, callbackUrl, currency } = req.body;
        if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
            res.status(400).json({ success: false, message: 'bookIds array is required' });
            return;
        }
        const result = await payment_service_1.PaymentService.initializePayment({
            userId: req.user._id.toString(),
            bookIds,
            callbackUrl,
            currency,
        });
        res.status(200).json({
            success: true,
            message: 'Payment initialized successfully',
            data: result,
        });
    }
    /**
     * Verifies a completed payment reference & grants book access
     */
    static async verifyOrder(req, res) {
        const { reference } = req.body;
        if (!reference) {
            res.status(400).json({ success: false, message: 'Transaction reference is required' });
            return;
        }
        const result = await payment_service_1.PaymentService.verifyPayment(reference);
        res.status(200).json({
            success: result.status === 'success',
            message: result.message,
            data: {
                order: result.order,
                status: result.status,
            },
        });
    }
    /**
     * Paystack webhook handler
     */
    static async paystackWebhook(req, res) {
        const signature = req.headers['x-paystack-signature'] || '';
        const rawBody = JSON.stringify(req.body);
        await payment_service_1.PaymentService.handleWebhook(signature, req.body, rawBody);
        res.status(200).send('OK');
    }
    /**
     * Customer order history
     */
    static async getMyOrders(req, res) {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }
        const orders = await Order_1.Order.find({ user: req.user._id })
            .populate('items.book', 'title author coverImage slug price')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: orders,
        });
    }
    /**
     * Single order detail
     */
    static async getOrderById(req, res) {
        const { id } = req.params;
        const order = await Order_1.Order.findById(id)
            .populate('user', 'name email')
            .populate('items.book', 'title author coverImage slug price');
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        // Check ownership if not admin
        if (req.user?.role !== 'admin' && order.user._id.toString() !== req.user?._id?.toString()) {
            res.status(403).json({ success: false, message: 'Forbidden' });
            return;
        }
        res.status(200).json({
            success: true,
            data: order,
        });
    }
    /**
     * Admin: List all bookstore orders
     */
    static async getAllOrders(req, res) {
        const { status, search, page = '1', limit = '15' } = req.query;
        const queryObj = {};
        if (status && status !== 'all') {
            queryObj.paymentStatus = status;
        }
        if (search && typeof search === 'string' && search.trim()) {
            queryObj.transactionReference = new RegExp(search.trim(), 'i');
        }
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 15));
        const skip = (pageNum - 1) * limitNum;
        const [orders, total] = await Promise.all([
            Order_1.Order.find(queryObj)
                .populate('user', 'name email avatar')
                .populate('items.book', 'title author coverImage')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Order_1.Order.countDocuments(queryObj),
        ]);
        res.status(200).json({
            success: true,
            data: orders,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
}
exports.OrderController = OrderController;

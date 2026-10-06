"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const Book_1 = require("../models/Book");
const User_1 = require("../models/User");
const Order_1 = require("../models/Order");
const Review_1 = require("../models/Review");
const ReadingProgress_1 = require("../models/ReadingProgress");
class AdminController {
    /**
     * Complete overview stats for Admin Dashboard
     */
    static async getOverviewStats(req, res) {
        const [totalBooks, publishedBooks, draftBooks, totalUsers, totalOrders, completedOrders, reviewsCount, recentOrders, recentUsers,] = await Promise.all([
            Book_1.Book.countDocuments(),
            Book_1.Book.countDocuments({ status: 'published' }),
            Book_1.Book.countDocuments({ status: 'draft' }),
            User_1.User.countDocuments({ role: 'user' }),
            Order_1.Order.countDocuments(),
            Order_1.Order.countDocuments({ paymentStatus: 'completed' }),
            Review_1.Review.countDocuments(),
            Order_1.Order.find()
                .populate('user', 'name email avatar')
                .populate('items.book', 'title coverImage price')
                .sort({ createdAt: -1 })
                .limit(6),
            User_1.User.find({ role: 'user' }).sort({ createdAt: -1 }).limit(6),
        ]);
        // Calculate total revenue
        const revenueAgg = await Order_1.Order.aggregate([
            { $match: { paymentStatus: 'completed' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);
        const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;
        // Monthly revenue data for chart
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        const monthlySalesAgg = await Order_1.Order.aggregate([
            {
                $match: {
                    paymentStatus: 'completed',
                    createdAt: { $gte: sixMonthsAgo },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                    },
                    revenue: { $sum: '$totalAmount' },
                    orderCount: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
        // Format months
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const salesChart = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mIdx = d.getMonth();
            const y = d.getFullYear();
            const match = monthlySalesAgg.find((item) => item._id.year === y && item._id.month === mIdx + 1);
            salesChart.push({
                month: monthNames[mIdx],
                year: y,
                revenue: match ? Math.round(match.revenue * 100) / 100 : 0,
                orders: match ? match.orderCount : 0,
            });
        }
        // Top selling books
        const topBooksAgg = await Order_1.Order.aggregate([
            { $match: { paymentStatus: 'completed' } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.book',
                    salesCount: { $sum: 1 },
                    totalRevenue: { $sum: '$items.price' },
                },
            },
            { $sort: { salesCount: -1 } },
            { $limit: 5 },
        ]);
        const topBooks = await Promise.all(topBooksAgg.map(async (item) => {
            const book = await Book_1.Book.findById(item._id).select('title author coverImage price rating reviewCount');
            return {
                book,
                salesCount: item.salesCount,
                totalRevenue: Math.round(item.totalRevenue * 100) / 100,
            };
        }));
        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalBooks,
                    publishedBooks,
                    draftBooks,
                    totalUsers,
                    totalOrders,
                    completedOrders,
                    totalRevenue: Math.round(totalRevenue * 100) / 100,
                    currency: 'USD',
                    reviewsCount,
                },
                salesChart,
                topBooks: topBooks.filter((t) => t.book !== null),
                recentOrders,
                recentUsers,
            },
        });
    }
    /**
     * Admin Users list with spending and order stats
     */
    static async getAdminUsers(req, res) {
        const { search, role, status, page = '1', limit = '15' } = req.query;
        const queryObj = {};
        if (role && role !== 'all')
            queryObj.role = role;
        if (status && status !== 'all')
            queryObj.status = status;
        if (search && typeof search === 'string' && search.trim()) {
            const reg = new RegExp(search.trim(), 'i');
            queryObj.$or = [{ name: reg }, { email: reg }];
        }
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 15));
        const skip = (pageNum - 1) * limitNum;
        const [users, total] = await Promise.all([
            User_1.User.find(queryObj).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
            User_1.User.countDocuments(queryObj),
        ]);
        // Enhance users with order and spending summaries
        const enhancedUsers = await Promise.all(users.map(async (u) => {
            const [ordersCount, totalSpentAgg] = await Promise.all([
                Order_1.Order.countDocuments({ user: u._id, paymentStatus: 'completed' }),
                Order_1.Order.aggregate([
                    { $match: { user: u._id, paymentStatus: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
                ]),
            ]);
            return {
                ...u.toObject(),
                ordersCount,
                totalSpent: totalSpentAgg.length > 0 ? totalSpentAgg[0].total : 0,
            };
        }));
        res.status(200).json({
            success: true,
            data: enhancedUsers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    /**
     * Toggle user active/disabled status
     */
    static async toggleUserStatus(req, res) {
        const { id } = req.params;
        const { status } = req.body;
        if (!['active', 'disabled'].includes(status)) {
            res.status(400).json({ success: false, message: 'Invalid status value' });
            return;
        }
        const user = await User_1.User.findByIdAndUpdate(id, { status }, { new: true });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: `User status changed to ${status}`,
            data: user,
        });
    }
    /**
     * Single user deep detail
     */
    static async getUserDetail(req, res) {
        const { id } = req.params;
        const user = await User_1.User.findById(id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const [orders, progressList] = await Promise.all([
            Order_1.Order.find({ user: user._id }).populate('items.book').sort({ createdAt: -1 }),
            ReadingProgress_1.ReadingProgress.find({ user: user._id })
                .populate('book', 'title author coverImage')
                .populate('currentChapter', 'title')
                .sort({ lastReadAt: -1 }),
        ]);
        res.status(200).json({
            success: true,
            data: {
                user,
                orders,
                readingActivity: progressList,
            },
        });
    }
}
exports.AdminController = AdminController;

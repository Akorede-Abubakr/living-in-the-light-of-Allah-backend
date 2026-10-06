"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const env_1 = require("../config/env");
const storage_service_1 = require("../services/storage.service");
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ id: userId }, env_1.config.jwtSecret, {
        expiresIn: env_1.config.jwtExpiresIn,
    });
};
const sendTokenResponse = (user, statusCode, res, message) => {
    const token = generateToken(user._id.toString());
    const cookieOptions = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        httpOnly: true,
        secure: env_1.config.nodeEnv === 'production',
        sameSite: env_1.config.nodeEnv === 'production' ? 'none' : 'lax',
    };
    res.cookie('token', token, cookieOptions);
    res.status(statusCode).json({
        success: true,
        message,
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            createdAt: user.createdAt,
        },
    });
};
class AuthController {
    static async register(req, res) {
        const { name, email, password, confirmPassword } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
            return;
        }
        if (confirmPassword && password !== confirmPassword) {
            res.status(400).json({ success: false, message: 'Passwords do not match.' });
            return;
        }
        const existingUser = await User_1.User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            res.status(400).json({ success: false, message: 'An account with this email address already exists.' });
            return;
        }
        const user = await User_1.User.create({
            name,
            email: email.toLowerCase(),
            password,
            role: 'user',
        });
        sendTokenResponse(user, 201, res, 'Registration successful. Welcome to BrightMind Books!');
    }
    static async login(req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: 'Please provide an email and password.' });
            return;
        }
        const user = await User_1.User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            res.status(401).json({ success: false, message: 'Invalid email or password credentials.' });
            return;
        }
        if (user.status === 'disabled') {
            res.status(403).json({ success: false, message: 'Your account is disabled. Contact support.' });
            return;
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ success: false, message: 'Invalid email or password credentials.' });
            return;
        }
        sendTokenResponse(user, 200, res, 'Logged in successfully.');
    }
    static async logout(req, res) {
        res.cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true,
        });
        res.status(200).json({
            success: true,
            message: 'Logged out successfully.',
        });
    }
    static async getMe(req, res) {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Not authenticated.' });
            return;
        }
        res.status(200).json({
            success: true,
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                avatar: req.user.avatar,
                createdAt: req.user.createdAt,
            },
        });
    }
    static async updateProfile(req, res) {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Not authenticated.' });
            return;
        }
        const { name, avatar } = req.body;
        let avatarUrl = req.user.avatar;
        if (req.file) {
            avatarUrl = await storage_service_1.StorageService.uploadFile(req.file, 'avatars');
        }
        else if (avatar !== undefined) {
            avatarUrl = avatar;
        }
        const updatedUser = await User_1.User.findByIdAndUpdate(req.user._id, {
            name: name || req.user.name,
            avatar: avatarUrl,
        }, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            user: {
                id: updatedUser?._id,
                name: updatedUser?.name,
                email: updatedUser?.email,
                role: updatedUser?.role,
                avatar: updatedUser?.avatar,
            },
        });
    }
    static async changePassword(req, res) {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Not authenticated.' });
            return;
        }
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({ success: false, message: 'Please provide current and new password.' });
            return;
        }
        if (newPassword.length < 6) {
            res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
            return;
        }
        const user = await User_1.User.findById(req.user._id).select('+password');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            res.status(400).json({ success: false, message: 'Current password is incorrect.' });
            return;
        }
        user.password = newPassword;
        await user.save();
        sendTokenResponse(user, 200, res, 'Password updated successfully.');
    }
    static async forgotPassword(req, res) {
        const { email } = req.body;
        const user = await User_1.User.findOne({ email: email?.toLowerCase() });
        if (!user) {
            // Return success anyway for security timing protection
            res.status(200).json({
                success: true,
                message: 'If an account with that email exists, password reset instructions have been sent.',
            });
            return;
        }
        // In a production app, send reset email with token
        res.status(200).json({
            success: true,
            message: 'Password reset link sent to your email. (Demo: Use Reset Password with your new password)',
        });
    }
    static async resetPassword(req, res) {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) {
            res.status(400).json({ success: false, message: 'Please provide email and new password.' });
            return;
        }
        const user = await User_1.User.findOne({ email: email.toLowerCase() });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        user.password = newPassword;
        await user.save();
        sendTokenResponse(user, 200, res, 'Password has been reset successfully. You are now logged in.');
    }
}
exports.AuthController = AuthController;

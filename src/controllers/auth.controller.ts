import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { config } from '../config/env';
import { AuthRequest } from '../middlewares/auth';
import { StorageService } from '../services/storage.service';

const generateToken = (userId: string): string => {
  return jwt.sign({ id: userId }, config.jwtSecret as jwt.Secret, {
    expiresIn: config.jwtExpiresIn as any,
  });
};

const formatUserResponse = (user: any) => ({
  id: user._id || user.id,
  name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
  firstName: user.firstName || (user.name ? user.name.split(' ')[0] : ''),
  lastName: user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
  phoneNumber: user.phoneNumber || '',
  bio: user.bio || '',
  spiritualFocus: user.spiritualFocus || 'Quranic Wisdom & Classical Philosophy',
  city: user.city || '',
  country: user.country || '',
  preferredReadingMode: user.preferredReadingMode || 'paper',
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  createdAt: user.createdAt,
});

const sendTokenResponse = (user: IUser, statusCode: number, res: Response, message: string) => {
  const token = generateToken((user._id as any).toString());

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? ('none' as const) : ('lax' as const),
  };

  res.cookie('token', token, cookieOptions);

  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: formatUserResponse(user),
  });
};

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    const { firstName, lastName, phoneNumber, name, email, password, confirmPassword } = req.body;

    const resolvedFirstName = firstName?.trim() || (name ? name.trim().split(' ')[0] : '');
    const resolvedLastName = lastName?.trim() || (name ? name.trim().split(' ').slice(1).join(' ') : '');
    const resolvedName = name?.trim() || `${resolvedFirstName} ${resolvedLastName}`.trim();

    if (!resolvedFirstName || !email || !password) {
      res.status(400).json({ success: false, message: 'Please provide your first name, email, and password.' });
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

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'An account with this email address already exists.' });
      return;
    }

    const user = await User.create({
      name: resolvedName,
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      phoneNumber: phoneNumber?.trim() || '',
      email: email.toLowerCase(),
      password,
      role: 'user',
    });

    sendTokenResponse(user, 201, res, 'Registration successful. Welcome to Living in the light of Allah!');
  }

  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide an email and password.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
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

  static async logout(req: Request, res: Response): Promise<void> {
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  }

  static async getMe(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    res.status(200).json({
      success: true,
      user: formatUserResponse(req.user),
    });
  }

  static async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    const {
      name,
      firstName,
      lastName,
      phoneNumber,
      bio,
      spiritualFocus,
      city,
      country,
      preferredReadingMode,
      avatar,
    } = req.body;

    let avatarUrl = req.user.avatar;

    if (req.file) {
      avatarUrl = await StorageService.uploadFile(req.file, 'avatars');
    } else if (avatar !== undefined) {
      avatarUrl = avatar;
    }

    const resolvedFirstName = firstName !== undefined ? firstName.trim() : req.user.firstName;
    const resolvedLastName = lastName !== undefined ? lastName.trim() : req.user.lastName;
    const resolvedName =
      name !== undefined && name.trim()
        ? name.trim()
        : `${resolvedFirstName || ''} ${resolvedLastName || ''}`.trim() || req.user.name;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        name: resolvedName,
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        phoneNumber: phoneNumber !== undefined ? phoneNumber.trim() : req.user.phoneNumber,
        bio: bio !== undefined ? bio : req.user.bio,
        spiritualFocus: spiritualFocus !== undefined ? spiritualFocus : req.user.spiritualFocus,
        city: city !== undefined ? city : req.user.city,
        country: country !== undefined ? country : req.user.country,
        preferredReadingMode: preferredReadingMode !== undefined ? preferredReadingMode : req.user.preferredReadingMode,
        avatar: avatarUrl,
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: formatUserResponse(updatedUser),
    });
  }

  static async deleteAccount(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    await User.findByIdAndDelete(req.user._id);
    res.clearCookie('token');

    res.status(200).json({
      success: true,
      message: 'Your account and personal data have been permanently deleted.',
    });
  }

  static async changePassword(req: AuthRequest, res: Response): Promise<void> {
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

    const user = await User.findById(req.user._id).select('+password');
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

  static async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });

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

  static async resetPassword(req: Request, res: Response): Promise<void> {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      res.status(400).json({ success: false, message: 'Please provide email and new password.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res, 'Password has been reset successfully. You are now logged in.');
  }
}

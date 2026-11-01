import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { UserType } from '../models/user.js';
import Role, { ADMIN_TABS_LIST, TabAction } from '../models/role.js';
import { AuthRequest } from '../middleware/auth.js';

const generateToken = (userId: string, email: string, userType: string): string => {
    const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
    const expiresIn = process.env.JWT_EXPIRE || '24h';
    return jwt.sign({ id: userId, email, userType }, secret, { expiresIn: expiresIn as any });
};

/**
 * Admin / Team Member Login
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() })
            .select('+password')
            .populate('role');

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
            return;
        }

        if (!user.isActive) {
            res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact administrator.',
            });
            return;
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
            return;
        }

        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user._id.toString(), user.email, user.userType);

        // Sanitize response
        const userObj = user.toObject();
        delete userObj.password;

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: userObj,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Initial Admin Registration
 * Sets up Super Admin role with all tabs and actions if not present.
 */
export const registerAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { fullName, email, password, mobileNumber } = req.body;

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'A user with this email already exists',
            });
            return;
        }

        // Find or create Super Admin Role
        let adminRole = await Role.findOne({ name: 'Super Admin' });
        if (!adminRole) {
            const allPermissions = ADMIN_TABS_LIST.map((tab) => ({
                tab,
                actions: [TabAction.ALL, TabAction.CREATE, TabAction.READ, TabAction.UPDATE, TabAction.DELETE],
            }));

            adminRole = await Role.create({
                name: 'Super Admin',
                description: 'Full system access to all tabs and actions',
                permissions: allPermissions,
                isActive: true,
                isDeleted: false,
                deletedAt: null,
            });
        }

        const admin = await User.create({
            fullName,
            email: email.toLowerCase(),
            password,
            mobileNumber,
            role: adminRole._id,
            userType: UserType.ADMIN,
            isActive: true,
        });

        const token = generateToken(admin._id.toString(), admin.email, admin.userType);

        const adminObj = admin.toObject();
        delete adminObj.password;

        res.status(201).json({
            success: true,
            message: 'Admin account created successfully',
            data: {
                token,
                user: {
                    ...adminObj,
                    role: adminRole,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get current user profile
 */
export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                user: req.user,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Change current user password
 */
export const changePassword = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user?._id;

        const user = await User.findById(userId).select('+password');
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            res.status(400).json({
                success: false,
                message: 'Incorrect current password',
            });
            return;
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully',
        });
    } catch (error) {
        next(error);
    }
};


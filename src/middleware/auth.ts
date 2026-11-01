import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserType } from '../models/user.js';
import { IRole } from '../models/role.js';

export interface AuthenticatedUser extends Omit<IUser, 'role'> {
    role?: IRole;
}

export interface AuthRequest extends Request {
    user?: AuthenticatedUser;
}

interface JwtPayload {
    id: string;
    email: string;
    userType: string;
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Authentication required. No token provided.',
            });
            return;
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Authentication required. Invalid token format.',
            });
            return;
        }

        const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
        const decoded = jwt.verify(token, secret) as JwtPayload;

        const user = await User.findById(decoded.id).populate<{ role: IRole }>('role');

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'User belonging to this token no longer exists.',
            });
            return;
        }

        if (!user.isActive) {
            res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact administrator.',
            });
            return;
        }

        req.user = user as unknown as AuthenticatedUser;
        next();
    } catch (error: any) {
        if (error.name === 'JsonWebTokenError') {
            res.status(401).json({
                success: false,
                message: 'Invalid authorization token.',
            });
            return;
        }
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({
                success: false,
                message: 'Authorization token has expired.',
            });
            return;
        }
        next(error);
    }
};

/**
 * Permissions are evaluated frontend-side to show/hide tabs & actions.
 * Kept for flexibility and backwards compatibility.
 */
export const authorizePermission = (_tab?: string, _action?: string) => {
    return (_req: AuthRequest, _res: Response, next: NextFunction): void => {
        next();
    };
};

/**
 * Middleware requiring Admin userType
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required',
        });
        return;
    }

    if (
        req.user.userType !== UserType.ADMIN &&
        req.user.role?.name?.toLowerCase() !== 'admin' &&
        req.user.role?.name?.toLowerCase() !== 'super admin'
    ) {
        res.status(403).json({
            success: false,
            message: 'Access restricted to administrators only.',
        });
        return;
    }

    next();
};

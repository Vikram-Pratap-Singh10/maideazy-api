import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import ServiceProvider, { IProvider } from '../models/service.provider.js';

export interface ProviderAuthRequest extends Request {
    provider?: IProvider;
    providerId?: string;
}

interface ProviderJwtPayload {
    id: string;
    mobileNumber: string;
    role?: string;
    type?: string;
}

export const authenticateProvider = async (
    req: ProviderAuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Authentication required. No partner token provided.',
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
        const decoded = jwt.verify(token, secret) as ProviderJwtPayload;

        if (!decoded || !decoded.id) {
            res.status(401).json({
                success: false,
                message: 'Invalid partner token payload.',
            });
            return;
        }

        const provider = await ServiceProvider.findById(decoded.id).populate('registrationFee');
        if (!provider) {
            res.status(401).json({
                success: false,
                message: 'Partner profile not found or no longer exists.',
            });
            return;
        }

        if (provider.isActive === false) {
            res.status(403).json({
                success: false,
                message: 'Your partner account has been deactivated. Please contact support.',
            });
            return;
        }

        req.provider = provider;
        req.providerId = provider._id.toString();
        next();
    } catch (error: any) {
        if (error.name === 'JsonWebTokenError') {
            res.status(401).json({
                success: false,
                message: 'Invalid partner authorization token.',
            });
            return;
        }
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({
                success: false,
                message: 'Partner session expired. Please log in again.',
            });
            return;
        }
        next(error);
    }
};


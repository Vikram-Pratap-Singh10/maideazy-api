import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Subscription from '../models/subscription.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * Get all subscriptions with filters
 */
export const getAllSubscriptions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { planType, isActive, search } = req.query as any;

        const filter: Record<string, any> = {};

        if (planType) {
            filter.planType = planType;
        }

        if (isActive !== undefined) {
            filter.isActive = String(isActive) === 'true';
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            filter.$or = [{ title: regex }, { description: regex }, { serviceCategory: regex }];
        }

        const subscriptions = await Subscription.find(filter)
            .sort({ createdAt: -1 })
            .populate('createdBy', 'fullName email');

        res.status(200).json({
            success: true,
            data: {
                subscriptions,
                total: subscriptions.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single subscription by ID
 */
export const getSubscriptionById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid subscription ID' });
            return;
        }

        const subscription = await Subscription.findById(id).populate('createdBy', 'fullName email');

        if (!subscription) {
            res.status(404).json({ success: false, message: 'Subscription plan not found' });
            return;
        }

        res.status(200).json({
            success: true,
            data: { subscription },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new subscription plan
 */
export const createSubscription = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            title,
            description,
            planType,
            price,
            originalPrice,
            discountPercent,
            durationDays,
            features,
            serviceCategory,
            maxBookingsPerMonth,
            hoursPerVisit,
            isActive = true,
        } = req.body;

        const subscription = await Subscription.create({
            title,
            description,
            planType,
            price,
            originalPrice,
            discountPercent:
                discountPercent !== undefined
                    ? discountPercent
                    : originalPrice && originalPrice > price
                    ? Math.round(((originalPrice - price) / originalPrice) * 100)
                    : 0,
            durationDays,
            features: features || [],
            serviceCategory: serviceCategory || 'General Service',
            maxBookingsPerMonth,
            hoursPerVisit,
            isActive,
            createdBy: req.user?._id,
        });

        res.status(201).json({
            success: true,
            message: 'Subscription plan created successfully',
            data: { subscription },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a subscription plan
 */
export const updateSubscription = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid subscription ID' });
            return;
        }

        const updates = { ...req.body };

        if (updates.originalPrice && updates.price && updates.discountPercent === undefined) {
            updates.discountPercent = Math.max(
                0,
                Math.round(((updates.originalPrice - updates.price) / updates.originalPrice) * 100)
            );
        }

        const updated = await Subscription.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true,
        });

        if (!updated) {
            res.status(404).json({ success: false, message: 'Subscription plan not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Subscription plan updated successfully',
            data: { subscription: updated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Toggle status of a subscription plan
 */
export const toggleSubscriptionStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid subscription ID' });
            return;
        }

        const subscription = await Subscription.findById(id);
        if (!subscription) {
            res.status(404).json({ success: false, message: 'Subscription plan not found' });
            return;
        }

        subscription.isActive = !subscription.isActive;
        await subscription.save();

        res.status(200).json({
            success: true,
            message: `Subscription plan ${subscription.isActive ? 'activated' : 'deactivated'} successfully`,
            data: { subscription },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a subscription plan
 */
export const deleteSubscription = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid subscription ID' });
            return;
        }

        const deleted = await Subscription.findByIdAndDelete(id);

        if (!deleted) {
            res.status(404).json({ success: false, message: 'Subscription plan not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Subscription plan deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};


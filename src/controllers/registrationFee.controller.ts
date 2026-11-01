import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import RegistrationFee from '../models/registrationFee.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * Public: Get the currently active registration fee and its features
 * Used by Service Provider Mobile App / Website to display fee & benefits
 */
export const getActiveRegistrationFee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const fee = await RegistrationFee.findOne({ isActive: true }).sort({ updatedAt: -1 });

        if (!fee) {
            // Default fallback if not yet configured in DB
            const fallbackAmount = Number(process.env.PROVIDER_REGISTRATION_FEE || 499);
            res.status(200).json({
                success: true,
                data: {
                    fee: {
                        title: 'Service Provider Registration Fee',
                        amount: fallbackAmount,
                        originalAmount: 999,
                        currency: 'INR',
                        features: [
                            'Verified Service Provider Profile Badge',
                            'Direct Job Alerts in Your Preferred Locations',
                            'No Commission on Initial Bookings',
                            'Dedicated Support Team Access',
                        ],
                        description: 'One-time registration fee to activate provider account',
                        validityInDays: 365,
                        isActive: true,
                    },
                    isDefaultFallback: true,
                },
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                fee,
                isDefaultFallback: false,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Create or Update the Active Registration Fee & Features (Upsert)
 */
export const createOrUpdateActiveFee = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            title,
            amount,
            originalAmount,
            currency = 'INR',
            features = [],
            description,
            validityInDays = 365,
            isActive = true,
        } = req.body;

        const userId = req.user?._id;

        // Check if there is an existing active registration fee config
        let fee = await RegistrationFee.findOne({ isActive: true }).sort({ updatedAt: -1 });

        if (fee) {
            // Update existing active fee
            if (title !== undefined) fee.title = title;
            if (amount !== undefined) fee.amount = amount;
            if (originalAmount !== undefined) fee.originalAmount = originalAmount;
            if (currency !== undefined) fee.currency = currency;
            if (features !== undefined) fee.features = features;
            if (description !== undefined) fee.description = description;
            if (validityInDays !== undefined) fee.validityInDays = validityInDays;
            if (isActive !== undefined) fee.isActive = isActive;
            if (userId) fee.updatedBy = userId;

            await fee.save();

            res.status(200).json({
                success: true,
                message: 'Registration fee and features updated successfully',
                data: { fee },
            });
            return;
        }

        // Create new active fee
        fee = await RegistrationFee.create({
            title: title || 'Service Provider Registration Fee',
            amount,
            originalAmount,
            currency,
            features,
            description,
            validityInDays,
            isActive,
            createdBy: userId,
            updatedBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Registration fee and features created successfully',
            data: { fee },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Create a new Registration Fee configuration
 */
export const createRegistrationFee = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            title,
            amount,
            originalAmount,
            currency = 'INR',
            features = [],
            description,
            validityInDays = 365,
            isActive = true,
        } = req.body;

        const userId = req.user?._id;

        // If setting this one to active, optionally deactivate other previous ones
        if (isActive) {
            await RegistrationFee.updateMany({ isActive: true }, { isActive: false });
        }

        const fee = await RegistrationFee.create({
            title: title || 'Service Provider Registration Fee',
            amount,
            originalAmount,
            currency,
            features,
            description,
            validityInDays,
            isActive,
            createdBy: userId,
            updatedBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Registration fee configuration created successfully',
            data: { fee },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Get all Registration Fee configurations
 */
export const getAllRegistrationFees = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const fees = await RegistrationFee.find()
            .sort({ createdAt: -1 })
            .populate('createdBy', 'fullName email')
            .populate('updatedBy', 'fullName email');

        res.status(200).json({
            success: true,
            data: {
                fees,
                total: fees.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Get single Registration Fee by ID
 */
export const getRegistrationFeeById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Registration Fee ID format',
            });
            return;
        }

        const fee = await RegistrationFee.findById(id)
            .populate('createdBy', 'fullName email')
            .populate('updatedBy', 'fullName email');

        if (!fee) {
            res.status(404).json({
                success: false,
                message: 'Registration fee configuration not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: { fee },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Update Registration Fee by ID
 */
export const updateRegistrationFee = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body, updatedBy: req.user?._id };

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Registration Fee ID format',
            });
            return;
        }

        // If setting this one to active, deactivate others
        if (updateData.isActive === true) {
            await RegistrationFee.updateMany({ _id: { $ne: id }, isActive: true }, { isActive: false });
        }

        const fee = await RegistrationFee.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        })
            .populate('createdBy', 'fullName email')
            .populate('updatedBy', 'fullName email');

        if (!fee) {
            res.status(404).json({
                success: false,
                message: 'Registration fee configuration not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Registration fee configuration updated successfully',
            data: { fee },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Delete Registration Fee by ID
 */
export const deleteRegistrationFee = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Registration Fee ID format',
            });
            return;
        }

        const fee = await RegistrationFee.findByIdAndDelete(id);
        if (!fee) {
            res.status(404).json({
                success: false,
                message: 'Registration fee configuration not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Registration fee configuration deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import RegistrationFee from '../models/registrationFee.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * Public: Get the currently active registration fees and plans
 * Used by Service Provider Mobile App / Website to display fee & benefits
 */
export const getActiveRegistrationFee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        let fees = await RegistrationFee.find({ isActive: true }).sort({ isDefault: -1, amount: 1 });

        if (fees.length === 0) {
            // Seed initial Regular & Premium plans if none exist in DB
            const regular = await RegistrationFee.create({
                title: 'Regular Plan',
                planType: 'REGULAR',
                amount: 499,
                originalAmount: 999,
                currency: 'INR',
                salesPersonCommission: 50,
                features: [
                    'Verified Service Provider Profile Badge',
                    'Direct Job Alerts in Preferred Locations',
                    'Standard Customer Support Access',
                    'Profile Listing in MaidEazy Directory',
                ],
                description: 'Essential platform registration and verification for domestic helpers',
                validityInDays: 365,
                isActive: true,
                isDefault: true,
            });

            const premium = await RegistrationFee.create({
                title: 'Premium Plan',
                planType: 'PREMIUM',
                amount: 999,
                originalAmount: 1999,
                currency: 'INR',
                salesPersonCommission: 100,
                features: [
                    'Top Priority Placement & Gold Verified Badge',
                    'Instant High-Value Job Leads First',
                    'Dedicated Placement Manager Support',
                    'Free Profile Background Verification Certificate',
                    'Priority 24/7 Helpline Access',
                ],
                description: 'Featured placement with top job opportunities and personal relationship manager',
                validityInDays: 365,
                isActive: true,
                isDefault: false,
            });

            fees = [regular, premium];
        }

        const primaryFee = fees.find((f) => f.isDefault) || fees[0];

        res.status(200).json({
            success: true,
            data: {
                fee: primaryFee,
                plans: fees,
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
            planType = 'REGULAR',
            amount,
            originalAmount,
            currency = 'INR',
            salesPersonCommission = 50,
            features = [],
            description,
            validityInDays = 365,
            isActive = true,
            isDefault = false,
        } = req.body;

        const userId = req.user?._id;

        // Check if there is an existing active registration fee config with same title or default
        let fee = await RegistrationFee.findOne({ title }).sort({ updatedAt: -1 });

        if (isDefault) {
            await RegistrationFee.updateMany({ isDefault: true }, { isDefault: false });
        }

        if (fee) {
            if (title !== undefined) fee.title = title;
            if (planType !== undefined) fee.planType = planType;
            if (amount !== undefined) fee.amount = amount;
            if (originalAmount !== undefined) fee.originalAmount = originalAmount;
            if (currency !== undefined) fee.currency = currency;
            if (salesPersonCommission !== undefined) fee.salesPersonCommission = salesPersonCommission;
            if (features !== undefined) fee.features = features;
            if (description !== undefined) fee.description = description;
            if (validityInDays !== undefined) fee.validityInDays = validityInDays;
            if (isActive !== undefined) fee.isActive = isActive;
            if (isDefault !== undefined) fee.isDefault = isDefault;
            if (userId) fee.updatedBy = userId;

            await fee.save();

            res.status(200).json({
                success: true,
                message: 'Registration fee plan updated successfully',
                data: { fee },
            });
            return;
        }

        fee = await RegistrationFee.create({
            title: title || 'Regular Plan',
            planType,
            amount,
            originalAmount,
            currency,
            salesPersonCommission,
            features,
            description,
            validityInDays,
            isActive,
            isDefault,
            createdBy: userId,
            updatedBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Registration fee plan created successfully',
            data: { fee },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Create a new Registration Fee Plan
 * Multiple plans (Regular, Premium, etc.) can be created and kept active simultaneously.
 */
export const createRegistrationFee = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            title,
            planType = 'REGULAR',
            amount,
            originalAmount,
            currency = 'INR',
            salesPersonCommission = 50,
            features = [],
            description,
            validityInDays = 365,
            isActive = true,
            isDefault = false,
        } = req.body;

        const userId = req.user?._id;

        // If marked as default, clear default on other plans
        if (isDefault) {
            await RegistrationFee.updateMany({ isDefault: true }, { isDefault: false });
        }

        const fee = await RegistrationFee.create({
            title: title || 'Regular Plan',
            planType,
            amount,
            originalAmount,
            currency,
            salesPersonCommission,
            features,
            description,
            validityInDays,
            isActive,
            isDefault,
            createdBy: userId,
            updatedBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Registration fee plan created successfully',
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
        let fees = await RegistrationFee.find()
            .sort({ isDefault: -1, createdAt: -1 })
            .populate('createdBy', 'fullName email')
            .populate('updatedBy', 'fullName email');

        // If no fees exist, seed the standard Regular and Premium plans
        if (fees.length === 0) {
            const regular = await RegistrationFee.create({
                title: 'Regular Plan',
                planType: 'REGULAR',
                amount: 499,
                originalAmount: 999,
                currency: 'INR',
                salesPersonCommission: 50,
                features: [
                    'Verified Service Provider Profile Badge',
                    'Direct Job Alerts in Preferred Locations',
                    'Standard Customer Support Access',
                    'Profile Listing in MaidEazy Directory',
                ],
                description: 'Essential platform registration and verification for domestic helpers',
                validityInDays: 365,
                isActive: true,
                isDefault: true,
                createdBy: req.user?._id,
            });

            const premium = await RegistrationFee.create({
                title: 'Premium Plan',
                planType: 'PREMIUM',
                amount: 999,
                originalAmount: 1999,
                currency: 'INR',
                salesPersonCommission: 100,
                features: [
                    'Top Priority Placement & Gold Verified Badge',
                    'Instant High-Value Job Leads First',
                    'Dedicated Placement Manager Support',
                    'Free Profile Background Verification Certificate',
                    'Priority 24/7 Helpline Access',
                ],
                description: 'Featured placement with top job opportunities and personal relationship manager',
                validityInDays: 365,
                isActive: true,
                isDefault: false,
                createdBy: req.user?._id,
            });

            fees = [regular, premium];
        }

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

        // If setting this one as default, unset default on others
        if (updateData.isDefault === true) {
            await RegistrationFee.updateMany({ _id: { $ne: id }, isDefault: true }, { isDefault: false });
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
            message: 'Registration fee plan updated successfully',
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

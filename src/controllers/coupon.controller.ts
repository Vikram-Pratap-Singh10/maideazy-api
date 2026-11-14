import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Coupon, { ICoupon } from '../models/coupon.js';
import RegistrationFee from '../models/registrationFee.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * 1. Admin: Create a new Coupon / Offer
 */
export const createCoupon = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            code,
            title,
            description,
            discountType = 'FLAT',
            discountAmount,
            applicablePlans = [],
            minOrderAmount = 0,
            maxDiscountAmount,
            maxUses,
            validFrom,
            validTill,
            isActive = true,
        } = req.body;

        const normalizedCode = String(code).trim().toUpperCase();

        // Check for existing coupon with the same code
        const existingCoupon = await Coupon.findOne({ code: normalizedCode });
        if (existingCoupon) {
            res.status(409).json({
                success: false,
                message: `Coupon code "${normalizedCode}" already exists`,
            });
            return;
        }

        // Validate applicable plan IDs if provided
        if (Array.isArray(applicablePlans) && applicablePlans.length > 0) {
            const validPlans = await RegistrationFee.find({
                _id: { $in: applicablePlans.map((id: string) => new Types.ObjectId(id)) },
            });
            if (validPlans.length !== applicablePlans.length) {
                res.status(400).json({
                    success: false,
                    message: 'One or more selected registration fee plans are invalid',
                });
                return;
            }
        }

        const coupon = await Coupon.create({
            code: normalizedCode,
            title: title || normalizedCode,
            description,
            discountType,
            discountAmount,
            applicablePlans: applicablePlans.map((id: string) => new Types.ObjectId(id)),
            minOrderAmount,
            maxDiscountAmount: maxDiscountAmount || null,
            maxUses: maxUses || null,
            validFrom: validFrom ? new Date(validFrom) : null,
            validTill: validTill ? new Date(validTill) : null,
            isActive,
            createdBy: req.user?._id || null,
        });

        const populatedCoupon = await Coupon.findById(coupon._id)
            .populate('applicablePlans', 'title planType amount')
            .populate('createdBy', 'fullName email');

        res.status(201).json({
            success: true,
            message: 'Coupon code created successfully',
            data: {
                coupon: populatedCoupon,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 2. Admin: Get all Coupons (with optional search and filters)
 */
export const getAllCoupons = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { search, isActive, planId } = req.query;

        const filter: Record<string, any> = {};

        if (isActive !== undefined) {
            filter.isActive = String(isActive) === 'true';
        }

        if (search) {
            const searchRegex = new RegExp(String(search).trim(), 'i');
            filter.$or = [{ code: searchRegex }, { title: searchRegex }, { description: searchRegex }];
        }

        if (planId && Types.ObjectId.isValid(String(planId))) {
            filter.$or = [
                { applicablePlans: { $size: 0 } }, // applicable to all
                { applicablePlans: new Types.ObjectId(String(planId)) },
            ];
        }

        const coupons = await Coupon.find(filter)
            .populate('applicablePlans', 'title planType amount currency')
            .populate('createdBy', 'fullName email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                coupons,
                total: coupons.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 3. Admin: Get single Coupon by ID
 */
export const getCouponById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const coupon = await Coupon.findById(id)
            .populate('applicablePlans', 'title planType amount currency')
            .populate('createdBy', 'fullName email');

        if (!coupon) {
            res.status(404).json({
                success: false,
                message: 'Coupon not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: { coupon },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 4. Admin: Update Coupon
 */
export const updateCoupon = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const coupon = await Coupon.findById(id);
        if (!coupon) {
            res.status(404).json({
                success: false,
                message: 'Coupon not found',
            });
            return;
        }

        // Check code uniqueness if code is being updated
        if (updates.code) {
            const normalizedCode = String(updates.code).trim().toUpperCase();
            if (normalizedCode !== coupon.code) {
                const existing = await Coupon.findOne({
                    code: normalizedCode,
                    _id: { $ne: coupon._id },
                });
                if (existing) {
                    res.status(409).json({
                        success: false,
                        message: `Coupon code "${normalizedCode}" is already in use`,
                    });
                    return;
                }
                coupon.code = normalizedCode;
            }
        }

        if (updates.title !== undefined) coupon.title = updates.title;
        if (updates.description !== undefined) coupon.description = updates.description;
        if (updates.discountType !== undefined) coupon.discountType = updates.discountType;
        if (updates.discountAmount !== undefined) coupon.discountAmount = updates.discountAmount;
        if (updates.minOrderAmount !== undefined) coupon.minOrderAmount = updates.minOrderAmount;
        if (updates.maxDiscountAmount !== undefined) coupon.maxDiscountAmount = updates.maxDiscountAmount;
        if (updates.maxUses !== undefined) coupon.maxUses = updates.maxUses;
        if (updates.validFrom !== undefined) coupon.validFrom = updates.validFrom ? new Date(updates.validFrom) : null;
        if (updates.validTill !== undefined) coupon.validTill = updates.validTill ? new Date(updates.validTill) : null;
        if (updates.isActive !== undefined) coupon.isActive = updates.isActive;

        if (updates.applicablePlans !== undefined) {
            if (Array.isArray(updates.applicablePlans)) {
                coupon.applicablePlans = updates.applicablePlans.map(
                    (pId: string) => new Types.ObjectId(pId)
                );
            }
        }

        coupon.updatedBy = req.user?._id || null;
        await coupon.save();

        const populated = await Coupon.findById(coupon._id)
            .populate('applicablePlans', 'title planType amount currency')
            .populate('createdBy', 'fullName email')
            .populate('updatedBy', 'fullName email');

        res.status(200).json({
            success: true,
            message: 'Coupon updated successfully',
            data: { coupon: populated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 5. Admin: Delete Coupon
 */
export const deleteCoupon = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const coupon = await Coupon.findByIdAndDelete(id);
        if (!coupon) {
            res.status(404).json({
                success: false,
                message: 'Coupon not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Coupon "${coupon.code}" deleted successfully`,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 6. Public / Partner: Validate Coupon Code against selected Plan and Amount
 * Endpoint: POST /api/v1/coupons/validate
 */
export const validateCoupon = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { code, planId, amount } = req.body;

        if (!code || typeof code !== 'string') {
            res.status(400).json({
                success: false,
                valid: false,
                message: 'Please enter a coupon code',
            });
            return;
        }

        const normalizedCode = code.trim().toUpperCase();

        // 1. Find coupon
        const coupon = await Coupon.findOne({ code: normalizedCode }).populate(
            'applicablePlans',
            'title planType amount'
        );

        if (!coupon) {
            res.status(404).json({
                success: false,
                valid: false,
                message: `Invalid coupon code "${normalizedCode}". Please check and try again.`,
            });
            return;
        }

        // 2. Active status
        if (!coupon.isActive) {
            res.status(400).json({
                success: false,
                valid: false,
                message: `Coupon "${normalizedCode}" is currently inactive.`,
            });
            return;
        }

        const now = new Date();

        // 3. Validity start date
        if (coupon.validFrom && now < new Date(coupon.validFrom)) {
            res.status(400).json({
                success: false,
                valid: false,
                message: `Coupon "${normalizedCode}" is not active yet.`,
            });
            return;
        }

        // 4. Expiry date
        if (coupon.validTill && now > new Date(coupon.validTill)) {
            res.status(400).json({
                success: false,
                valid: false,
                message: `Coupon "${normalizedCode}" has expired.`,
            });
            return;
        }

        // 5. Max uses limit
        if (coupon.maxUses && coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
            res.status(400).json({
                success: false,
                valid: false,
                message: `Coupon "${normalizedCode}" has reached its maximum usage limit.`,
            });
            return;
        }

        // 6. Check plan applicability
        if (coupon.applicablePlans && coupon.applicablePlans.length > 0) {
            if (!planId) {
                res.status(400).json({
                    success: false,
                    valid: false,
                    message: `Please select a registration plan to apply coupon "${normalizedCode}".`,
                });
                return;
            }

            const targetPlanIdStr = String(planId);
            const isPlanApplicable = coupon.applicablePlans.some((plan: any) => {
                const pid = plan._id ? plan._id.toString() : plan.toString();
                return pid === targetPlanIdStr;
            });

            if (!isPlanApplicable) {
                const planNames = coupon.applicablePlans
                    .map((p: any) => p.title || 'selected plan')
                    .join(', ');

                res.status(400).json({
                    success: false,
                    valid: false,
                    message: `Coupon "${normalizedCode}" is not applicable to the selected plan. It only applies to: ${planNames}.`,
                });
                return;
            }
        }

        // 7. Calculate base amount
        let currentAmount = Number(amount) || 0;
        if (currentAmount <= 0 && planId && Types.ObjectId.isValid(planId)) {
            const planDoc = await RegistrationFee.findById(planId);
            if (planDoc) {
                currentAmount = planDoc.amount;
            }
        }
        if (currentAmount <= 0) {
            currentAmount = 499;
        }

        // Check minimum order amount
        if (coupon.minOrderAmount && currentAmount < coupon.minOrderAmount) {
            res.status(400).json({
                success: false,
                valid: false,
                message: `Coupon "${normalizedCode}" requires a minimum plan amount of ₹${coupon.minOrderAmount}.`,
            });
            return;
        }

        // 8. Calculate discount
        let discount = 0;
        if (coupon.discountType === 'PERCENTAGE') {
            discount = Math.round((currentAmount * coupon.discountAmount) / 100);
            if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
                discount = coupon.maxDiscountAmount;
            }
        } else {
            // FLAT discount
            discount = coupon.discountAmount;
        }

        // Discount cannot exceed current payable amount
        discount = Math.min(discount, currentAmount);
        const finalAmount = Math.max(0, currentAmount - discount);

        res.status(200).json({
            success: true,
            valid: true,
            message: `Coupon "${coupon.code}" applied! You saved ₹${discount}`,
            data: {
                couponId: coupon._id,
                code: coupon.code,
                title: coupon.title,
                discountType: coupon.discountType,
                discountAmount: discount,
                originalDiscountValue: coupon.discountAmount,
                finalAmount,
                applicablePlans: coupon.applicablePlans.map((p: any) => (p._id ? p._id.toString() : p.toString())),
            },
        });
    } catch (error) {
        next(error);
    }
};

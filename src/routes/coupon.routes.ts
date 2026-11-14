import { Router } from 'express';
import {
    createCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    validateCoupon,
} from '../controllers/coupon.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
    createCouponSchema,
    updateCouponSchema,
    validateCouponSchema,
    couponIdParamSchema,
} from '../validations/coupon.validation.js';

const router = Router();

// Public route: Validate a coupon code for service provider registration / plan checkout
router.post('/validate', validateBody(validateCouponSchema), validateCoupon);

// Protected routes (Admin operations)
router.use(authenticate);

// Admin: Get all coupons
router.get('/', getAllCoupons);

// Admin: Create a new coupon / offer
router.post('/', validateBody(createCouponSchema), createCoupon);

// Admin: Get coupon by ID
router.get('/:id', validateParams(couponIdParamSchema), getCouponById);

// Admin: Update coupon by ID
router.put(
    '/:id',
    validateParams(couponIdParamSchema),
    validateBody(updateCouponSchema),
    updateCoupon
);

// Admin: Delete coupon by ID
router.delete('/:id', validateParams(couponIdParamSchema), deleteCoupon);

export default router;

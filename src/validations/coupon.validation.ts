import { z } from 'zod';

export const createCouponSchema = z.object({
    code: z
        .string()
        .trim()
        .min(2, 'Coupon code must be at least 2 characters')
        .max(30, 'Coupon code must not exceed 30 characters')
        .transform((val) => val.toUpperCase()),
    title: z.string().trim().optional(),
    description: z.string().trim().optional(),
    discountType: z.enum(['FLAT', 'PERCENTAGE']).default('FLAT').optional(),
    discountAmount: z.number().positive('Discount amount must be greater than 0'),
    applicablePlans: z
        .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Plan ID format'))
        .default([])
        .optional(),
    minOrderAmount: z.number().nonnegative('Minimum order amount cannot be negative').default(0).optional(),
    maxDiscountAmount: z.number().positive('Maximum discount amount must be greater than 0').optional().nullable(),
    maxUses: z.number().int().nonnegative('Max uses cannot be negative').optional().nullable(),
    validFrom: z.string().datetime().optional().nullable().or(z.date().optional()),
    validTill: z.string().datetime().optional().nullable().or(z.date().optional()),
    isActive: z.boolean().default(true).optional(),
});

export const updateCouponSchema = z.object({
    code: z
        .string()
        .trim()
        .min(2, 'Coupon code must be at least 2 characters')
        .max(30, 'Coupon code must not exceed 30 characters')
        .transform((val) => val.toUpperCase())
        .optional(),
    title: z.string().trim().optional(),
    description: z.string().trim().optional(),
    discountType: z.enum(['FLAT', 'PERCENTAGE']).optional(),
    discountAmount: z.number().positive('Discount amount must be greater than 0').optional(),
    applicablePlans: z
        .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Plan ID format'))
        .optional(),
    minOrderAmount: z.number().nonnegative('Minimum order amount cannot be negative').optional(),
    maxDiscountAmount: z.number().positive('Maximum discount amount must be greater than 0').optional().nullable(),
    maxUses: z.number().int().nonnegative('Max uses cannot be negative').optional().nullable(),
    validFrom: z.string().datetime().optional().nullable().or(z.date().optional()),
    validTill: z.string().datetime().optional().nullable().or(z.date().optional()),
    isActive: z.boolean().optional(),
});

export const validateCouponSchema = z.object({
    code: z.string().trim().min(1, 'Coupon code is required'),
    planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Plan ID format').optional(),
    amount: z.number().nonnegative('Amount cannot be negative').optional(),
});

export const couponIdParamSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Coupon ID format'),
});

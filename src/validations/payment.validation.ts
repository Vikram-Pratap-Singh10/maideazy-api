import { z } from 'zod';

export const createRegistrationOrderSchema = z.object({
    providerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Provider ID format'),
    planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Plan ID format').optional(),
    amount: z.number().positive('Amount must be greater than 0').optional(),
});

export const verifyPaymentSchema = z.object({
    providerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Provider ID format'),
    razorpay_order_id: z.string().trim().min(1, 'razorpay_order_id is required'),
    razorpay_payment_id: z.string().trim().min(1, 'razorpay_payment_id is required'),
    razorpay_signature: z.string().trim().min(1, 'razorpay_signature is required'),
});

export const paymentQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),
    status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']).optional(),
    providerId: z.string().optional(),
});


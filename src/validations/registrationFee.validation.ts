import { z } from 'zod';

export const createRegistrationFeeSchema = z.object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').default('Service Provider Registration Fee').optional(),
    amount: z.number().positive('Amount must be greater than 0'),
    originalAmount: z.number().nonnegative('Original amount cannot be negative').optional(),
    currency: z.string().trim().default('INR').optional(),
    features: z
        .array(z.string().trim().min(1, 'Feature description cannot be empty'))
        .default([]),
    description: z.string().trim().optional(),
    validityInDays: z.number().int().nonnegative().default(365).optional(),
    isActive: z.boolean().default(true).optional(),
});

export const updateRegistrationFeeSchema = z.object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').optional(),
    amount: z.number().positive('Amount must be greater than 0').optional(),
    originalAmount: z.number().nonnegative('Original amount cannot be negative').optional(),
    currency: z.string().trim().optional(),
    features: z
        .array(z.string().trim().min(1, 'Feature description cannot be empty'))
        .optional(),
    description: z.string().trim().optional(),
    validityInDays: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
});

export const registrationFeeIdParamSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Registration Fee ID format'),
});


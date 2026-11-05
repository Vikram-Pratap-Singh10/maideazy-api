import { z } from 'zod';

export const createRegistrationFeeSchema = z.object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').default('Regular Plan').optional(),
    planType: z.string().trim().default('REGULAR').optional(),
    amount: z.number().nonnegative('Amount must be non-negative'),
    originalAmount: z.number().nonnegative('Original amount cannot be negative').optional(),
    currency: z.string().trim().default('INR').optional(),
    salesPersonCommission: z.number().nonnegative('Salesperson commission cannot be negative').default(50).optional(),
    features: z
        .array(z.string().trim().min(1, 'Feature description cannot be empty'))
        .default([]),
    description: z.string().trim().optional(),
    validityInDays: z.number().int().nonnegative().default(365).optional(),
    isActive: z.boolean().default(true).optional(),
    isDefault: z.boolean().default(false).optional(),
});

export const updateRegistrationFeeSchema = z.object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').optional(),
    planType: z.string().trim().optional(),
    amount: z.number().nonnegative('Amount must be non-negative').optional(),
    originalAmount: z.number().nonnegative('Original amount cannot be negative').optional(),
    currency: z.string().trim().optional(),
    salesPersonCommission: z.number().nonnegative('Salesperson commission cannot be negative').optional(),
    features: z
        .array(z.string().trim().min(1, 'Feature description cannot be empty'))
        .optional(),
    description: z.string().trim().optional(),
    validityInDays: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
});

export const registrationFeeIdParamSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Registration Fee ID format'),
});


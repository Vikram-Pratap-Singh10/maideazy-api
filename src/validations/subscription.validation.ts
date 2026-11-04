import { z } from 'zod';
import { PlanType } from '../models/subscription.js';

export const createSubscriptionSchema = z.object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters'),
    description: z.string().trim().optional(),
    planType: z.nativeEnum(PlanType).default(PlanType.MONTHLY),
    price: z.number().min(0, 'Price must be non-negative'),
    originalPrice: z.number().min(0).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    durationDays: z.number().min(1, 'Duration must be at least 1 day').default(30),
    features: z.array(z.string()).default([]),
    serviceCategory: z.string().trim().optional(),
    maxBookingsPerMonth: z.number().min(0).optional(),
    hoursPerVisit: z.number().min(0).optional(),
    isActive: z.boolean().default(true).optional(),
});

export const updateSubscriptionSchema = z.object({
    title: z.string().trim().min(2).optional(),
    description: z.string().trim().optional(),
    planType: z.nativeEnum(PlanType).optional(),
    price: z.number().min(0).optional(),
    originalPrice: z.number().min(0).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    durationDays: z.number().min(1).optional(),
    features: z.array(z.string()).optional(),
    serviceCategory: z.string().trim().optional(),
    maxBookingsPerMonth: z.number().min(0).optional(),
    hoursPerVisit: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
});

export const subscriptionIdParamSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Subscription ID format'),
});


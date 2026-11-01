import { z } from 'zod';
import {
    Gender,
    JobRole,
    WorkType,
    ProviderApprovalStatus,
    PaymentStatus,
} from '../models/service.provider.js';

export const preferredLocationSchema = z.object({
    pinCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit PIN code'),
    city: z.string().trim().min(2, 'City name is required'),
});

export const registerServiceProviderSchema = z.object({
    referenceCode: z.string().trim().toUpperCase().optional(),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    mobileNumber: z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'),
    dateOfBirth: z.coerce.date({
        message: 'Please enter a valid date of birth',
    }),
    gender: z.nativeEnum(Gender, {
        message: 'Gender must be Male, Female, or Other',
    }),
    residentialAddress: z.string().trim().min(5, 'Residential address is required'),
    city: z.string().trim().min(2, 'City is required'),
    pinCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit PIN code'),
    jobRoles: z
        .array(z.nativeEnum(JobRole))
        .min(1, 'Select at least one job role'),
    preferredLocations: z
        .array(preferredLocationSchema)
        .min(1, 'At least one preferred location is required'),
    workTypes: z
        .array(z.nativeEnum(WorkType))
        .min(1, 'Select at least one work type'),
    expectedSalary: z.number().nonnegative('Expected salary must be a positive number').optional(),
    education: z.string().trim().optional(),
    experience: z.string().trim().optional(),
});

export const updateServiceProviderSchema = z.object({
    referenceCode: z.string().trim().toUpperCase().optional(),
    fullName: z.string().trim().min(2).optional(),
    mobileNumber: z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number')
        .optional(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.nativeEnum(Gender).optional(),
    residentialAddress: z.string().trim().min(5).optional(),
    city: z.string().trim().min(2).optional(),
    pinCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit PIN code').optional(),
    jobRoles: z.array(z.nativeEnum(JobRole)).min(1).optional(),
    preferredLocations: z.array(preferredLocationSchema).min(1).optional(),
    workTypes: z.array(z.nativeEnum(WorkType)).min(1).optional(),
    expectedSalary: z.number().nonnegative().optional(),
    education: z.string().trim().optional(),
    experience: z.string().trim().optional(),
    isActive: z.boolean().optional(),
});

export const updateProviderStatusSchema = z.object({
    status: z.nativeEnum(ProviderApprovalStatus, {
        message: 'Status must be PENDING, APPROVED, or REJECTED',
    }),
});

export const updateProviderPaymentStatusSchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus, {
        message: 'Payment status must be PENDING, SUCCESS, FAILED, or REFUNDED',
    }),
});

export const providerQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),
    search: z.string().trim().optional(),
    status: z.nativeEnum(ProviderApprovalStatus).optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    jobRole: z.string().optional(),
    city: z.string().optional(),
    pinCode: z.string().optional(),
    referenceCode: z.string().trim().toUpperCase().optional(),
    salesPersonId: z.string().optional(),
    isActive: z
        .string()
        .transform((val) => val === 'true')
        .optional(),
});

export const providerIdParamSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Provider ID format'),
});

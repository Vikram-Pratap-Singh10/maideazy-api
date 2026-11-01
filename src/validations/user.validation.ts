import { z } from 'zod';
import { UserType } from '../models/user.js';

export const locationSchema = z.object({
    type: z.literal('Point').default('Point').optional(),
    coordinates: z.array(z.number()).length(2).optional(), // [longitude, latitude]
    address: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    pinCode: z.string().trim().optional(),
    landmark: z.string().trim().optional(),
});

export const registerAppUserSchema = z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    email: z.string().trim().email('Please enter a valid email address'),
    mobileNumber: z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number')
        .optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    location: locationSchema.optional(),
});

export const createTeamMemberSchema = z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    email: z.string().trim().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    mobileNumber: z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number')
        .optional(),
    roleId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Role ID format'),
    userType: z
        .nativeEnum(UserType)
        .default(UserType.SALES_PERSON)
        .optional(),
    referencePrefix: z
        .string()
        .trim()
        .min(2)
        .max(6)
        .regex(/^[A-Za-z]+$/, 'Prefix must contain letters only')
        .optional(),
    location: locationSchema.optional(),
});

export const updateTeamMemberSchema = z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').optional(),
    email: z.string().trim().email('Please enter a valid email address').optional(),
    mobileNumber: z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number')
        .optional(),
    roleId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Role ID format').optional(),
    location: locationSchema.optional(),
    isActive: z.boolean().optional(),
});

export const teamMemberQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),
    search: z.string().trim().optional(),
    roleId: z.string().optional(),
    userType: z.string().optional(),
    isActive: z
        .string()
        .transform((val) => val === 'true')
        .optional(),
});

export const userIdParamSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid User ID format'),
});

export const referenceCodeParamSchema = z.object({
    code: z.string().trim().min(3, 'Reference code is too short'),
});

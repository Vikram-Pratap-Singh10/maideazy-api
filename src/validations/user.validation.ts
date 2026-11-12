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

export const createSalesPartnerSchema = z.object({
    // 1. Personal Details
    fullName: z.string().trim().min(2, 'Full Name is required'),
    mobileNumber: z.string().trim().regex(/^[6-9]\d{9}$/, 'Valid 10-digit mobile number is required'),
    email: z.string().trim().email('Valid email address is required'),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),

    // 2. Complete Address Details
    flatNumber: z.string().trim().min(1, 'Flat / House Number is required'),
    buildingName: z.string().trim().min(1, 'Building / House Name is required'),
    roadName: z.string().trim().optional(),
    localArea: z.string().trim().min(1, 'Local Area is required'),
    landmark: z.string().trim().optional(),
    city: z.string().trim().min(1, 'City is required'),
    state: z.string().trim().min(1, 'State is required'),
    pinCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Valid 6-digit PIN code is required'),

    // 3. Professional Details
    hasSalesExperience: z.union([z.boolean(), z.string().transform((v) => v === 'Yes' || v === 'true')]).default(false),
    previousExperience: z.string().trim().optional(),
    languagesKnown: z.union([z.array(z.string()), z.string().transform((s) => s.split(',').map((x) => x.trim()))]),
    hasSmartphone: z.union([z.boolean(), z.string().transform((v) => v === 'Yes' || v === 'true')]).default(true),

    // 4. Identity Verification & Document Upload
    panCardNumber: z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, 'Valid PAN Card Number is required'),
    panCardImage: z.string().trim().min(1, 'PAN Card Image is required'),
    aadhaarNumber: z.string().trim().optional(),
    aadhaarDocument: z.string().trim().optional(),
    passportPhoto: z.string().trim().min(1, 'Passport-Size Photograph is required'),

    // 5. Bank Account Details
    accountHolderName: z.string().trim().min(1, 'Account Holder Name is required'),
    bankName: z.string().trim().min(1, 'Bank Name is required'),
    accountNumber: z.string().trim().min(1, 'Bank Account Number is required'),
    ifscCode: z.string().trim().regex(/^[A-Za-z]{4}0[A-Z0-9a-z]{6}$/, 'Valid IFSC code is required'),
    branchName: z.string().trim().min(1, 'Branch Name is required'),
    bankDocumentType: z.string().trim().default('Bank Passbook'),
    bankDocument: z.string().trim().min(1, 'Bank Document is required'),

    // 7. Declaration
    declarationAccepted: z.boolean().refine((val) => val === true, 'You must agree and confirm the declaration'),
    approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('APPROVED').optional(),
    roleId: z.string().optional(),
});

export const updateSalesPartnerSchema = z.object({
    fullName: z.string().trim().min(2).optional(),
    mobileNumber: z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
    email: z.string().trim().email().optional(),
    flatNumber: z.string().trim().optional(),
    buildingName: z.string().trim().optional(),
    roadName: z.string().trim().optional(),
    localArea: z.string().trim().optional(),
    landmark: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    pinCode: z.string().trim().optional(),
    hasSalesExperience: z.boolean().optional(),
    previousExperience: z.string().trim().optional(),
    languagesKnown: z.union([z.array(z.string()), z.string().transform((s) => s.split(',').map((x) => x.trim()))]).optional(),
    hasSmartphone: z.boolean().optional(),
    panCardNumber: z.string().trim().optional(),
    panCardImage: z.string().trim().optional(),
    aadhaarNumber: z.string().trim().optional(),
    aadhaarDocument: z.string().trim().optional(),
    passportPhoto: z.string().trim().optional(),
    accountHolderName: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
    accountNumber: z.string().trim().optional(),
    ifscCode: z.string().trim().optional(),
    branchName: z.string().trim().optional(),
    bankDocumentType: z.string().trim().optional(),
    bankDocument: z.string().trim().optional(),
    declarationAccepted: z.boolean().optional(),
    approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    statusNotes: z.string().trim().optional(),
    isActive: z.boolean().optional(),
});

export const teamMemberQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(10000).default(10).optional(),
    search: z.string().trim().optional(),
    roleId: z.string().optional(),
    userType: z.string().optional(),
    isActive: z
        .string()
        .transform((val) => val === 'true')
        .optional(),
    approvalStatus: z.string().optional(),
});

export const userIdParamSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid User ID format'),
});

export const referenceCodeParamSchema = z.object({
    code: z.string().trim().min(3, 'Reference code is too short'),
});

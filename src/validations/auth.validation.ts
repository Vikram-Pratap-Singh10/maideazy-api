import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().trim().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
});

export const registerAdminSchema = z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    email: z.string().trim().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    mobileNumber: z
        .string()
        .trim()
        .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number')
        .optional(),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});


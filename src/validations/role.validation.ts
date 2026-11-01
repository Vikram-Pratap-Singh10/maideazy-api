import { z } from 'zod';

export const createRoleSchema = z.object({
    name: z.string().trim().min(2, 'Role name must be at least 2 characters').max(50),
    description: z.string().trim().max(250).optional(),
    permissions: z.array(z.any()).default([]),
    isActive: z.boolean().optional(),
});

export const updateRoleSchema = z.object({
    name: z.string().trim().min(2, 'Role name must be at least 2 characters').max(50).optional(),
    description: z.string().trim().max(250).optional(),
    permissions: z.array(z.any()).optional(),
    isActive: z.boolean().optional(),
});

export const roleIdParamSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Role ID format'),
});

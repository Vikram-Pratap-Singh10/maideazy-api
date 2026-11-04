import { Router } from 'express';
import {
    registerProvider,
    createProviderByAdmin,
    getProviderPublicStatus,
    getAllProviders,
    getProviderById,
    updateProvider,
    updateProviderStatus,
    updateProviderPaymentStatus,
    deleteProvider,
    getProviderStats,
} from '../controllers/serviceProvider.controller.js';
import { authenticate } from '../middleware/auth.js';
import {
    validate,
    validateBody,
    validateParams,
    validateQuery,
} from '../middleware/validate.js';
import {
    registerServiceProviderSchema,
    adminCreateServiceProviderSchema,
    updateServiceProviderSchema,
    updateProviderStatusSchema,
    updateProviderPaymentStatusSchema,
    providerQuerySchema,
    providerIdParamSchema,
} from '../validations/serviceProvider.validation.js';

const router = Router();

// Public registration endpoint for Service Providers
router.post(
    '/register',
    validateBody(registerServiceProviderSchema),
    registerProvider
);

// Public status check for candidate payment / registration confirmation
router.get(
    '/:id/public-status',
    validateParams(providerIdParamSchema),
    getProviderPublicStatus
);

// Protected routes (requires authentication)
router.use(authenticate);

// Provider summary statistics for dashboard
router.get(
    '/stats/summary',
    getProviderStats
);

// Admin creates a service provider directly
router.post(
    '/',
    validateBody(adminCreateServiceProviderSchema),
    createProviderByAdmin
);

// List all service providers
router.get(
    '/',
    validateQuery(providerQuerySchema),
    getAllProviders
);

// Get single provider by ID
router.get(
    '/:id',
    validateParams(providerIdParamSchema),
    getProviderById
);

// Update provider details
router.put(
    '/:id',
    validate({ params: providerIdParamSchema, body: updateServiceProviderSchema }),
    updateProvider
);

// Update provider approval status (PENDING / APPROVED / REJECTED)
router.patch(
    '/:id/status',
    validate({ params: providerIdParamSchema, body: updateProviderStatusSchema }),
    updateProviderStatus
);

// Update provider payment status
router.patch(
    '/:id/payment-status',
    validate({ params: providerIdParamSchema, body: updateProviderPaymentStatusSchema }),
    updateProviderPaymentStatus
);

// Delete provider
router.delete(
    '/:id',
    validateParams(providerIdParamSchema),
    deleteProvider
);

export default router;

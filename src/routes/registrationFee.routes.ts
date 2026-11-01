import { Router } from 'express';
import {
    getActiveRegistrationFee,
    createOrUpdateActiveFee,
    createRegistrationFee,
    getAllRegistrationFees,
    getRegistrationFeeById,
    updateRegistrationFee,
    deleteRegistrationFee,
} from '../controllers/registrationFee.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
    createRegistrationFeeSchema,
    updateRegistrationFeeSchema,
    registrationFeeIdParamSchema,
} from '../validations/registrationFee.validation.js';

const router = Router();

// Public route: Get currently active registration fee & features for App/Web checkout
router.get('/active', getActiveRegistrationFee);

// Protected routes (Admin operations)
router.use(authenticate);

// Admin: Upsert (create or update active) fee and features
router.post(
    '/active',
    validateBody(createRegistrationFeeSchema),
    createOrUpdateActiveFee
);

// Admin: Create a new fee configuration
router.post(
    '/',
    validateBody(createRegistrationFeeSchema),
    createRegistrationFee
);

// Admin: Get all configured fee plans
router.get('/', getAllRegistrationFees);

// Admin: Get single fee plan
router.get(
    '/:id',
    validateParams(registrationFeeIdParamSchema),
    getRegistrationFeeById
);

// Admin: Update fee plan by ID
router.put(
    '/:id',
    validateParams(registrationFeeIdParamSchema),
    validateBody(updateRegistrationFeeSchema),
    updateRegistrationFee
);

// Admin: Delete fee plan by ID
router.delete(
    '/:id',
    validateParams(registrationFeeIdParamSchema),
    deleteRegistrationFee
);

export default router;


import { Router } from 'express';
import {
    getAllSubscriptions,
    getSubscriptionById,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    toggleSubscriptionStatus,
} from '../controllers/subscription.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateBody, validateParams } from '../middleware/validate.js';
import {
    createSubscriptionSchema,
    updateSubscriptionSchema,
    subscriptionIdParamSchema,
} from '../validations/subscription.validation.js';

const router = Router();

// Public route to fetch active subscriptions (for mobile apps/frontend customers)
router.get('/public', getAllSubscriptions);

// Protected routes (Admin management)
router.use(authenticate);

router.get('/', getAllSubscriptions);
router.get('/:id', validateParams(subscriptionIdParamSchema), getSubscriptionById);
router.post('/', validateBody(createSubscriptionSchema), createSubscription);
router.put(
    '/:id',
    validate({ params: subscriptionIdParamSchema, body: updateSubscriptionSchema }),
    updateSubscription
);
router.patch(
    '/:id/status',
    validateParams(subscriptionIdParamSchema),
    toggleSubscriptionStatus
);
router.delete('/:id', validateParams(subscriptionIdParamSchema), deleteSubscription);

export default router;


import { Router } from 'express';
import {
    createRegistrationOrder,
    verifyPayment,
    razorpayWebhook,
    getProviderPayments,
    getAllRegistrationPayments,
} from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
    createRegistrationOrderSchema,
    verifyPaymentSchema,
    paymentQuerySchema,
} from '../validations/payment.validation.js';

const router = Router();

// Public routes for payment processing
router.post(
    '/create-order',
    validateBody(createRegistrationOrderSchema),
    createRegistrationOrder
);

router.post(
    '/verify',
    validateBody(verifyPaymentSchema),
    verifyPayment
);

// Razorpay Webhook endpoint (Raw body verified against X-Razorpay-Signature)
router.post(
    '/webhook',
    razorpayWebhook
);

// Protected routes (Admin / Management)
router.use(authenticate);

router.get('/provider/:providerId', getProviderPayments);
router.get('/', validateQuery(paymentQuerySchema), getAllRegistrationPayments);

export default router;


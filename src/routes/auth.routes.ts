import { Router } from 'express';
import {
    login,
    registerAdmin,
    registerSalesPartner,
    getMe,
    changePassword,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
    loginSchema,
    registerAdminSchema,
    registerSalesPartnerSchema,
    changePasswordSchema,
} from '../validations/auth.validation.js';

const router = Router();

// Public routes
router.post('/login', validateBody(loginSchema), login);
router.post('/register-admin', validateBody(registerAdminSchema), registerAdmin);
router.post('/register-sales-partner', validateBody(registerSalesPartnerSchema), registerSalesPartner);
router.post('/sales-partner/register', validateBody(registerSalesPartnerSchema), registerSalesPartner);
router.post('/sales-partner/login', validateBody(loginSchema), (req, res, next) => {
    req.body.loginType = 'SALES_PERSON';
    return login(req, res, next);
});

// Protected routes
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, validateBody(changePasswordSchema), changePassword);

export default router;


import { Router } from 'express';
import { login, registerAdmin, getMe, changePassword, } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerAdminSchema, changePasswordSchema, } from '../validations/auth.validation.js';

const router = Router();

// Public routes
router.post('/login', validateBody(loginSchema), login);
router.post('/register-admin', validateBody(registerAdminSchema), registerAdmin);

// Protected routes
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, validateBody(changePasswordSchema), changePassword);

export default router;


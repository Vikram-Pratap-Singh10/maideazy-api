import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Protected dashboard routes
router.use(authenticate);

// Main dashboard endpoint
router.get('/stats', getDashboardStats);

// Compatibility route for legacy stats-dashboard call
router.get('/stats-dashboard', getDashboardStats);

export default router;


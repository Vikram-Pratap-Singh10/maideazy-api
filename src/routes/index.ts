import { Router } from 'express';
import authRoutes from './auth.routes.js';
import roleRoutes from './role.routes.js';
import userRoutes from './user.routes.js';
import serviceProviderRoutes from './serviceProvider.routes.js';
import paymentRoutes from './payment.routes.js';
import registrationFeeRoutes from './registrationFee.routes.js';

const router = Router();

// API Health / Ping
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'MaidEazy Backend API is running healthy',
        timestamp: new Date().toISOString(),
    });
});

// Mount modular sub-routes
router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);
router.use('/service-providers', serviceProviderRoutes);
router.use('/payments', paymentRoutes);
router.use('/registration-fee', registrationFeeRoutes);

export default router;

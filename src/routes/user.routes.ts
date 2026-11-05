import { Router } from 'express';
import {
    registerAppUser,
    createTeamMember,
    getAllTeamMembers,
    getTeamMemberById,
    updateTeamMember,
    deleteTeamMember,
    verifyReferenceCode,
    createSalesPartner,
    getAllSalesPartners,
    getSalesPartnerById,
    updateSalesPartner,
    deleteSalesPartner,
    updateSalesPartnerStatus,
    resetSalesPartnerPassword,
} from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
    registerAppUserSchema,
    createTeamMemberSchema,
    updateTeamMemberSchema,
    createSalesPartnerSchema,
    updateSalesPartnerSchema,
    teamMemberQuerySchema,
    userIdParamSchema,
    referenceCodeParamSchema,
} from '../validations/user.validation.js';

const router = Router();

// Public route: App user registration (for app side with location)
router.post(
    '/register',
    validateBody(registerAppUserSchema),
    registerAppUser
);

// Public route: verify reference code during registration
router.get(
    '/verify-reference/:code',
    validateParams(referenceCodeParamSchema),
    verifyReferenceCode
);

// Public route: Sales Partner registration from public landing / web form
router.post(
    '/sales-partners/public-register',
    validateBody(createSalesPartnerSchema),
    createSalesPartner
);

// Authenticated Sales Partner routes
router.post(
    '/sales-partners',
    authenticate,
    validateBody(createSalesPartnerSchema),
    createSalesPartner
);

router.get(
    '/sales-partners',
    authenticate,
    validateQuery(teamMemberQuerySchema),
    getAllSalesPartners
);

router.get(
    '/sales-partners/:id',
    authenticate,
    validateParams(userIdParamSchema),
    getSalesPartnerById
);

router.put(
    '/sales-partners/:id',
    authenticate,
    validate({ params: userIdParamSchema, body: updateSalesPartnerSchema }),
    updateSalesPartner
);

router.patch(
    '/sales-partners/:id/status',
    authenticate,
    validateParams(userIdParamSchema),
    updateSalesPartnerStatus
);

router.post(
    '/sales-partners/:id/reset-password',
    authenticate,
    validateParams(userIdParamSchema),
    resetSalesPartnerPassword
);

router.delete(
    '/sales-partners/:id',
    authenticate,
    validateParams(userIdParamSchema),
    deleteSalesPartner
);

// Team / Sales Person management routes (requires authentication)
router.post(
    '/team',
    authenticate,
    validateBody(createTeamMemberSchema),
    createTeamMember
);

router.get(
    '/team',
    authenticate,
    validateQuery(teamMemberQuerySchema),
    getAllTeamMembers
);

router.get(
    '/team/:id',
    authenticate,
    validateParams(userIdParamSchema),
    getTeamMemberById
);

router.put(
    '/team/:id',
    authenticate,
    validate({ params: userIdParamSchema, body: updateTeamMemberSchema }),
    updateTeamMember
);

router.delete(
    '/team/:id',
    authenticate,
    validateParams(userIdParamSchema),
    deleteTeamMember
);

export default router;

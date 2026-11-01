import { Router } from 'express';
import {
    registerAppUser,
    createTeamMember,
    getAllTeamMembers,
    getTeamMemberById,
    updateTeamMember,
    deleteTeamMember,
    verifyReferenceCode,
} from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
    registerAppUserSchema,
    createTeamMemberSchema,
    updateTeamMemberSchema,
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

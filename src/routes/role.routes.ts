import { Router } from 'express';
import {
    createRole,
    getAllRoles,
    getRoleById,
    updateRole,
    deleteRole,
    getAvailableTabsAndActions,
} from '../controllers/role.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate, validateBody, validateParams } from '../middleware/validate.js';
import {
    createRoleSchema,
    updateRoleSchema,
    roleIdParamSchema,
} from '../validations/role.validation.js';

const router = Router();

// All role routes require authentication
router.use(authenticate);

// Predefined list of tabs & actions for UI checkboxes
router.get('/tabs-list', getAvailableTabsAndActions);

// CRUD routes (frontend controls visibility based on permissions)
router.post('/', validateBody(createRoleSchema), createRole);
router.get('/', getAllRoles);
router.get('/:id', validateParams(roleIdParamSchema), getRoleById);
router.put('/:id', validate({ params: roleIdParamSchema, body: updateRoleSchema }), updateRole);
router.delete('/:id', validateParams(roleIdParamSchema), deleteRole);

export default router;

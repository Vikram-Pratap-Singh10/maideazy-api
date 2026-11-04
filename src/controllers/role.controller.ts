import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Role, { ADMIN_TABS_LIST, TAB_ACTIONS_LIST, AdminTab, TabAction } from '../models/role.js';
import User from '../models/user.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * Get available admin tabs and actions for UI permission matrix
 */
export const getAvailableTabsAndActions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        res.status(200).json({
            success: true,
            data: {
                tabs: ADMIN_TABS_LIST,
                actions: TAB_ACTIONS_LIST,
                tabDefinitions: [
                    { tab: AdminTab.DASHBOARD, label: 'Dashboard', actions: [TabAction.READ] },
                    {
                        tab: AdminTab.ROLES,
                        label: 'Roles & Permissions',
                        actions: [TabAction.CREATE, TabAction.READ, TabAction.UPDATE, TabAction.DELETE],
                    },
                    {
                        tab: AdminTab.SALES_PARTNERS,
                        label: 'Sales Partners',
                        actions: [TabAction.CREATE, TabAction.READ, TabAction.UPDATE, TabAction.DELETE],
                    },
                    {
                        tab: AdminTab.SERVICE_PROVIDERS,
                        label: 'Service Providers',
                        actions: [TabAction.CREATE, TabAction.READ, TabAction.UPDATE, TabAction.DELETE],
                    },
                    {
                        tab: AdminTab.SUBSCRIPTIONS,
                        label: 'Subscriptions',
                        actions: [TabAction.CREATE, TabAction.READ, TabAction.UPDATE, TabAction.DELETE],
                    },
                    {
                        tab: AdminTab.USERS,
                        label: 'Customers & Users',
                        actions: [TabAction.CREATE, TabAction.READ, TabAction.UPDATE, TabAction.DELETE],
                    },
                    {
                        tab: AdminTab.PAYMENTS,
                        label: 'Transactions & Payments',
                        actions: [TabAction.READ, TabAction.UPDATE],
                    },
                    {
                        tab: AdminTab.BANNERS,
                        label: 'Banners',
                        actions: [TabAction.CREATE, TabAction.READ, TabAction.UPDATE, TabAction.DELETE],
                    },
                    {
                        tab: AdminTab.SETTINGS,
                        label: 'Settings',
                        actions: [TabAction.READ, TabAction.UPDATE],
                    },
                ],
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new Role with Tab and Action permissions
 */
export const createRole = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { name, description, permissions, isActive } = req.body;

        const existingRole = await Role.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            isDeleted: false,
        });

        if (existingRole) {
            res.status(400).json({
                success: false,
                message: `Role with name '${name}' already exists`,
            });
            return;
        }

        const role = await Role.create({
            name,
            description,
            permissions: permissions || [],
            isActive: isActive ?? true,
            isDeleted: false,
            deletedAt: null,
        });

        res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: { role },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all roles with user assignment count
 */
export const getAllRoles = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const roles = await Role.find({ isDeleted: false }).sort({ createdAt: -1 });

        // Aggregate user count for each role
        const userCounts = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
        ]);

        const countMap: Record<string, number> = {};
        userCounts.forEach((item) => {
            if (item._id) {
                countMap[item._id.toString()] = item.count;
            }
        });

        const rolesWithCounts = roles.map((role) => ({
            ...role.toObject(),
            assignedUsersCount: countMap[role._id.toString()] || 0,
        }));

        res.status(200).json({
            success: true,
            data: {
                roles: rolesWithCounts,
                total: roles.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single role by ID
 */
export const getRoleById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid role ID format',
            });
            return;
        }

        const role = await Role.findOne({ _id: id, isDeleted: false });
        if (!role) {
            res.status(404).json({
                success: false,
                message: 'Role not found',
            });
            return;
        }

        const userCount = await User.countDocuments({ role: role._id });

        res.status(200).json({
            success: true,
            data: {
                role: {
                    ...role.toObject(),
                    assignedUsersCount: userCount,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update an existing role
 */
export const updateRole = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description, permissions, isActive } = req.body;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid role ID format',
            });
            return;
        }

        const role = await Role.findOne({ _id: id, isDeleted: false });
        if (!role) {
            res.status(404).json({
                success: false,
                message: 'Role not found',
            });
            return;
        }

        // Check if new name collides with another active role
        if (name && name !== role.name) {
            const existingName = await Role.findOne({
                name: { $regex: new RegExp(`^${name}$`, 'i') },
                _id: { $ne: id },
                isDeleted: false,
            });
            if (existingName) {
                res.status(400).json({
                    success: false,
                    message: `Another role with name '${name}' already exists`,
                });
                return;
            }
            role.name = name;
        }

        if (description !== undefined) role.description = description;
        if (permissions !== undefined) role.permissions = permissions;
        if (isActive !== undefined) role.isActive = isActive;

        await role.save();

        res.status(200).json({
            success: true,
            message: 'Role updated successfully',
            data: { role },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Soft delete a role
 */
export const deleteRole = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid role ID format',
            });
            return;
        }

        const role = await Role.findOne({ _id: id, isDeleted: false });
        if (!role) {
            res.status(404).json({
                success: false,
                message: 'Role not found',
            });
            return;
        }

        // Check if any users are assigned to this role
        const assignedUsersCount = await User.countDocuments({ role: role._id });
        if (assignedUsersCount > 0) {
            res.status(400).json({
                success: false,
                message: `Cannot delete role. There are ${assignedUsersCount} user(s) currently assigned to this role. Reassign them first.`,
            });
            return;
        }

        role.isDeleted = true;
        role.deletedAt = new Date();
        await role.save();

        res.status(200).json({
            success: true,
            message: 'Role deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

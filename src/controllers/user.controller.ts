import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import User, { UserType } from '../models/user.js';
import Role from '../models/role.js';
import ServiceProvider from '../models/service.provider.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * Register App User (customer side registration with location)
 */
export const registerAppUser = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { fullName, email, password, mobileNumber, location } = req.body;

        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            res.status(400).json({
                success: false,
                message: 'A user with this email address already exists',
            });
            return;
        }

        const user = await User.create({
            fullName,
            email: email.toLowerCase(),
            password,
            mobileNumber,
            userType: UserType.USER,
            location,
            isActive: true,
        });

        const userObj = user.toObject();
        delete userObj.password;

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: { user: userObj },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin creates a team member (sales person)
 * Auto-generates a unique referenceCode for the sales person
 */
export const createTeamMember = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            fullName,
            email,
            password,
            mobileNumber,
            roleId,
            userType = UserType.SALES_PERSON,
            referencePrefix = 'SP',
            location,
        } = req.body;

        // Check if email already in use
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            res.status(400).json({
                success: false,
                message: 'A user with this email address already exists',
            });
            return;
        }

        // Validate that the assigned role exists and is active
        const role = await Role.findOne({ _id: roleId, isDeleted: false });
        if (!role) {
            res.status(400).json({
                success: false,
                message: 'The selected role does not exist',
            });
            return;
        }

        if (!role.isActive) {
            res.status(400).json({
                success: false,
                message: 'The selected role is inactive and cannot be assigned',
            });
            return;
        }

        // Generate unique referenceCode for the sales person / team member
        const referenceCode = await User.generateUniqueReferenceCode(referencePrefix);

        const newMember = await User.create({
            fullName,
            email: email.toLowerCase(),
            password,
            mobileNumber,
            role: role._id,
            userType,
            referenceCode,
            location,
            createdBy: req.user?._id,
            isActive: true,
        });

        const memberObj = newMember.toObject();
        delete memberObj.password;

        res.status(201).json({
            success: true,
            message: 'Team member created successfully',
            data: {
                teamMember: {
                    ...memberObj,
                    role,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all team members with pagination, filters, and provider onboarding count
 */
export const getAllTeamMembers = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            roleId,
            userType,
            isActive,
        } = req.query as any;

        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        const filter: Record<string, any> = {};

        // Filter by userType if specified
        if (userType) {
            filter.userType = userType;
        }

        if (roleId && Types.ObjectId.isValid(roleId)) {
            filter.role = new Types.ObjectId(roleId);
        }

        if (isActive !== undefined) {
            filter.isActive = String(isActive) === 'true';
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { fullName: regex },
                { email: regex },
                { mobileNumber: regex },
                { referenceCode: regex },
            ];
        }

        const [members, total] = await Promise.all([
            User.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate('role', 'name description permissions')
                .populate('createdBy', 'fullName email')
                .select('-password'),
            User.countDocuments(filter),
        ]);

        // Get count of registered service providers for each team member's referenceCode
        const referenceCodes = members
            .map((m) => m.referenceCode)
            .filter((c): c is string => Boolean(c));

        let providerStatsMap: Record<string, number> = {};
        if (referenceCodes.length > 0) {
            const stats = await ServiceProvider.aggregate([
                { $match: { referenceCode: { $in: referenceCodes } } },
                { $group: { _id: '$referenceCode', count: { $sum: 1 } } },
            ]);
            stats.forEach((item) => {
                if (item._id) {
                    providerStatsMap[item._id] = item.count;
                }
            });
        }

        const enrichedMembers = members.map((member) => ({
            ...member.toObject(),
            onboardedProvidersCount: member.referenceCode
                ? providerStatsMap[member.referenceCode] || 0
                : 0,
        }));

        res.status(200).json({
            success: true,
            data: {
                teamMembers: enrichedMembers,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get team member details by ID, including their onboarded service providers
 */
export const getTeamMemberById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid User ID format',
            });
            return;
        }

        const member = await User.findById(id)
            .populate('role', 'name description permissions')
            .populate('createdBy', 'fullName email')
            .select('-password');

        if (!member) {
            res.status(404).json({
                success: false,
                message: 'Team member not found',
            });
            return;
        }

        // Fetch service providers onboarded with this member's referenceCode
        let onboardedProviders: any[] = [];
        let totalProvidersCount = 0;

        if (member.referenceCode) {
            [onboardedProviders, totalProvidersCount] = await Promise.all([
                ServiceProvider.find({ referenceCode: member.referenceCode })
                    .select('fullName mobileNumber city pinCode status paymentStatus createdAt')
                    .sort({ createdAt: -1 })
                    .limit(20),
                ServiceProvider.countDocuments({ referenceCode: member.referenceCode }),
            ]);
        }

        res.status(200).json({
            success: true,
            data: {
                teamMember: member,
                stats: {
                    totalOnboardedProviders: totalProvidersCount,
                    recentProviders: onboardedProviders,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update team member details
 */
export const updateTeamMember = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { fullName, email, mobileNumber, roleId, isActive, location } = req.body;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid User ID format',
            });
            return;
        }

        const member = await User.findById(id);
        if (!member) {
            res.status(404).json({
                success: false,
                message: 'Team member not found',
            });
            return;
        }

        // Check if new email is already in use by someone else
        if (email && email.toLowerCase() !== member.email) {
            const existingEmail = await User.findOne({
                email: email.toLowerCase(),
                _id: { $ne: id },
            });
            if (existingEmail) {
                res.status(400).json({
                    success: false,
                    message: 'Another user with this email address already exists',
                });
                return;
            }
            member.email = email.toLowerCase();
        }

        if (roleId && (!member.role || roleId !== member.role.toString())) {
            const role = await Role.findOne({ _id: roleId, isDeleted: false });
            if (!role) {
                res.status(400).json({
                    success: false,
                    message: 'Assigned role does not exist',
                });
                return;
            }
            member.role = role._id;
        }

        if (fullName !== undefined) member.fullName = fullName;
        if (mobileNumber !== undefined) member.mobileNumber = mobileNumber;
        if (isActive !== undefined) member.isActive = isActive;
        if (location !== undefined) member.location = location;

        await member.save();

        const updatedMember = await User.findById(id)
            .populate('role', 'name description permissions')
            .populate('createdBy', 'fullName email')
            .select('-password');

        res.status(200).json({
            success: true,
            message: 'Team member updated successfully',
            data: { teamMember: updatedMember },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete / Deactivate a team member
 */
export const deleteTeamMember = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid User ID format',
            });
            return;
        }

        const member = await User.findById(id);
        if (!member) {
            res.status(404).json({
                success: false,
                message: 'Team member not found',
            });
            return;
        }

        // Prevent self deletion
        if (req.user && req.user._id.toString() === id) {
            res.status(400).json({
                success: false,
                message: 'You cannot delete your own account',
            });
            return;
        }

        // Check if any service providers were onboarded with this member's referenceCode
        if (member.referenceCode) {
            const count = await ServiceProvider.countDocuments({
                referenceCode: member.referenceCode,
            });
            if (count > 0) {
                // If providers are linked, soft-deactivate to preserve historical integrity
                member.isActive = false;
                await member.save();
                res.status(200).json({
                    success: true,
                    message: `Team member has ${count} registered provider(s) linked to their reference code. Account deactivated instead of permanent deletion to preserve audit history.`,
                });
                return;
            }
        }

        await User.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Team member deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Public or authenticated check: Verify reference code during service provider registration
 */
export const verifyReferenceCode = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { code } = req.params;

        if (!code) {
            res.status(400).json({
                success: false,
                message: 'Reference code is required',
            });
            return;
        }

        const member = await User.findOne({
            referenceCode: code.trim().toUpperCase(),
            isActive: true,
        }).select('fullName email referenceCode userType');

        if (!member) {
            res.status(404).json({
                success: false,
                isValid: false,
                message: 'Invalid or inactive reference code',
            });
            return;
        }

        res.status(200).json({
            success: true,
            isValid: true,
            data: {
                referenceCode: member.referenceCode,
                salesPersonName: member.fullName,
            },
        });
    } catch (error) {
        next(error);
    }
};

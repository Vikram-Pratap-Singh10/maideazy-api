import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import User, { UserType } from '../models/user.js';
import Role from '../models/role.js';
import ServiceProvider from '../models/service.provider.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * Register App User (customer side registration with location)
 */
export const registerAppUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
export const createTeamMember = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { fullName, email, password, mobileNumber, roleId, userType = UserType.SALES_PERSON, referencePrefix = 'SP', location, } = req.body;

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
            res.status(400).json({ success: false, message: 'The selected role does not exist', });
            return;
        }

        if (!role.isActive) {
            res.status(400).json({ success: false, message: 'The selected role is inactive and cannot be assigned', });
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

        res.status(201).json({ success: true, message: 'Team member created successfully', data: { teamMember: { ...memberObj, role, }, }, });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all team members with pagination, filters, and provider onboarding count
 */
export const getAllTeamMembers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
export const getTeamMemberById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
export const updateTeamMember = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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

/**
 * Admin creates a Sales Partner with the full MaidEazy registration form
 */
export const createSalesPartner = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            fullName,
            mobileNumber,
            email,
            password,
            flatNumber,
            buildingName,
            roadName,
            localArea,
            landmark,
            city,
            state,
            pinCode,
            hasSalesExperience,
            previousExperience,
            languagesKnown,
            hasSmartphone,
            panCardNumber,
            panCardImage,
            aadhaarNumber,
            aadhaarDocument,
            passportPhoto,
            accountHolderName,
            bankName,
            accountNumber,
            ifscCode,
            branchName,
            bankDocumentType,
            bankDocument,
            declarationAccepted,
            approvalStatus = 'APPROVED',
            roleId,
        } = req.body;

        // Check if email already exists
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            res.status(400).json({
                success: false,
                message: 'A user with this email address already exists',
            });
            return;
        }

        // Check if mobile already exists
        const existingMobile = await User.findOne({ mobileNumber });
        if (existingMobile) {
            res.status(400).json({
                success: false,
                message: 'A user with this mobile number already exists',
            });
            return;
        }

        // Assign Sales Person role
        let assignedRoleId = roleId;
        if (!assignedRoleId || !Types.ObjectId.isValid(assignedRoleId)) {
            const defaultRole = await Role.findOne({ name: 'Sales Person', isDeleted: false });
            if (defaultRole) {
                assignedRoleId = defaultRole._id;
            }
        }

        // Generate unique referenceCode for the Sales Partner
        const referenceCode = await User.generateUniqueReferenceCode('SP');

        // Languages normalization
        const languagesArray = Array.isArray(languagesKnown)
            ? languagesKnown
            : typeof languagesKnown === 'string'
                ? languagesKnown.split(',').map((s: string) => s.trim())
                : [];

        const addressCombined = `${flatNumber}, ${buildingName}${roadName ? `, ${roadName}` : ''}, ${localArea}`;

        const generatedPassword =
            password && password.trim().length >= 6
                ? password.trim()
                : `MaidEazy@${Math.floor(1000 + Math.random() * 9000)}`;

        const newSalesPartner = await User.create({
            fullName,
            email: email.toLowerCase(),
            mobileNumber,
            password: generatedPassword,
            role: assignedRoleId,
            userType: UserType.SALES_PERSON,
            referenceCode,
            isActive: true,
            createdBy: req.user?._id,
            location: {
                address: addressCombined,
                city,
                state,
                pinCode,
                landmark,
            },
            salesPartnerDetails: {
                flatNumber,
                buildingName,
                roadName,
                localArea,
                landmark,
                city,
                state,
                pinCode,
                hasSalesExperience: Boolean(hasSalesExperience),
                previousExperience,
                languagesKnown: languagesArray,
                hasSmartphone: Boolean(hasSmartphone),
                panCardNumber: panCardNumber?.toUpperCase(),
                panCardImage,
                aadhaarNumber,
                aadhaarDocument,
                passportPhoto,
                accountHolderName,
                bankName,
                accountNumber,
                ifscCode: ifscCode?.toUpperCase(),
                branchName,
                bankDocumentType: bankDocumentType || 'Bank Passbook',
                bankDocument,
                declarationAccepted: Boolean(declarationAccepted),
                approvalStatus,
            },
        });

        const createdPartner = await User.findById(newSalesPartner._id)
            .populate('role', 'name description')
            .populate('createdBy', 'fullName email')
            .select('-password');

        res.status(201).json({
            success: true,
            message: 'Sales Partner registered successfully',
            data: {
                salesPartner: createdPartner,
                generatedPassword,
                tempPassword: generatedPassword,
                referenceCode,
                email: email.toLowerCase(),
                fullName,
                mobileNumber,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all Sales Partners with stats, search, and pagination
 */
export const getAllSalesPartners = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            approvalStatus,
            isActive,
        } = req.query as any;

        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        const filter: Record<string, any> = {
            userType: UserType.SALES_PERSON,
        };

        if (approvalStatus) {
            filter['salesPartnerDetails.approvalStatus'] = approvalStatus;
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
                { 'salesPartnerDetails.city': regex },
                { 'salesPartnerDetails.state': regex },
                { 'salesPartnerDetails.panCardNumber': regex },
            ];
        }

        const [partners, total] = await Promise.all([
            User.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate('role', 'name description')
                .populate('createdBy', 'fullName email')
                .select('-password'),
            User.countDocuments(filter),
        ]);

        // Aggregate registered providers count for each partner's referenceCode
        const referenceCodes = partners
            .map((p) => p.referenceCode)
            .filter((c): c is string => Boolean(c));

        let providerCountMap: Record<string, number> = {};
        if (referenceCodes.length > 0) {
            const stats = await ServiceProvider.aggregate([
                { $match: { referenceCode: { $in: referenceCodes } } },
                { $group: { _id: '$referenceCode', count: { $sum: 1 } } },
            ]);
            stats.forEach((s) => {
                if (s._id) providerCountMap[s._id] = s.count;
            });
        }

        const partnersWithStats = partners.map((p) => ({
            ...p.toObject(),
            registeredProvidersCount: p.referenceCode ? providerCountMap[p.referenceCode] || 0 : 0,
        }));

        res.status(200).json({
            success: true,
            data: {
                salesPartners: partnersWithStats,
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
 * Get single Sales Partner by ID with full details
 */
export const getSalesPartnerById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid User ID format' });
            return;
        }

        const partner = await User.findOne({ _id: id, userType: UserType.SALES_PERSON })
            .populate('role', 'name description permissions')
            .populate('createdBy', 'fullName email')
            .select('-password');

        if (!partner) {
            res.status(404).json({ success: false, message: 'Sales Partner not found' });
            return;
        }

        let registeredProviders: any[] = [];
        if (partner.referenceCode) {
            registeredProviders = await ServiceProvider.find({
                referenceCode: partner.referenceCode,
            })
                .select('fullName mobileNumber status paymentStatus createdAt jobRoles city')
                .sort({ createdAt: -1 })
                .limit(50);
        }

        res.status(200).json({
            success: true,
            data: {
                salesPartner: partner,
                registeredProviders,
                totalProviders: registeredProviders.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update Sales Partner details
 */
export const updateSalesPartner = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid User ID format' });
            return;
        }

        const partner = await User.findOne({ _id: id, userType: UserType.SALES_PERSON });
        if (!partner) {
            res.status(404).json({ success: false, message: 'Sales Partner not found' });
            return;
        }

        const {
            fullName,
            mobileNumber,
            email,
            isActive,
            approvalStatus,
            statusNotes,
            flatNumber,
            buildingName,
            roadName,
            localArea,
            landmark,
            city,
            state,
            pinCode,
            hasSalesExperience,
            previousExperience,
            languagesKnown,
            hasSmartphone,
            panCardNumber,
            panCardImage,
            aadhaarNumber,
            aadhaarDocument,
            passportPhoto,
            accountHolderName,
            bankName,
            accountNumber,
            ifscCode,
            branchName,
            bankDocumentType,
            bankDocument,
        } = req.body;

        if (fullName !== undefined) partner.fullName = fullName;
        if (email !== undefined) partner.email = email.toLowerCase();
        if (mobileNumber !== undefined) partner.mobileNumber = mobileNumber;
        if (isActive !== undefined) partner.isActive = isActive;

        if (!partner.salesPartnerDetails) {
            partner.salesPartnerDetails = {};
        }

        if (flatNumber !== undefined) partner.salesPartnerDetails.flatNumber = flatNumber;
        if (buildingName !== undefined) partner.salesPartnerDetails.buildingName = buildingName;
        if (roadName !== undefined) partner.salesPartnerDetails.roadName = roadName;
        if (localArea !== undefined) partner.salesPartnerDetails.localArea = localArea;
        if (landmark !== undefined) partner.salesPartnerDetails.landmark = landmark;
        if (city !== undefined) {
            partner.salesPartnerDetails.city = city;
            if (partner.location) partner.location.city = city;
        }
        if (state !== undefined) {
            partner.salesPartnerDetails.state = state;
            if (partner.location) partner.location.state = state;
        }
        if (pinCode !== undefined) {
            partner.salesPartnerDetails.pinCode = pinCode;
            if (partner.location) partner.location.pinCode = pinCode;
        }
        if (hasSalesExperience !== undefined) partner.salesPartnerDetails.hasSalesExperience = Boolean(hasSalesExperience);
        if (previousExperience !== undefined) partner.salesPartnerDetails.previousExperience = previousExperience;
        if (languagesKnown !== undefined) {
            partner.salesPartnerDetails.languagesKnown = Array.isArray(languagesKnown)
                ? languagesKnown
                : languagesKnown.split(',').map((s: string) => s.trim());
        }
        if (hasSmartphone !== undefined) partner.salesPartnerDetails.hasSmartphone = Boolean(hasSmartphone);
        if (panCardNumber !== undefined) partner.salesPartnerDetails.panCardNumber = panCardNumber.toUpperCase();
        if (panCardImage !== undefined) partner.salesPartnerDetails.panCardImage = panCardImage;
        if (aadhaarNumber !== undefined) partner.salesPartnerDetails.aadhaarNumber = aadhaarNumber;
        if (aadhaarDocument !== undefined) partner.salesPartnerDetails.aadhaarDocument = aadhaarDocument;
        if (passportPhoto !== undefined) partner.salesPartnerDetails.passportPhoto = passportPhoto;
        if (accountHolderName !== undefined) partner.salesPartnerDetails.accountHolderName = accountHolderName;
        if (bankName !== undefined) partner.salesPartnerDetails.bankName = bankName;
        if (accountNumber !== undefined) partner.salesPartnerDetails.accountNumber = accountNumber;
        if (ifscCode !== undefined) partner.salesPartnerDetails.ifscCode = ifscCode.toUpperCase();
        if (branchName !== undefined) partner.salesPartnerDetails.branchName = branchName;
        if (bankDocumentType !== undefined) partner.salesPartnerDetails.bankDocumentType = bankDocumentType;
        if (bankDocument !== undefined) partner.salesPartnerDetails.bankDocument = bankDocument;
        if (approvalStatus !== undefined) partner.salesPartnerDetails.approvalStatus = approvalStatus;
        if (statusNotes !== undefined) partner.salesPartnerDetails.statusNotes = statusNotes;

        await partner.save();

        const updated = await User.findById(id)
            .populate('role', 'name description')
            .populate('createdBy', 'fullName email')
            .select('-password');

        res.status(200).json({
            success: true,
            message: 'Sales Partner updated successfully',
            data: { salesPartner: updated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete Sales Partner
 */
export const deleteSalesPartner = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid User ID format' });
            return;
        }

        const partner = await User.findOne({ _id: id, userType: UserType.SALES_PERSON });
        if (!partner) {
            res.status(404).json({ success: false, message: 'Sales Partner not found' });
            return;
        }

        // Soft delete / deactivate if has registered providers
        if (partner.referenceCode) {
            const count = await ServiceProvider.countDocuments({ referenceCode: partner.referenceCode });
            if (count > 0) {
                partner.isActive = false;
                await partner.save();
                res.status(200).json({
                    success: true,
                    message: `Sales partner has ${count} registered provider(s). Account deactivated instead of permanent deletion.`,
                });
                return;
            }
        }

        await User.findByIdAndDelete(id);
        res.status(200).json({
            success: true,
            message: 'Sales partner deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update Sales Partner status (APPROVED / REJECTED / PENDING)
 * When approving, automatically sets or verifies login password so the partner can log in.
 */
export const updateSalesPartnerStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { approvalStatus, statusNotes, tempPassword } = req.body;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid User ID format' });
            return;
        }

        if (!['PENDING', 'APPROVED', 'REJECTED'].includes(approvalStatus)) {
            res.status(400).json({ success: false, message: 'Invalid status value' });
            return;
        }

        const partner = await User.findOne({ _id: id, userType: UserType.SALES_PERSON }).select('+password');
        if (!partner) {
            res.status(404).json({ success: false, message: 'Sales Partner not found' });
            return;
        }

        if (!partner.salesPartnerDetails) {
            partner.salesPartnerDetails = {};
        }

        partner.salesPartnerDetails.approvalStatus = approvalStatus;
        if (statusNotes !== undefined) partner.salesPartnerDetails.statusNotes = statusNotes;

        let issuedPassword: string | null = null;

        if (approvalStatus === 'APPROVED') {
            partner.isActive = true;

            // Generate referenceCode if missing
            if (!partner.referenceCode) {
                partner.referenceCode = await User.generateUniqueReferenceCode('SP');
            }

            // If a custom tempPassword was provided, use it
            if (tempPassword && tempPassword.length >= 6) {
                partner.password = tempPassword;
                issuedPassword = tempPassword;
            } else if (!partner.password) {
                // If partner registered without a password, auto-generate a secure temporary password
                const generatedPassword = `MaidEazy@${Math.floor(1000 + Math.random() * 9000)}`;
                partner.password = generatedPassword;
                issuedPassword = generatedPassword;
            }
        } else if (approvalStatus === 'REJECTED') {
            partner.isActive = false;
        }

        await partner.save();

        const partnerObj = partner.toObject();
        delete partnerObj.password;

        res.status(200).json({
            success: true,
            message: `Sales partner status updated to ${approvalStatus}`,
            data: {
                salesPartner: partnerObj,
                tempPassword: issuedPassword,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin resets or issues a new password for a Sales Partner
 */
export const resetSalesPartnerPassword = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid User ID format' });
            return;
        }

        const partner = await User.findOne({ _id: id, userType: UserType.SALES_PERSON });
        if (!partner) {
            res.status(404).json({ success: false, message: 'Sales Partner not found' });
            return;
        }

        const effectivePassword =
            newPassword && newPassword.length >= 6
                ? newPassword
                : `MaidEazy@${Math.floor(1000 + Math.random() * 9000)}`;

        partner.password = effectivePassword;
        partner.isActive = true;
        if (!partner.referenceCode) {
            partner.referenceCode = await User.generateUniqueReferenceCode('SP');
        }
        await partner.save();

        res.status(200).json({
            success: true,
            message: 'Sales partner password reset successfully',
            data: {
                salesPartnerId: partner._id,
                fullName: partner.fullName,
                email: partner.email,
                mobileNumber: partner.mobileNumber,
                referenceCode: partner.referenceCode,
                tempPassword: effectivePassword,
            },
        });
    } catch (error) {
        next(error);
    }
};

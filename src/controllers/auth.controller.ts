import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { UserType } from '../models/user.js';
import Role, { ADMIN_TABS_LIST, TabAction } from '../models/role.js';
import { AuthRequest } from '../middleware/auth.js';

const generateToken = (userId: string, email: string, userType: string): string => {
    const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
    const expiresIn = process.env.JWT_EXPIRE || '24h';
    return jwt.sign({ id: userId, email, userType }, secret, { expiresIn: expiresIn as any });
};

/**
 * Admin / Team Member Login
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, password, loginType } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() })
            .select('+password')
            .populate('role');
        if (!user) {
            res.status(401).json({ success: false, message: 'Invalid email or password', });
            return;
        }

        if (!user.isActive) {
            res.status(403).json({ success: false, message: 'Account is deactivated. Please contact administrator.', });
            return;
        }

        // Validate account role type against login selection if loginType is specified
        if (loginType === 'ADMIN') {
            const roleName = ((user.role as any)?.name || '').toLowerCase();
            const isAdmin = user.userType === UserType.ADMIN || roleName.includes('admin');
            if (!isAdmin) {
                res.status(403).json({ success: false, message: 'Access restricted: This account is registered as a Sales Partner. Please select "Sales Person" to sign in.', });
                return;
            }
        } else if (loginType === 'SALES_PERSON') {
            if (user.userType === UserType.ADMIN) {
                res.status(403).json({ success: false, message: 'Access restricted: This account is an Administrator. Please select "Admin" to sign in.', });
                return;
            }
        }

        // Check approval status for Sales Partners
        if (user.userType === UserType.SALES_PERSON || user.salesPartnerDetails) {
            const approvalStatus = user.salesPartnerDetails?.approvalStatus || 'PENDING';
            // if (approvalStatus === 'PENDING') {
            //     res.status(403).json({
            //         success: false,
            //         message: 'Your registration application is currently under review by MaidEazy Admin. You will be able to log in once your account is approved.',
            //     });
            //     return;
            // }
            if (approvalStatus === 'REJECTED') {
                const notes = user.salesPartnerDetails?.statusNotes ? ` Reason: ${user.salesPartnerDetails.statusNotes}` : '';
                res.status(403).json({
                    success: false,
                    message: `Your registration was not approved.${notes} Please contact MaidEazy support.`,
                });
                return;
            }
            if (!user.password) {
                res.status(403).json({
                    success: false,
                    message: 'Your account is approved but password has not been configured yet. Please check your approval message or contact administrator.',
                });
                return;
            }
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ success: false, message: 'Invalid email or password', });
            return;
        }

        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user._id.toString(), user.email, user.userType);

        // Sanitize response
        const userObj = user.toObject();
        delete userObj.password;

        res.status(200).json({ success: true, message: 'Login successful', data: { token, user: userObj, }, });
    } catch (error) {
        next(error);
    }
};

/**
 * Initial Admin Registration
 * Sets up Super Admin role with all tabs and actions if not present.
 */
export const registerAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { fullName, email, password, mobileNumber } = req.body;

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'A user with this email already exists',
            });
            return;
        }

        // Find or create Super Admin Role
        let adminRole = await Role.findOne({ name: 'Super Admin' });
        if (!adminRole) {
            const allPermissions = ADMIN_TABS_LIST.map((tab) => ({
                tab,
                actions: [TabAction.ALL, TabAction.CREATE, TabAction.READ, TabAction.UPDATE, TabAction.DELETE],
            }));

            adminRole = await Role.create({
                name: 'Super Admin',
                description: 'Full system access to all tabs and actions',
                permissions: allPermissions,
                isActive: true,
                isDeleted: false,
                deletedAt: null,
            });
        }

        const admin = await User.create({
            fullName,
            email: email.toLowerCase(),
            password,
            mobileNumber,
            role: adminRole._id,
            userType: UserType.ADMIN,
            isActive: true,
        });

        const token = generateToken(admin._id.toString(), admin.email, admin.userType);

        const adminObj = admin.toObject();
        delete adminObj.password;

        res.status(201).json({
            success: true,
            message: 'Admin account created successfully',
            data: {
                token,
                user: {
                    ...adminObj,
                    role: adminRole,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get current user profile
 */
export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        const user = await User.findById(req.user._id).populate('role');
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }

        const userObj = user.toObject();
        delete userObj.password;

        res.status(200).json({
            success: true,
            data: {
                user: userObj,
                ...userObj,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update current user profile
 */
export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        const { fullName, email, phone, mobileNumber, profile_image } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }

        if (fullName && typeof fullName === 'string') {
            user.fullName = fullName.trim();
        }

        if (email && typeof email === 'string') {
            const normalizedEmail = email.toLowerCase().trim();
            if (normalizedEmail !== user.email) {
                const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
                if (existing) {
                    res.status(400).json({
                        success: false,
                        message: 'A user with this email already exists',
                    });
                    return;
                }
                user.email = normalizedEmail;
            }
        }

        const incomingPhone = mobileNumber || phone;
        if (incomingPhone && typeof incomingPhone === 'string') {
            const cleanPhone = incomingPhone.trim();
            user.mobileNumber = cleanPhone;
            user.phone = cleanPhone;
        }

        if (profile_image !== undefined) {
            user.profile_image = profile_image;
        }

        await user.save();
        await user.populate('role');

        const userObj = user.toObject();
        delete userObj.password;

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: userObj,
                ...userObj,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Change current user password
 */
export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user?._id;

        const user = await User.findById(userId).select('+password');
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            res.status(400).json({
                success: false,
                message: 'Incorrect current password',
            });
            return;
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Public Self-Registration for Sales Partners
 */
export const registerSalesPartner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        } = req.body;

        // Check if email already in use
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            res.status(400).json({
                success: false,
                message: 'A user with this email address already exists. Please sign in.',
            });
            return;
        }

        // Check if mobile already in use
        const existingMobile = await User.findOne({ mobileNumber });
        if (existingMobile) {
            res.status(400).json({
                success: false,
                message: 'A user with this mobile number already exists. Please sign in.',
            });
            return;
        }

        // Find or create default Sales Person role with appropriate permissions
        let salesRole = await Role.findOne({ name: 'Sales Person', isDeleted: false });
        if (!salesRole) {
            salesRole = await Role.create({
                name: 'Sales Person',
                description: 'Sales partner role for registering and managing service providers',
                permissions: [
                    { tab: 'dashboard', actions: [TabAction.READ] },
                    { tab: 'service_providers', actions: [TabAction.CREATE, TabAction.READ] },
                ],
                isActive: true,
                isDeleted: false,
                deletedAt: null,
            });
        }

        // Generate unique referenceCode for the new Sales Partner
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
            role: salesRole._id,
            userType: UserType.SALES_PERSON,
            referenceCode,
            isActive: true,
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
                approvalStatus: 'PENDING',
            },
        });

        res.status(201).json({
            success: true,
            message: 'Thank you! Your Sales Partner registration has been submitted successfully and is pending administrator approval.',
            data: {
                referenceCode: newSalesPartner.referenceCode,
                fullName: newSalesPartner.fullName,
                email: newSalesPartner.email,
                mobileNumber: newSalesPartner.mobileNumber,
                generatedPassword,
                tempPassword: generatedPassword,
                approvalStatus: 'PENDING',
                createdAt: newSalesPartner.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};


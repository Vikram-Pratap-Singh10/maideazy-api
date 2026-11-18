import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Razorpay from 'razorpay';
import jwt from 'jsonwebtoken';
import ServiceProvider, { ProviderApprovalStatus, PaymentStatus, } from '../models/service.provider.js';
import User, { UserType } from '../models/user.js';
import RegistrationPayment, { PaymentGateway } from '../models/payment.js';
import RegistrationFee from '../models/registrationFee.js';
import { AuthRequest } from '../middleware/auth.js';
import { ProviderAuthRequest } from '../middleware/providerAuth.js';
import { sendOtp } from '../services/fast2sms.js';
import OtpModel from '../models/Otp.js';

/**
 * Register a new Service Provider
 * Can use a sales person's referenceCode during registration
 */
export const registerProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            referenceCode,
            fullName,
            mobileNumber,
            dateOfBirth,
            gender,
            residentialAddress,
            permanentAddress,
            currentAddress,
            isCurrentSameAsPermanent,
            city,
            pinCode,
            jobRoles,
            preferredLocations,
            workTypes,
            expectedSalary,
            education,
            experience,
            profilePhoto,
            aadhaarNumber,
            aadhaarCardNumber,
            aadhaarDocument,
            aadhaarFrontDocument,
            aadhaarBackDocument,
            panCardNumber,
            panNumber,
            panCardDocument,
            panCardImage,
            agreeAccuracy,
            criminal,
            criminalDetails,
            agreePcc,
            agreeVerification,
            agreePrivacy,
        } = req.body;

        const resolvedAadhaarNumber = (aadhaarNumber || aadhaarCardNumber)?.trim();
        const resolvedAadhaarFrontDocument = (aadhaarFrontDocument || aadhaarDocument)?.trim();
        const resolvedAadhaarBackDocument = aadhaarBackDocument?.trim();
        const resolvedAadhaarDocument = (aadhaarDocument || aadhaarFrontDocument)?.trim();
        const resolvedPanCardNumber = (panCardNumber || panNumber)?.trim().toUpperCase();
        const resolvedPanCardDocument = (panCardDocument || panCardImage)?.trim();

        // Check if mobile number is already registered
        const existing = await ServiceProvider.findOne({ mobileNumber });
        if (existing) {
            if (existing.paymentStatus === PaymentStatus.SUCCESS) {
                res.status(400).json({
                    success: false,
                    message: 'A service provider with this mobile number is already registered and verified',
                });
                return;
            }

            // Existing candidate with pending payment: update profile details and create payment order
            let salesPersonId: Types.ObjectId | undefined = existing.salesPerson;
            let validReferenceCode: string | undefined = existing.referenceCode;

            if (referenceCode && referenceCode.trim()) {
                const formattedCode = referenceCode.trim().toUpperCase();
                const salesPerson = await User.findOne({
                    referenceCode: formattedCode,
                    isActive: true,
                });
                if (salesPerson) {
                    salesPersonId = salesPerson._id;
                    validReferenceCode = formattedCode;
                }
            }

            existing.fullName = fullName || existing.fullName;
            if (dateOfBirth) existing.dateOfBirth = dateOfBirth;
            if (gender) existing.gender = gender;
            if (residentialAddress) existing.residentialAddress = residentialAddress;
            if (permanentAddress !== undefined) existing.permanentAddress = permanentAddress;
            if (currentAddress !== undefined) existing.currentAddress = currentAddress;
            if (isCurrentSameAsPermanent !== undefined) existing.isCurrentSameAsPermanent = isCurrentSameAsPermanent;
            if (city) existing.city = city;
            if (pinCode) existing.pinCode = pinCode;
            if (jobRoles && jobRoles.length > 0) existing.jobRoles = jobRoles;
            if (preferredLocations && preferredLocations.length > 0) existing.preferredLocations = preferredLocations;
            if (workTypes && workTypes.length > 0) existing.workTypes = workTypes;
            if (expectedSalary !== undefined) existing.expectedSalary = expectedSalary;
            if (education !== undefined) existing.education = education;
            if (experience !== undefined) existing.experience = experience;
            if (profilePhoto !== undefined) existing.profilePhoto = profilePhoto;
            if (aadhaarNumber !== undefined || aadhaarCardNumber !== undefined) {
                existing.aadhaarNumber = aadhaarNumber || aadhaarCardNumber;
            }
            if (aadhaarFrontDocument !== undefined) existing.aadhaarFrontDocument = aadhaarFrontDocument;
            if (aadhaarBackDocument !== undefined) existing.aadhaarBackDocument = aadhaarBackDocument;
            if (aadhaarDocument !== undefined) {
                existing.aadhaarDocument = aadhaarDocument;
            } else if (aadhaarFrontDocument !== undefined) {
                existing.aadhaarDocument = aadhaarFrontDocument;
            }
            if (panCardNumber !== undefined || panNumber !== undefined) {
                existing.panCardNumber = panCardNumber || panNumber;
            }
            if (panCardDocument !== undefined || panCardImage !== undefined) {
                existing.panCardDocument = panCardDocument || panCardImage;
            }
            if (agreeAccuracy !== undefined) existing.agreeAccuracy = agreeAccuracy;
            if (criminal !== undefined) existing.criminal = criminal;
            if (criminalDetails !== undefined) existing.criminalDetails = criminalDetails;
            if (agreePcc !== undefined) existing.agreePcc = agreePcc;
            if (agreeVerification !== undefined) existing.agreeVerification = agreeVerification;
            if (agreePrivacy !== undefined) existing.agreePrivacy = agreePrivacy;
            if (validReferenceCode) existing.referenceCode = validReferenceCode;
            if (salesPersonId) existing.salesPerson = salesPersonId;
            await existing.save();

            const planParam = req.body.registrationFeeId || req.body.planId;
            let targetFeePlan = null;
            if (planParam && Types.ObjectId.isValid(planParam)) {
                targetFeePlan = await RegistrationFee.findById(planParam);
            }
            if (!targetFeePlan) {
                targetFeePlan = await RegistrationFee.findOne({ isActive: true }).sort({ isDefault: -1, updatedAt: -1 });
            }

            const isFreePlan = (targetFeePlan?.amount === 0) || (targetFeePlan?.planType === 'FREE');
            const extraRoleFee = 0;
            const baseAmount = isFreePlan ? 0 : Number(targetFeePlan?.amount || 0);
            const feeAmount = isFreePlan ? 0 : baseAmount;

            if (targetFeePlan) {
                existing.registrationFee = targetFeePlan._id;
            }
            existing.extraRoleCharge = extraRoleFee;

            if (isFreePlan) {
                existing.paymentStatus = PaymentStatus.SUCCESS;
                await existing.save();

                await RegistrationPayment.create({
                    providerId: existing._id,
                    amount: 0,
                    currency: 'INR',
                    status: PaymentStatus.SUCCESS,
                    gateway: PaymentGateway.FREE,
                    orderId: `free_${existing._id}_${Date.now()}`.slice(0, 40),
                    paymentId: `free_${existing._id}_${Date.now()}`.slice(0, 40),
                    paidAt: new Date(),
                    metadata: {
                        planId: targetFeePlan?._id,
                        planTitle: targetFeePlan?.title || 'Free Plan',
                        amount: 0,
                        isFreePlan: true,
                    },
                });

                res.status(200).json({
                    success: true,
                    message: 'Service provider registration retrieved and activated under Free Plan. Zero payment required.',
                    data: {
                        provider: existing,
                        paymentOrder: null,
                        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                        registrationFee: 0,
                        baseFee: 0,
                        extraRoleFee: 0,
                        plan: targetFeePlan,
                        isExistingPending: false,
                        isFreePlan: true,
                    },
                });
                return;
            }

            await existing.save();

            let paymentOrder: any = null;

            if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_SECRET) {
                try {
                    const razorpay = new Razorpay({
                        key_id: process.env.RAZORPAY_KEY_ID,
                        key_secret: process.env.RAZORPAY_SECRET,
                    });

                    paymentOrder = await razorpay.orders.create({
                        amount: Math.round(feeAmount * 100),
                        currency: 'INR',
                        receipt: `rec_reg_${existing._id}_${Date.now()}`.slice(0, 40),
                        notes: {
                            providerId: existing._id.toString(),
                            providerName: existing.fullName,
                            mobileNumber: existing.mobileNumber,
                            planId: targetFeePlan?._id ? targetFeePlan._id.toString() : '',
                            planTitle: targetFeePlan?.title || 'Registration Plan',
                            baseAmount: String(baseAmount),
                            extraRoleFee: String(extraRoleFee),
                            roleCount: String(existing.jobRoles?.length || 1),
                            type: 'PROVIDER_REGISTRATION',
                        },
                    });

                    await RegistrationPayment.create({
                        providerId: existing._id,
                        amount: feeAmount,
                        currency: 'INR',
                        status: PaymentStatus.PENDING,
                        gateway: PaymentGateway.RAZORPAY,
                        orderId: paymentOrder.id,
                        metadata: {
                            orderId: paymentOrder.id,
                            amount: feeAmount,
                            planId: targetFeePlan?._id,
                            planTitle: targetFeePlan?.title,
                            baseAmount,
                            extraRoleFee,
                        },
                    });
                } catch (err) {
                    console.error('Failed to create Razorpay order for existing provider:', err);
                }
            }

            res.status(200).json({
                success: true,
                message: 'Service provider registration retrieved. Please complete the registration payment.',
                data: {
                    provider: existing,
                    paymentOrder,
                    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                    registrationFee: feeAmount,
                    baseFee: baseAmount,
                    extraRoleFee,
                    plan: targetFeePlan,
                    isExistingPending: true,
                },
            });
            return;
        }

        let salesPersonId: Types.ObjectId | undefined;
        let validReferenceCode: string | undefined;

        // If referenceCode is provided, verify it belongs to an active sales person/team member
        if (referenceCode && referenceCode.trim()) {
            const formattedCode = referenceCode.trim().toUpperCase();
            const salesPerson = await User.findOne({
                referenceCode: formattedCode,
                isActive: true,
            });

            if (!salesPerson) {
                res.status(400).json({
                    success: false,
                    message: `Invalid reference code '${referenceCode}'. Please check and try again.`,
                });
                return;
            }

            salesPersonId = salesPerson._id;
            validReferenceCode = formattedCode;
        }

        const provider = await ServiceProvider.create({
            referenceCode: validReferenceCode,
            salesPerson: salesPersonId,
            fullName,
            mobileNumber,
            dateOfBirth,
            gender,
            residentialAddress,
            permanentAddress,
            currentAddress,
            isCurrentSameAsPermanent,
            city,
            pinCode,
            jobRoles,
            preferredLocations,
            workTypes,
            expectedSalary,
            education,
            experience,
            profilePhoto,
            aadhaarNumber: resolvedAadhaarNumber,
            aadhaarDocument: resolvedAadhaarDocument,
            aadhaarFrontDocument: resolvedAadhaarFrontDocument,
            aadhaarBackDocument: resolvedAadhaarBackDocument,
            panCardNumber: resolvedPanCardNumber,
            panCardDocument: resolvedPanCardDocument,
            agreeAccuracy,
            criminal,
            criminalDetails,
            agreePcc,
            agreeVerification,
            agreePrivacy,
            status: ProviderApprovalStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            isActive: true,
        });

        // Determine referral incentive amount from selected or default registration fee plan
        const planParam = req.body.registrationFeeId || req.body.planId;
        let targetFeePlan = null;
        if (planParam && Types.ObjectId.isValid(planParam)) {
            targetFeePlan = await RegistrationFee.findById(planParam);
        }
        if (!targetFeePlan) {
            targetFeePlan = await RegistrationFee.findOne({ isActive: true }).sort({ isDefault: -1, updatedAt: -1 });
        }

        const isFreePlan = (targetFeePlan?.amount === 0) || (targetFeePlan?.planType === 'FREE');
        const extraRoleFee = 0;
        const baseAmount = isFreePlan ? 0 : Number(targetFeePlan?.amount || 0);
        const feeAmount = isFreePlan ? 0 : baseAmount;

        // Attach plan and extra role fee to provider
        if (targetFeePlan) {
            provider.registrationFee = targetFeePlan._id;
        }
        provider.extraRoleCharge = extraRoleFee;

        let paymentOrder: any = null;

        if (isFreePlan) {
            provider.paymentStatus = PaymentStatus.SUCCESS;
            await provider.save();

            await RegistrationPayment.create({
                providerId: provider._id,
                amount: 0,
                currency: 'INR',
                status: PaymentStatus.SUCCESS,
                gateway: PaymentGateway.FREE,
                orderId: `free_${provider._id}_${Date.now()}`.slice(0, 40),
                paymentId: `free_${provider._id}_${Date.now()}`.slice(0, 40),
                paidAt: new Date(),
                metadata: {
                    planId: targetFeePlan?._id,
                    planTitle: targetFeePlan?.title || 'Free Plan',
                    amount: 0,
                    isFreePlan: true,
                },
            });

            res.status(201).json({
                success: true,
                message: 'Service provider registered successfully under Free Plan. Zero payment required.',
                data: {
                    provider,
                    paymentOrder: null,
                    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                    registrationFee: 0,
                    baseFee: 0,
                    extraRoleFee: 0,
                    plan: targetFeePlan,
                    isFreePlan: true,
                },
            });
            return;
        }

        await provider.save();

        // Note: Sales person commission is credited to wallet ONLY AFTER provider registration payment succeeds
        if (provider.paymentStatus === PaymentStatus.SUCCESS) {
            await creditSalesPersonCommission(provider._id);
        }

        // Automatically create Razorpay order for registration fee if keys configured
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_SECRET) {
            try {
                const razorpay = new Razorpay({
                    key_id: process.env.RAZORPAY_KEY_ID,
                    key_secret: process.env.RAZORPAY_SECRET,
                });

                paymentOrder = await razorpay.orders.create({
                    amount: Math.round(feeAmount * 100),
                    currency: 'INR',
                    receipt: `rec_reg_${provider._id}_${Date.now()}`.slice(0, 40),
                    notes: {
                        providerId: provider._id.toString(),
                        providerName: provider.fullName,
                        mobileNumber: provider.mobileNumber,
                        planId: targetFeePlan?._id ? targetFeePlan._id.toString() : '',
                        planTitle: targetFeePlan?.title || 'Registration Plan',
                        baseAmount: String(baseAmount),
                        extraRoleFee: String(extraRoleFee),
                        roleCount: String(jobRoles?.length || 1),
                        type: 'PROVIDER_REGISTRATION',
                    },
                });

                await RegistrationPayment.create({
                    providerId: provider._id,
                    amount: feeAmount,
                    currency: 'INR',
                    status: PaymentStatus.PENDING,
                    gateway: PaymentGateway.RAZORPAY,
                    orderId: paymentOrder.id,
                    metadata: {
                        orderId: paymentOrder.id,
                        amount: feeAmount,
                        planId: targetFeePlan?._id,
                        planTitle: targetFeePlan?.title,
                        baseAmount,
                        extraRoleFee,
                    },
                });
            } catch (err) {
                console.error('Failed to create Razorpay order during registration:', err);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Service provider registered successfully. Please complete the registration payment.',
            data: {
                provider,
                paymentOrder,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                registrationFee: feeAmount,
                baseFee: baseAmount,
                extraRoleFee,
                plan: targetFeePlan,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all Service Providers with filters, pagination, and sales person info
 */
export const getAllProviders = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            status,
            paymentStatus,
            jobRole,
            city,
            pinCode,
            referenceCode,
            salesPersonId,
            isActive,
        } = req.query as any;

        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(10000, Math.max(1, parseInt(String(limit), 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        const filter: Record<string, any> = {};

        if (status) filter.status = status;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (jobRole) filter.jobRoles = jobRole;
        if (city) filter.city = new RegExp(city.trim(), 'i');
        if (pinCode) filter.pinCode = pinCode.trim();
        if (referenceCode) filter.referenceCode = referenceCode.trim().toUpperCase();
        if (salesPersonId && Types.ObjectId.isValid(salesPersonId)) {
            filter.salesPerson = new Types.ObjectId(salesPersonId);
        }
        if (isActive !== undefined) {
            filter.isActive = String(isActive) === 'true';
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { fullName: regex },
                { mobileNumber: regex },
                { city: regex },
                { referenceCode: regex },
            ];
        }

        // If logged-in user is a Sales Person, restrict to only their registered / attributed providers
        if (req.user && req.user.userType === UserType.SALES_PERSON) {
            const userRefCode = req.user.referenceCode;
            const userId = req.user._id;

            const salesFilters: any[] = [{ salesPerson: userId }];
            if (userRefCode) {
                salesFilters.push({ referenceCode: userRefCode });
            }

            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, { $or: salesFilters }];
                delete filter.$or;
            } else {
                filter.$or = salesFilters;
            }
        }

        const [providers, total] = await Promise.all([
            ServiceProvider.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate('salesPerson', 'fullName email mobileNumber referenceCode')
                .populate('registrationFee', 'title planType amount currency validityInDays'),
            ServiceProvider.countDocuments(filter),
        ]);

        const providerIds = providers.map((p) => p._id);
        const payments = await RegistrationPayment.find({ providerId: { $in: providerIds } })
            .sort({ createdAt: -1 });

        const latestPaymentMap = new Map();
        payments.forEach((pay) => {
            if (!latestPaymentMap.has(pay.providerId.toString())) {
                latestPaymentMap.set(pay.providerId.toString(), pay);
            }
        });

        const providersWithPayment = providers.map((p) => {
            const pObj = p.toObject();
            const pay = latestPaymentMap.get(p._id.toString());
            const fee: any = p.registrationFee;
            const isPremium = fee && (fee.planType === 'PREMIUM' || /premium/i.test(fee.title));
            const planTitle = fee?.title || (isPremium ? 'Premium Plan' : 'Free Plan');
            const planType = fee?.planType || (isPremium ? 'PREMIUM' : 'FREE');
            const paymentAmount = pay?.amount !== undefined ? pay.amount : (fee?.amount !== undefined ? fee.amount : 0);

            return {
                ...pObj,
                planTitle,
                planType,
                paymentAmount,
                latestPayment: pay || null,
            };
        });

        res.status(200).json({
            success: true,
            data: {
                providers: providersWithPayment,
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
 * Get single Service Provider by ID
 */
export const getProviderById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Provider ID format',
            });
            return;
        }

        const provider = await ServiceProvider.findById(id)
            .populate('salesPerson', 'fullName email mobileNumber referenceCode')
            .populate('registrationFee', 'title planType amount currency validityInDays features');

        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Service provider not found',
            });
            return;
        }

        // Restrict Sales Person to only their own service providers
        if (req.user && req.user.userType === UserType.SALES_PERSON) {
            const currentUserId = req.user._id ? String(req.user._id) : '';
            const currentUserRefCode = req.user.referenceCode;

            const isOwner =
                (provider.salesPerson && String((provider.salesPerson as any)._id || provider.salesPerson) === currentUserId) ||
                (provider.referenceCode && currentUserRefCode && provider.referenceCode === currentUserRefCode);

            if (!isOwner) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied: You can only view service providers registered with your reference code',
                });
                return;
            }
        }

        res.status(200).json({
            success: true,
            data: { provider },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update Service Provider details
 */
export const updateProvider = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        if (updateData.emergencyName && !updateData.emergencyContactName) {
            updateData.emergencyContactName = updateData.emergencyName;
        }
        if (updateData.emergencyContactNo && !updateData.emergencyContactNumber) {
            updateData.emergencyContactNumber = updateData.emergencyContactNo;
        }
        if (updateData.emergencyRelation && !updateData.emergencyContactRelation) {
            updateData.emergencyContactRelation = updateData.emergencyRelation;
        }
        if (updateData.panNumber && !updateData.panCardNumber) {
            updateData.panCardNumber = updateData.panNumber;
        }
        if (updateData.panCardImage && !updateData.panCardDocument) {
            updateData.panCardDocument = updateData.panCardImage;
        }
        if (updateData.panCardNumber) {
            updateData.panCardNumber = updateData.panCardNumber.trim().toUpperCase();
        }
        if (updateData.aadhaarCardNumber && !updateData.aadhaarNumber) {
            updateData.aadhaarNumber = updateData.aadhaarCardNumber;
        }
        if (updateData.aadhaarNumber) {
            updateData.aadhaarNumber = updateData.aadhaarNumber.trim();
        }
        if (updateData.aadhaarFrontDocument && !updateData.aadhaarDocument) {
            updateData.aadhaarDocument = updateData.aadhaarFrontDocument;
        } else if (updateData.aadhaarDocument && !updateData.aadhaarFrontDocument) {
            updateData.aadhaarFrontDocument = updateData.aadhaarDocument;
        }

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Provider ID format',
            });
            return;
        }

        const provider = await ServiceProvider.findById(id);
        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Service provider not found',
            });
            return;
        }

        // If mobile number changed, ensure no conflict
        if (updateData.mobileNumber && updateData.mobileNumber !== provider.mobileNumber) {
            const conflict = await ServiceProvider.findOne({
                mobileNumber: updateData.mobileNumber,
                _id: { $ne: id },
            });
            if (conflict) {
                res.status(400).json({
                    success: false,
                    message: 'Another service provider with this mobile number already exists',
                });
                return;
            }
        }

        // If referenceCode changed, verify new sales person
        if (
            updateData.referenceCode &&
            updateData.referenceCode.trim().toUpperCase() !== provider.referenceCode
        ) {
            const formattedCode = updateData.referenceCode.trim().toUpperCase();
            const salesPerson = await User.findOne({
                referenceCode: formattedCode,
                isActive: true,
            });

            if (!salesPerson) {
                res.status(400).json({
                    success: false,
                    message: `Invalid reference code '${updateData.referenceCode}'.`,
                });
                return;
            }
            updateData.referenceCode = formattedCode;
            updateData.salesPerson = salesPerson._id;
        }

        const updated = await ServiceProvider.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        }).populate('salesPerson', 'fullName email mobileNumber referenceCode');

        if (updated && updated.paymentStatus === PaymentStatus.SUCCESS && !updated.commissionCredited) {
            await creditSalesPersonCommission(updated._id);
        }

        res.status(200).json({
            success: true,
            message: 'Service provider updated successfully',
            data: { provider: updated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update Provider Approval Status (PENDING, APPROVED, REJECTED)
 */
export const updateProviderStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Provider ID format',
            });
            return;
        }

        const provider = await ServiceProvider.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        ).populate('salesPerson', 'fullName email mobileNumber referenceCode');

        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Service provider not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Provider status updated to ${status}`,
            data: { provider },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update Provider Payment Status (PENDING, SUCCESS, FAILED, REFUNDED)
 */
export const updateProviderPaymentStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Provider ID format',
            });
            return;
        }

        const provider = await ServiceProvider.findByIdAndUpdate(
            id,
            { paymentStatus },
            { new: true }
        ).populate('salesPerson', 'fullName email mobileNumber referenceCode');

        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Service provider not found',
            });
            return;
        }

        // If paymentStatus became SUCCESS, credit sales person commission if not yet credited
        if (paymentStatus === PaymentStatus.SUCCESS) {
            await creditSalesPersonCommission(provider._id);
        }

        res.status(200).json({
            success: true,
            message: `Payment status updated to ${paymentStatus}`,
            data: { provider },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a Service Provider
 */
export const deleteProvider = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Provider ID format',
            });
            return;
        }

        const provider = await ServiceProvider.findByIdAndDelete(id);
        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Service provider not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Service provider deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Summary Statistics for Service Providers Dashboard
 */
export const getProviderStats = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const [
            total,
            pending,
            approved,
            rejected,
            paid,
            withReference,
            withoutReference,
        ] = await Promise.all([
            ServiceProvider.countDocuments(),
            ServiceProvider.countDocuments({ status: ProviderApprovalStatus.PENDING }),
            ServiceProvider.countDocuments({ status: ProviderApprovalStatus.APPROVED }),
            ServiceProvider.countDocuments({ status: ProviderApprovalStatus.REJECTED }),
            ServiceProvider.countDocuments({ paymentStatus: PaymentStatus.SUCCESS }),
            ServiceProvider.countDocuments({ referenceCode: { $exists: true, $ne: null } }),
            ServiceProvider.countDocuments({
                $or: [{ referenceCode: { $exists: false } }, { referenceCode: null }],
            }),
        ]);

        // Top 5 sales persons by onboarded providers count
        const topSalesPersons = await ServiceProvider.aggregate([
            { $match: { salesPerson: { $exists: true, $ne: null } } },
            { $group: { _id: '$salesPerson', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'salesPersonInfo',
                },
            },
            { $unwind: '$salesPersonInfo' },
            {
                $project: {
                    count: 1,
                    fullName: '$salesPersonInfo.fullName',
                    referenceCode: '$salesPersonInfo.referenceCode',
                    email: '$salesPersonInfo.email',
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data: {
                total,
                statusCounts: {
                    pending,
                    approved,
                    rejected,
                },
                paymentCounts: {
                    paid,
                    unpaid: total - paid,
                },
                onboardingSource: {
                    viaSalesTeam: withReference,
                    direct: withoutReference,
                },
                topSalesPersons,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Public: Get basic provider registration and payment status for payment flow & status checks
 */
export const getProviderPublicStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Provider ID format',
            });
            return;
        }

        const provider = await ServiceProvider.findById(id).select(
            'fullName mobileNumber city status paymentStatus jobRoles preferredLocations referenceCode profilePhoto agreeAccuracy criminal criminalDetails agreePcc agreeVerification agreePrivacy createdAt'
        );

        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Service provider not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: { provider },
        });
    } catch (error) {
        next(error);
    }
};




/**
 * Admin creates a Service Provider directly
 */
export const createProviderByAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            referenceCode,
            fullName,
            mobileNumber,
            dateOfBirth,
            gender,
            residentialAddress,
            permanentAddress,
            currentAddress,
            isCurrentSameAsPermanent,
            city,
            pinCode,
            jobRoles,
            preferredLocations,
            workTypes,
            expectedSalary,
            education,
            experience,
            workHours,
            profilePhoto,
            aadhaarNumber,
            aadhaarCardNumber,
            aadhaarDocument,
            aadhaarFrontDocument,
            aadhaarBackDocument,
            panCardNumber,
            panNumber,
            panCardDocument,
            panCardImage,
            emergencyContactName,
            emergencyContactNumber,
            emergencyContactRelation,
            emergencyName,
            emergencyContactNo,
            emergencyRelation,
            agreeAccuracy,
            criminal,
            criminalDetails,
            agreePcc,
            agreeVerification,
            agreePrivacy,
            status = ProviderApprovalStatus.APPROVED,
            paymentStatus = PaymentStatus.SUCCESS,
            isActive = true,
        } = req.body;

        const resolvedAadhaarNumber = (aadhaarNumber || aadhaarCardNumber)?.trim();
        const resolvedAadhaarFrontDocument = (aadhaarFrontDocument || aadhaarDocument)?.trim();
        const resolvedAadhaarBackDocument = aadhaarBackDocument?.trim();
        const resolvedAadhaarDocument = (aadhaarDocument || aadhaarFrontDocument)?.trim();
        const resolvedPanCardNumber = (panCardNumber || panNumber)?.trim().toUpperCase();
        const resolvedPanCardDocument = (panCardDocument || panCardImage)?.trim();

        const existing = await ServiceProvider.findOne({ mobileNumber });
        if (existing) {
            res.status(400).json({
                success: false,
                message: 'A service provider with this mobile number already exists',
            });
            return;
        }

        let salesPersonId: Types.ObjectId | undefined;
        let validReferenceCode: string | undefined;

        if (referenceCode && referenceCode.trim()) {
            const formattedCode = referenceCode.trim().toUpperCase();
            const salesPerson = await User.findOne({
                referenceCode: formattedCode,
                isActive: true,
            });
            if (salesPerson) {
                salesPersonId = salesPerson._id;
                validReferenceCode = formattedCode;
            }
        }

        // If creator is a Sales Person and no referenceCode was specified, link to themselves
        if (req.user && req.user.userType === UserType.SALES_PERSON && !salesPersonId) {
            salesPersonId = req.user._id;
            validReferenceCode = req.user.referenceCode;
        }

        const provider = await ServiceProvider.create({
            fullName,
            mobileNumber,
            dateOfBirth,
            gender,
            residentialAddress,
            permanentAddress,
            currentAddress,
            isCurrentSameAsPermanent,
            city,
            pinCode,
            jobRoles,
            preferredLocations,
            workTypes,
            expectedSalary,
            education,
            experience,
            workHours,
            profilePhoto,
            aadhaarNumber: resolvedAadhaarNumber,
            aadhaarDocument: resolvedAadhaarDocument,
            aadhaarFrontDocument: resolvedAadhaarFrontDocument,
            aadhaarBackDocument: resolvedAadhaarBackDocument,
            panCardNumber: resolvedPanCardNumber,
            panCardDocument: resolvedPanCardDocument,
            emergencyContactName,
            emergencyContactNumber,
            emergencyContactRelation,
            emergencyName,
            emergencyContactNo,
            emergencyRelation,
            agreeAccuracy,
            criminal,
            criminalDetails,
            agreePcc,
            agreeVerification,
            agreePrivacy,
            referenceCode: validReferenceCode,
            salesPerson: salesPersonId,
            status,
            paymentStatus,
            isActive,
        });

        // Attach registration fee plan if provided or default
        const targetFeePlan = req.body.registrationFeeId
            ? await RegistrationFee.findById(req.body.registrationFeeId)
            : await RegistrationFee.findOne({ isActive: true }).sort({ isDefault: -1, updatedAt: -1 });

        if (targetFeePlan) {
            provider.registrationFee = targetFeePlan._id;
            await provider.save();
        }

        // Credit referral incentive to sales person wallet ONLY if paymentStatus is SUCCESS
        if (paymentStatus === PaymentStatus.SUCCESS) {
            await creditSalesPersonCommission(provider._id);
        }

        const created = await ServiceProvider.findById(provider._id).populate(
            'salesPerson',
            'fullName email mobileNumber referenceCode'
        );

        res.status(201).json({
            success: true,
            message: 'Service provider created successfully by admin',
            data: { provider: created },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Credit commission to sales person's wallet upon successful provider registration payment
 */
export const creditSalesPersonCommission = async (
    providerId: Types.ObjectId | string
): Promise<{ success: boolean; commissionAmount?: number; salesPersonId?: Types.ObjectId }> => {
    try {
        const provider = await ServiceProvider.findById(providerId);
        if (!provider) {
            return { success: false };
        }

        // Must be paid and not already credited
        if (provider.paymentStatus !== PaymentStatus.SUCCESS || provider.commissionCredited) {
            return { success: false };
        }

        // Resolve sales person
        let salesPersonId: Types.ObjectId | undefined = provider.salesPerson;
        if (!salesPersonId && provider.referenceCode) {
            const formattedCode = provider.referenceCode.trim().toUpperCase();
            const salesPerson = await User.findOne({
                referenceCode: formattedCode,
                isActive: true,
            });
            if (salesPerson) {
                salesPersonId = salesPerson._id;
                provider.salesPerson = salesPerson._id;
            }
        }

        if (!salesPersonId) {
            return { success: false };
        }

        // Fetch commission amount from provider's selected registrationFee plan or default plan
        let commissionAmount = 50;
        let targetFeePlan = null;
        if (provider.registrationFee) {
            targetFeePlan = await RegistrationFee.findById(provider.registrationFee);
        }
        if (!targetFeePlan) {
            targetFeePlan = await RegistrationFee.findOne({ isActive: true }).sort({ isDefault: -1, updatedAt: -1 });
        }

        if (targetFeePlan && typeof targetFeePlan.salesPersonCommission === 'number' && targetFeePlan.salesPersonCommission >= 0) {
            commissionAmount = targetFeePlan.salesPersonCommission;
        }

        // Credit referral commission to sales person's wallet_balance
        const updatedUser = await User.findByIdAndUpdate(
            salesPersonId,
            { $inc: { wallet_balance: commissionAmount } },
            { new: true }
        );

        // Mark as credited on provider to prevent duplicate payouts
        provider.commissionCredited = true;
        provider.commissionAmount = commissionAmount;
        await provider.save();

        console.log(
            `[Wallet Credited] Successfully credited ₹${commissionAmount} to Sales Person (${updatedUser?.fullName || salesPersonId}, Balance: ₹${updatedUser?.wallet_balance}) for Provider ${provider.fullName} (${provider._id})`
        );

        return { success: true, commissionAmount, salesPersonId };
    } catch (err) {
        console.error('Error crediting sales person commission:', err);
        return { success: false };
    }
};

/**
 * Partner Auth: Send OTP to partner mobile using Fast2SMS DLT service
 */
export const sendPartnerOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { mobileNumber } = req.body;
        const cleanMobile = String(mobileNumber || '').trim().replace(/\D/g, '').slice(-10);

        if (!cleanMobile || !/^[6-9]\d{9}$/.test(cleanMobile)) {
            res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit mobile number',
            });
            return;
        }

        const provider = await ServiceProvider.findOne({ mobileNumber: cleanMobile });
        if (!provider) {
            res.status(404).json({
                success: false,
                message: `No partner registered with mobile number ${cleanMobile}. Please register as a partner first.`,
            });
            return;
        }

        if (provider.isActive === false) {
            res.status(403).json({
                success: false,
                message: 'Your partner account has been deactivated. Please contact support.',
            });
            return;
        }

        // Send OTP via Fast2SMS service and store in DB
        const smsResult = await sendOtp(cleanMobile);
        if (!smsResult.success) {
            res.status(500).json({
                success: false,
                message: smsResult.message || 'Failed to send OTP. Please try again.',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: `OTP sent successfully to ${cleanMobile}`,
            data: {
                mobileNumber: cleanMobile,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Partner Auth: Verify OTP and login
 * Strictly verifies against OtpModel in database
 */
export const verifyPartnerOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { mobileNumber, otp } = req.body;
        const cleanMobile = String(mobileNumber || '').trim().replace(/\D/g, '').slice(-10);
        const cleanOtp = String(otp || '').trim();

        if (!cleanMobile || !/^[6-9]\d{9}$/.test(cleanMobile)) {
            res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit mobile number',
            });
            return;
        }

        if (!cleanOtp) {
            res.status(400).json({
                success: false,
                message: 'Please enter the 4-digit OTP',
            });
            return;
        }

        // Look up OTP record in database
        const otpRecord = await OtpModel.findOne({ phoneNumber: cleanMobile });
        const now = new Date();

        if (!otpRecord) {
            res.status(400).json({
                success: false,
                message: 'No OTP request found for this mobile number or it has expired. Please request a new OTP.',
            });
            return;
        }

        if (now > new Date(otpRecord.expiry)) {
            await OtpModel.deleteMany({ phoneNumber: cleanMobile });
            res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new OTP.',
            });
            return;
        }

        if (otpRecord.otp !== cleanOtp) {
            res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please enter the correct verification code received on your phone.',
            });
            return;
        }

        // Delete used OTP so it cannot be replayed
        await OtpModel.deleteMany({ phoneNumber: cleanMobile });

        const provider = await ServiceProvider.findOne({ mobileNumber: cleanMobile })
            .populate('registrationFee')
            .populate('salesPerson', 'fullName email mobile referenceCode');

        if (!provider) {
            res.status(404).json({
                success: false,
                message: `No partner registered with mobile number ${cleanMobile}.`,
            });
            return;
        }

        if (provider.isActive === false) {
            res.status(403).json({
                success: false,
                message: 'Your partner account has been deactivated. Please contact support.',
            });
            return;
        }

        // Fetch latest payment record
        const latestPayment = await RegistrationPayment.findOne({ providerId: provider._id })
            .sort({ createdAt: -1 });

        const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
        const token = jwt.sign(
            {
                id: provider._id.toString(),
                mobileNumber: provider.mobileNumber,
                role: 'SERVICE_PROVIDER',
                type: 'SERVICE_PROVIDER',
            },
            secret,
            { expiresIn: '30d' }
        );

        res.status(200).json({
            success: true,
            message: 'Partner login successful',
            data: {
                token,
                provider,
                latestPayment,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Partner: Get own profile details, purchased plan, and payment status
 */
export const getPartnerProfile = async (req: ProviderAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const providerId = req.providerId || req.provider?._id;
        const provider = await ServiceProvider.findById(providerId)
            .populate('registrationFee')
            .populate('salesPerson', 'fullName email mobile referenceCode');

        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Partner profile not found',
            });
            return;
        }

        const payments = await RegistrationPayment.find({ providerId })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                provider,
                payments,
                latestPayment: payments.length > 0 ? payments[0] : null,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Partner: Update own profile details
 */
export const updatePartnerProfile = async (req: ProviderAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const providerId = req.providerId || req.provider?._id;
        const provider = await ServiceProvider.findById(providerId);

        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Partner profile not found',
            });
            return;
        }

        const {
            fullName,
            dateOfBirth,
            gender,
            residentialAddress,
            permanentAddress,
            currentAddress,
            isCurrentSameAsPermanent,
            city,
            pinCode,
            jobRoles,
            preferredLocations,
            workTypes,
            expectedSalary,
            education,
            experience,
            profilePhoto,
            aadhaarNumber,
            aadhaarDocument,
            aadhaarFrontDocument,
            aadhaarBackDocument,
            panCardNumber,
            panCardDocument,
        } = req.body;

        if (fullName) provider.fullName = fullName.trim();
        if (dateOfBirth) provider.dateOfBirth = new Date(dateOfBirth);
        if (gender) provider.gender = gender;
        if (residentialAddress) provider.residentialAddress = residentialAddress.trim();
        if (permanentAddress !== undefined) provider.permanentAddress = permanentAddress?.trim();
        if (currentAddress !== undefined) provider.currentAddress = currentAddress?.trim();
        if (isCurrentSameAsPermanent !== undefined) provider.isCurrentSameAsPermanent = Boolean(isCurrentSameAsPermanent);
        if (city) provider.city = city.trim();
        if (pinCode) provider.pinCode = pinCode.trim();
        if (Array.isArray(jobRoles) && jobRoles.length > 0) provider.jobRoles = jobRoles;
        if (Array.isArray(preferredLocations) && preferredLocations.length > 0) provider.preferredLocations = preferredLocations;
        if (Array.isArray(workTypes) && workTypes.length > 0) provider.workTypes = workTypes;
        if (expectedSalary !== undefined) provider.expectedSalary = Number(expectedSalary);
        if (education !== undefined) provider.education = education?.trim();
        if (experience !== undefined) provider.experience = experience?.trim();
        if (profilePhoto !== undefined) provider.profilePhoto = profilePhoto?.trim();
        if (aadhaarNumber !== undefined) provider.aadhaarNumber = aadhaarNumber?.trim();
        if (aadhaarFrontDocument !== undefined) provider.aadhaarFrontDocument = aadhaarFrontDocument?.trim();
        if (aadhaarBackDocument !== undefined) provider.aadhaarBackDocument = aadhaarBackDocument?.trim();
        if (aadhaarDocument !== undefined) {
            provider.aadhaarDocument = aadhaarDocument?.trim();
        } else if (aadhaarFrontDocument !== undefined) {
            provider.aadhaarDocument = aadhaarFrontDocument?.trim();
        }
        if (panCardNumber !== undefined) provider.panCardNumber = panCardNumber?.trim().toUpperCase();
        if (panCardDocument !== undefined) provider.panCardDocument = panCardDocument?.trim();

        await provider.save();

        const updated = await ServiceProvider.findById(provider._id)
            .populate('registrationFee')
            .populate('salesPerson', 'fullName email mobile referenceCode');

        const latestPayment = await RegistrationPayment.findOne({ providerId: provider._id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Partner profile updated successfully',
            data: {
                provider: updated,
                latestPayment,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Directly upgrade a Service Provider's Free Plan to Premium Plan
 */
export const adminUpgradeToPremium = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Provider ID format',
            });
            return;
        }

        const provider = await ServiceProvider.findById(id);
        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Service provider not found',
            });
            return;
        }

        // Find active Premium plan
        let premiumPlan = await RegistrationFee.findOne({
            isActive: true,
            $or: [{ planType: 'PREMIUM' }, { title: /premium/i }],
        });

        if (!premiumPlan) {
            premiumPlan = await RegistrationFee.create({
                title: 'Premium Plan',
                planType: 'PREMIUM',
                amount: 999,
                originalAmount: 1999,
                currency: 'INR',
                salesPersonCommission: 100,
                features: [
                    'Top Priority Placement & Gold Verified Badge',
                    'Instant High-Value Job Leads First',
                    'Dedicated Placement Manager Support',
                    'Free Profile Background Verification Certificate',
                    'Priority 24/7 Helpline Access',
                ],
                description: 'Featured placement with top job opportunities and personal relationship manager',
                validityInDays: 365,
                isActive: true,
                isDefault: false,
                createdBy: req.user?._id,
            });
        }

        // Update provider to Premium Plan
        provider.registrationFee = premiumPlan._id;
        provider.paymentStatus = PaymentStatus.SUCCESS;
        await provider.save();

        // Record the upgrade payment
        const paymentRecord = await RegistrationPayment.create({
            providerId: provider._id,
            amount: premiumPlan.amount,
            currency: 'INR',
            status: PaymentStatus.SUCCESS,
            gateway: PaymentGateway.MANUAL,
            orderId: `admin_upgrade_${provider._id}_${Date.now()}`.slice(0, 40),
            paymentId: `admin_upgrade_${provider._id}_${Date.now()}`.slice(0, 40),
            paidAt: new Date(),
            metadata: {
                upgradedBy: req.user?._id,
                upgradedByName: req.user?.fullName,
                upgradedByEmail: req.user?.email,
                upgradedByRole: req.user?.userType,
                planId: premiumPlan._id,
                planTitle: premiumPlan.title,
                amount: premiumPlan.amount,
                note: 'Upgraded to Premium Plan directly by Admin',
            },
        });

        // Credit sales commission if provider has a sales person
        if (provider.salesPerson) {
            await creditSalesPersonCommission(provider._id);
        }

        const updatedProvider = await ServiceProvider.findById(provider._id)
            .populate('registrationFee')
            .populate('salesPerson', 'fullName email mobileNumber referenceCode');

        res.status(200).json({
            success: true,
            message: `Successfully upgraded ${provider.fullName} to Premium Plan!`,
            data: {
                provider: updatedProvider,
                payment: paymentRecord,
                plan: premiumPlan,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Complete Free Plan registration for a candidate (₹0)
 */
export const completeFreePlanRegistration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { planId } = req.body;

        if (!id || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Provider ID format',
            });
            return;
        }

        const provider = await ServiceProvider.findById(id);
        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Service provider not found',
            });
            return;
        }

        let targetPlan = null;
        if (planId && Types.ObjectId.isValid(planId)) {
            targetPlan = await RegistrationFee.findById(planId);
        }
        if (!targetPlan) {
            targetPlan = await RegistrationFee.findOne({
                isActive: true,
                $or: [{ planType: 'FREE' }, { amount: 0 }, { title: /free/i }],
            });
        }

        if (targetPlan && targetPlan.amount > 0) {
            res.status(400).json({
                success: false,
                message: 'Selected plan is not a Free Plan. Payment is required.',
            });
            return;
        }

        if (targetPlan) {
            provider.registrationFee = targetPlan._id;
        }
        provider.paymentStatus = PaymentStatus.SUCCESS;
        provider.extraRoleCharge = 0;
        await provider.save();

        // Check if payment record already exists
        const existingPayment = await RegistrationPayment.findOne({
            providerId: provider._id,
            status: PaymentStatus.SUCCESS,
        });

        if (!existingPayment) {
            await RegistrationPayment.create({
                providerId: provider._id,
                amount: 0,
                currency: 'INR',
                status: PaymentStatus.SUCCESS,
                gateway: PaymentGateway.FREE,
                orderId: `free_${provider._id}_${Date.now()}`.slice(0, 40),
                paymentId: `free_${provider._id}_${Date.now()}`.slice(0, 40),
                paidAt: new Date(),
                metadata: {
                    planId: targetPlan?._id,
                    planTitle: targetPlan?.title || 'Free Plan',
                    amount: 0,
                    isFreePlan: true,
                },
            });
        }

        const updatedProvider = await ServiceProvider.findById(provider._id)
            .populate('registrationFee')
            .populate('salesPerson', 'fullName email mobileNumber referenceCode');

        res.status(200).json({
            success: true,
            message: 'Free Plan activated successfully! No payment required.',
            data: {
                provider: updatedProvider,
                plan: targetPlan,
            },
        });
    } catch (error) {
        next(error);
    }
};

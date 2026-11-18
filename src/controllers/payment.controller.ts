import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Types } from 'mongoose';
import RegistrationPayment, { PaymentStatus, PaymentGateway } from '../models/payment.js';
import ServiceProvider from '../models/service.provider.js';
import RegistrationFee from '../models/registrationFee.js';
import Coupon from '../models/coupon.js';
import { AuthRequest } from '../middleware/auth.js';
import { creditSalesPersonCommission } from './serviceProvider.controller.js';

const getRazorpayInstance = (): Razorpay => {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_SECRET;

    if (!key_id || !key_secret) {
        throw new Error('Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_SECRET) are not configured');
    }

    return new Razorpay({ key_id, key_secret });
};

/**
 * 1. Create Razorpay order for Service Provider Registration Fee
 */
export const createRegistrationOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { providerId, planId, amount, couponCode } = req.body;

        // Verify provider exists
        const provider = await ServiceProvider.findById(providerId);
        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Service provider not found',
            });
            return;
        }

        const isUpgrade = Boolean(req.body.isUpgrade);

        // Fetch selected or active default registration fee configuration
        let targetPlan = null;
        if (planId && Types.ObjectId.isValid(planId)) {
            targetPlan = await RegistrationFee.findById(planId);
        }
        if ((!targetPlan || (isUpgrade && targetPlan.amount === 0)) && isUpgrade) {
            targetPlan = await RegistrationFee.findOne({
                isActive: true,
                $or: [{ planType: 'PREMIUM' }, { title: { $regex: /premium/i } }, { amount: { $gt: 0 } }]
            }).sort({ updatedAt: -1 });
        }
        if (!targetPlan) {
            targetPlan = await RegistrationFee.findOne({ isActive: true }).sort({ isDefault: -1, updatedAt: -1 });
        }

        // Check if already paid - allow if this is an upgrade to Premium Plan
        if (provider.paymentStatus === PaymentStatus.SUCCESS) {
            const currentPlan = provider.registrationFee ? await RegistrationFee.findById(provider.registrationFee) : null;
            const isAlreadyPremium = currentPlan && (currentPlan.planType === 'PREMIUM' || /premium/i.test(currentPlan.title));

            if (isAlreadyPremium) {
                res.status(400).json({
                    success: false,
                    message: 'Service provider is already on the Premium Plan',
                    data: { provider },
                });
                return;
            }

            if (!isUpgrade && targetPlan && targetPlan.amount === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Registration fee has already been completed for this service provider',
                    data: { provider },
                });
                return;
            }
        }

        const baseAmount = Number(targetPlan?.amount || process.env.PROVIDER_REGISTRATION_FEE || 499);
        const roleCount = provider.jobRoles?.length || 1;
        const extraRoleFee = 0;
        const calculatedTotal = baseAmount;

        // Process coupon code if provided and partner was NOT referred by a sales partner reference code
        const hasReferenceCode = Boolean(provider.referenceCode && provider.referenceCode.trim());
        let appliedCoupon = null;
        let discountAmount = 0;
        if (couponCode && typeof couponCode === 'string' && couponCode.trim() && !hasReferenceCode) {
            const normalizedCode = couponCode.trim().toUpperCase();
            const coupon = await Coupon.findOne({ code: normalizedCode });
            if (coupon && coupon.isActive) {
                const now = new Date();
                const isValidDate = (!coupon.validFrom || now >= new Date(coupon.validFrom)) &&
                                    (!coupon.validTill || now <= new Date(coupon.validTill));
                const isUnderLimit = !coupon.maxUses || coupon.maxUses === 0 || coupon.usedCount < coupon.maxUses;

                let isPlanApplicable = true;
                if (coupon.applicablePlans && coupon.applicablePlans.length > 0) {
                    const planIdStr = targetPlan?._id ? targetPlan._id.toString() : '';
                    isPlanApplicable = coupon.applicablePlans.some(
                        (p) => p.toString() === planIdStr
                    );
                }

                if (isValidDate && isUnderLimit && isPlanApplicable) {
                    if (coupon.discountType === 'PERCENTAGE') {
                        discountAmount = Math.round((calculatedTotal * coupon.discountAmount) / 100);
                        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
                            discountAmount = coupon.maxDiscountAmount;
                        }
                    } else {
                        discountAmount = coupon.discountAmount;
                    }
                    discountAmount = Math.min(discountAmount, calculatedTotal);
                    appliedCoupon = coupon;

                    // Increment used count
                    coupon.usedCount = (coupon.usedCount || 0) + 1;
                    await coupon.save();
                }
            }
        }

        const finalTotal = Math.max(1, calculatedTotal - discountAmount);
        const feeAmount = amount ? Number(amount) : finalTotal;

        const razorpay = getRazorpayInstance();

        const options = {
            amount: Math.round(feeAmount * 100), // amount in paise
            currency: 'INR',
            receipt: `rec_reg_${providerId}_${Date.now()}`.slice(0, 40),
            notes: {
                providerId: providerId.toString(),
                providerName: provider.fullName,
                mobileNumber: provider.mobileNumber,
                planId: targetPlan?._id ? targetPlan._id.toString() : '',
                planTitle: targetPlan?.title || 'Registration Plan',
                baseAmount: String(baseAmount),
                extraRoleFee: String(extraRoleFee),
                roleCount: String(roleCount),
                discountAmount: String(discountAmount),
                couponCode: appliedCoupon ? appliedCoupon.code : '',
                type: 'PROVIDER_REGISTRATION',
            },
        };

        const order = await razorpay.orders.create(options);

        // Record the pending registration payment
        const paymentRecord = await RegistrationPayment.create({
            providerId: provider._id,
            amount: feeAmount,
            currency: 'INR',
            status: PaymentStatus.PENDING,
            gateway: PaymentGateway.RAZORPAY,
            orderId: order.id,
            metadata: {
                orderId: order.id,
                amount: feeAmount,
                planId: targetPlan?._id,
                planTitle: targetPlan?.title,
                baseAmount,
                extraRoleFee,
                roleCount,
                discountAmount,
                couponCode: appliedCoupon ? appliedCoupon.code : undefined,
                couponId: appliedCoupon ? appliedCoupon._id : undefined,
            },
        });

        // Link plan and extra role fee to provider
        if (targetPlan) {
            provider.registrationFee = targetPlan._id;
        }
        provider.extraRoleCharge = extraRoleFee;
        await provider.save();

        res.status(200).json({
            success: true,
            message: 'Razorpay registration order created successfully',
            data: {
                order,
                keyId: process.env.RAZORPAY_KEY_ID,
                paymentRecordId: paymentRecord._id,
                providerId: provider._id,
                amount: feeAmount,
                baseAmount,
                extraRoleFee,
                roleCount,
                discountAmount,
                coupon: appliedCoupon
                    ? {
                          code: appliedCoupon.code,
                          discountAmount,
                          discountType: appliedCoupon.discountType,
                      }
                    : null,
                plan: targetPlan,
            },
        });
    } catch (error) {
        console.log(error)
        next(error);
    }
};

/**
 * 2. Verify Razorpay Payment Signature and update provider paymentStatus to SUCCESS
 */
export const verifyPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { providerId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!providerId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            res.status(400).json({
                success: false,
                message: 'providerId, razorpay_order_id, razorpay_payment_id, and razorpay_signature are required',
            });
            return;
        }

        const provider = await ServiceProvider.findById(providerId);
        if (!provider) {
            res.status(404).json({
                success: false,
                message: 'Service provider not found',
            });
            return;
        }

        // Generate expected signature
        const secret = process.env.RAZORPAY_SECRET!;
        const generatedSignature = crypto
            .createHmac('sha256', secret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            // Signature verification failed
            await RegistrationPayment.findOneAndUpdate(
                { orderId: razorpay_order_id },
                {
                    status: PaymentStatus.FAILED,
                    paymentId: razorpay_payment_id,
                    signature: razorpay_signature,
                    failureReason: 'Signature verification mismatch',
                }
            );

            res.status(400).json({
                success: false,
                message: 'Invalid payment signature. Transaction is not legit!',
            });
            return;
        }

        // Signature verified successfully -> update payment record
        const paymentRecord = await RegistrationPayment.findOneAndUpdate(
            { orderId: razorpay_order_id },
            {
                status: PaymentStatus.SUCCESS,
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                paidAt: new Date(),
            },
            { new: true }
        );

        if (paymentRecord?.metadata?.planId) {
            provider.registrationFee = paymentRecord.metadata.planId;
        }

        // Update provider paymentStatus to SUCCESS
        provider.paymentStatus = PaymentStatus.SUCCESS;
        await provider.save();

        // Credit sales person commission to wallet if registered with a reference code
        await creditSalesPersonCommission(provider._id);

        const updatedProvider = await ServiceProvider.findById(provider._id)
            .populate('registrationFee')
            .populate('salesPerson', 'fullName email mobileNumber referenceCode');

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully. Provider registration is now complete!',
            data: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                paymentStatus: provider.paymentStatus,
                provider: updatedProvider || provider,
                paymentRecord,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 3. Razorpay Webhook Handler
 */
export const razorpayWebhook = async (req: Request, res: Response): Promise<any> => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const razorpaySignature = req.headers['x-razorpay-signature'] as string;

        if (!razorpaySignature) {
            console.warn('Razorpay Webhook: Missing webhook signature');
            return res.status(400).json({ success: false, message: 'Missing webhook signature' });
        }

        if (!webhookSecret) {
            console.error('Razorpay Webhook: Webhook secret not configured');
            return res.status(500).json({ success: false, message: 'Webhook secret not configured' });
        }

        // Extract raw buffer or string payload for HMAC verification
        const rawBody =
            (req as any).rawBody ||
            (Buffer.isBuffer(req.body)
                ? req.body
                : typeof req.body === 'string'
                    ? req.body
                    : JSON.stringify(req.body));

        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');

        if (expectedSignature !== razorpaySignature) {
            console.warn('Razorpay Webhook: Invalid webhook signature');
            return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
        }

        // Parse payload
        const payload =
            typeof req.body === 'object' && !(req.body instanceof Buffer)
                ? req.body
                : JSON.parse(rawBody.toString());

        const event = payload.event;
        console.log(`Razorpay Webhook Event Received: ${event}`);

        // Handle payment.captured
        if (event === 'payment.captured') {
            const paymentEntity = payload.payload?.payment?.entity;
            if (!paymentEntity) {
                return res.status(200).json({ success: true, message: 'No payment entity found, ignored' });
            }

            const orderId = paymentEntity.order_id;
            const paymentId = paymentEntity.id;

            // Find matching registration payment
            const transaction = await RegistrationPayment.findOne({ orderId });
            if (transaction) {
                transaction.status = PaymentStatus.SUCCESS;
                transaction.paymentId = paymentId;
                transaction.paidAt = new Date();
                transaction.metadata = {
                    ...transaction.metadata,
                    webhookCapturedAt: new Date(),
                    paymentMethod: paymentEntity.method,
                };
                await transaction.save();

                // Update provider paymentStatus to SUCCESS
                const provider = await ServiceProvider.findById(transaction.providerId);
                if (provider) {
                    provider.paymentStatus = PaymentStatus.SUCCESS;
                    await provider.save();
                    console.log(`Provider ${provider.fullName} (${provider._id}) paymentStatus updated to SUCCESS via Webhook`);

                    // Credit sales person commission to wallet if registered with a reference code
                    await creditSalesPersonCommission(provider._id);
                }
            } else {
                console.log(`Registration transaction for order ${orderId} not found in database`);
            }
        } else if (event === 'payment.failed') {
            const paymentEntity = payload.payload?.payment?.entity;
            if (paymentEntity?.order_id) {
                await RegistrationPayment.findOneAndUpdate(
                    { orderId: paymentEntity.order_id },
                    {
                        status: PaymentStatus.FAILED,
                        paymentId: paymentEntity.id,
                        failureReason: paymentEntity.error_description || 'Payment failed',
                    }
                );
            }
        }

        return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (err) {
        console.error('Razorpay Webhook Error:', err);
        return res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
};

/**
 * 4. Get payment history for a provider (authenticated)
 */
export const getProviderPayments = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { providerId } = req.params;

        if (!providerId || !Types.ObjectId.isValid(providerId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid Provider ID format',
            });
            return;
        }

        const payments = await RegistrationPayment.find({ providerId })
            .sort({ createdAt: -1 })
            .populate('providerId', 'fullName mobileNumber status paymentStatus');

        res.status(200).json({
            success: true,
            data: { payments },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 5. List all registration payments (authenticated admin)
 */
export const getAllRegistrationPayments = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { page = 1, limit = 10, status, providerId, startDate, endDate } = req.query as any;

        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(10000, Math.max(1, parseInt(String(limit), 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        const filter: Record<string, any> = {};
        if (status) filter.status = status;
        if (providerId && Types.ObjectId.isValid(providerId)) filter.providerId = new Types.ObjectId(providerId);

        if (startDate || endDate) {
            const dateFilter: Record<string, any> = {};
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                dateFilter.$gte = s;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                dateFilter.$lte = e;
            }
            filter.createdAt = dateFilter;
        }

        const [payments, total] = await Promise.all([
            RegistrationPayment.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate('providerId', 'fullName mobileNumber status paymentStatus referenceCode'),
            RegistrationPayment.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            data: {
                payments,
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


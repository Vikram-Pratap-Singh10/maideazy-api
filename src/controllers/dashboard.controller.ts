import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import User, { UserType } from '../models/user.js';
import ServiceProvider, { ProviderApprovalStatus } from '../models/service.provider.js';
import { RegistrationPayment, PaymentStatus } from '../models/payment.js';

/**
 * Helper to compute date range filter bounds
 */
const getDateRange = (filter?: string, customStart?: string, customEnd?: string) => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date = now;
    let label = 'Till Date (All Time)';

    const normalized = String(filter || 'tillDate').toLowerCase().trim();

    if (normalized === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        label = 'Today';
    } else if (normalized === 'last7days' || normalized === '7days') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        label = 'Last 7 Days';
    } else if (normalized === 'last30days' || normalized === '30days') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        label = 'Last 30 Days';
    } else if (normalized === 'quarterly' || normalized === '90days') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        label = 'Quarterly (Last 90 Days)';
    } else if (normalized === 'halfyearly' || normalized === '180days') {
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        label = 'Half-Yearly (Last 180 Days)';
    } else if (normalized === 'custom' && (customStart || customEnd)) {
        if (customStart) {
            startDate = new Date(customStart);
            startDate.setHours(0, 0, 0, 0);
        }
        if (customEnd) {
            endDate = new Date(customEnd);
            endDate.setHours(23, 59, 59, 999);
        }
        label = `Custom (${startDate ? startDate.toLocaleDateString() : 'Start'} - ${endDate.toLocaleDateString()})`;
    } else {
        startDate = null;
        label = 'Till Date (All Time)';
    }

    return { startDate, endDate, label, filter: normalized };
};

/**
 * Get unified, role-aware dashboard statistics and recent providers
 * Supports date filtering: today, last7days, last30days, quarterly, halfYearly, tillDate, custom
 */
export const getDashboardStats = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = req.user;
        const isSalesPerson = user?.userType === UserType.SALES_PERSON;

        const { filter, dateFilter, startDate: qStart, endDate: qEnd } = req.query as any;
        const { startDate, endDate, label, filter: appliedFilter } = getDateRange(
            filter || dateFilter,
            qStart,
            qEnd
        );

        const dateQuery = startDate ? { createdAt: { $gte: startDate, $lte: endDate } } : {};

        if (isSalesPerson && user) {
            // SALES PERSON DASHBOARD
            const userRefCode = user.referenceCode;
            const userId = user._id;

            const salesFilter: any[] = [{ salesPerson: userId }];
            if (userRefCode) {
                salesFilter.push({ referenceCode: userRefCode });
            }
            const baseProviderFilter = { $or: salesFilter };
            const providerFilter = startDate
                ? { $and: [baseProviderFilter, dateQuery] }
                : baseProviderFilter;

            const [
                totalProviders,
                approvedProviders,
                pendingProviders,
                paidProviders,
                recentProviders,
                freshUser,
            ] = await Promise.all([
                ServiceProvider.countDocuments(providerFilter),
                ServiceProvider.countDocuments({
                    ...providerFilter,
                    status: ProviderApprovalStatus.APPROVED,
                }),
                ServiceProvider.countDocuments({
                    ...providerFilter,
                    status: ProviderApprovalStatus.PENDING,
                }),
                ServiceProvider.countDocuments({
                    ...providerFilter,
                    paymentStatus: PaymentStatus.SUCCESS,
                }),
                ServiceProvider.find(baseProviderFilter)
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .populate('salesPerson', 'fullName email mobileNumber referenceCode')
                    .populate('registrationFee', 'title planType amount currency validityInDays'),
                User.findById(userId).select('wallet_balance referenceCode fullName email'),
            ]);

            const salesProviderIds = recentProviders.map((p) => p._id);
            const salesPayments = await RegistrationPayment.find({ providerId: { $in: salesProviderIds } })
                .sort({ createdAt: -1 });

            const salesPaymentMap = new Map();
            salesPayments.forEach((pay) => {
                if (!salesPaymentMap.has(pay.providerId.toString())) {
                    salesPaymentMap.set(pay.providerId.toString(), pay);
                }
            });

            const salesRecentProvidersWithPayment = recentProviders.map((p) => {
                const pObj = p.toObject();
                const pay = salesPaymentMap.get(p._id.toString());
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

            // When filtered by date, calculate period earnings if possible, otherwise wallet_balance
            const allTimeEarning = freshUser?.wallet_balance ?? 0;
            const periodEarning = startDate ? paidProviders * 50 : allTimeEarning;

            res.status(200).json({
                success: true,
                role: 'SALES_PERSON',
                dateRange: {
                    filter: appliedFilter,
                    label,
                    startDate: startDate ? startDate.toISOString() : null,
                    endDate: endDate.toISOString(),
                },
                kpis: {
                    totalProviders,
                    earning: startDate ? periodEarning : allTimeEarning,
                    allTimeEarning,
                    periodEarning,
                    approvedProviders,
                    pendingProviders,
                    paidProviders,
                    referenceCode: user.referenceCode || freshUser?.referenceCode || '',
                },
                recentProviders: salesRecentProvidersWithPayment,
            });
            return;
        }

        // ADMIN DASHBOARD
        const paymentFilter: any = { status: PaymentStatus.SUCCESS };
        if (startDate) {
            paymentFilter.$or = [
                { paidAt: { $gte: startDate, $lte: endDate } },
                { createdAt: { $gte: startDate, $lte: endDate } },
            ];
        }

        const [
            totalUsers,
            totalSalesPersons,
            totalProviders,
            approvedProviders,
            pendingProviders,
            paidProvidersCount,
            regPayments,
            recentProviders,
        ] = await Promise.all([
            User.countDocuments({ userType: UserType.USER, ...dateQuery }),
            User.countDocuments({ userType: UserType.SALES_PERSON, ...dateQuery }),
            ServiceProvider.countDocuments(dateQuery),
            ServiceProvider.countDocuments({ status: ProviderApprovalStatus.APPROVED, ...dateQuery }),
            ServiceProvider.countDocuments({ status: ProviderApprovalStatus.PENDING, ...dateQuery }),
            ServiceProvider.countDocuments({ paymentStatus: PaymentStatus.SUCCESS, ...dateQuery }),
            RegistrationPayment.aggregate([
                { $match: paymentFilter },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            ServiceProvider.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('salesPerson', 'fullName email mobileNumber referenceCode')
                .populate('registrationFee', 'title planType amount currency validityInDays'),
        ]);

        const adminProviderIds = recentProviders.map((p) => p._id);
        const adminPayments = await RegistrationPayment.find({ providerId: { $in: adminProviderIds } })
            .sort({ createdAt: -1 });

        const adminPaymentMap = new Map();
        adminPayments.forEach((pay) => {
            if (!adminPaymentMap.has(pay.providerId.toString())) {
                adminPaymentMap.set(pay.providerId.toString(), pay);
            }
        });

        const adminRecentProvidersWithPayment = recentProviders.map((p) => {
            const pObj = p.toObject();
            const pay = adminPaymentMap.get(p._id.toString());
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

        let registerFeeRevenue = regPayments[0]?.total || 0;
        if (registerFeeRevenue === 0 && paidProvidersCount > 0) {
            registerFeeRevenue = paidProvidersCount * 499;
        }

        res.status(200).json({
            success: true,
            role: 'ADMIN',
            dateRange: {
                filter: appliedFilter,
                label,
                startDate: startDate ? startDate.toISOString() : null,
                endDate: endDate.toISOString(),
            },
            kpis: {
                totalUsers,
                totalSalesPersons,
                totalProviders,
                registerFeeRevenue,
                approvedProviders,
                pendingProviders,
                paidProvidersCount,
            },
            recentProviders: adminRecentProvidersWithPayment,
        });
    } catch (error) {
        next(error);
    }
};


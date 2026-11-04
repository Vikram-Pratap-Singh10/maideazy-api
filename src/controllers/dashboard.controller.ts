import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import User, { UserType } from '../models/user.js';
import ServiceProvider, { ProviderApprovalStatus } from '../models/service.provider.js';
import { RegistrationPayment, PaymentStatus } from '../models/payment.js';

/**
 * Get unified, role-aware dashboard statistics and recent providers
 * - For Sales Person: Returns totalProviders, earning (wallet_balance), approved/pending, and their recent providers.
 * - For Admin: Returns totalUsers, totalSalesPersons, totalProviders, registerFeeRevenue, and platform recent providers.
 */
export const getDashboardStats = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = req.user;
        const isSalesPerson = user?.userType === UserType.SALES_PERSON;

        if (isSalesPerson && user) {
            // SALES PERSON DASHBOARD
            const userRefCode = user.referenceCode;
            const userId = user._id;

            const salesFilter: any[] = [{ salesPerson: userId }];
            if (userRefCode) {
                salesFilter.push({ referenceCode: userRefCode });
            }
            const providerFilter = { $or: salesFilter };

            const [
                totalProviders,
                approvedProviders,
                pendingProviders,
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
                ServiceProvider.find(providerFilter)
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .populate('salesPerson', 'fullName email mobileNumber referenceCode'),
                User.findById(userId).select('wallet_balance referenceCode fullName email'),
            ]);

            // Each referral earns 50 INR in wallet. If wallet_balance wasn't set, default to totalProviders * 50
            const earning =
                freshUser?.wallet_balance !== undefined && freshUser.wallet_balance > 0
                    ? freshUser.wallet_balance
                    : totalProviders * 50;

            res.status(200).json({
                success: true,
                role: 'SALES_PERSON',
                kpis: {
                    totalProviders,
                    earning,
                    approvedProviders,
                    pendingProviders,
                    referenceCode: user.referenceCode || freshUser?.referenceCode || '',
                },
                recentProviders,
            });
            return;
        }

        // ADMIN DASHBOARD
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
            User.countDocuments({ userType: UserType.USER }),
            User.countDocuments({ userType: UserType.SALES_PERSON }),
            ServiceProvider.countDocuments(),
            ServiceProvider.countDocuments({ status: ProviderApprovalStatus.APPROVED }),
            ServiceProvider.countDocuments({ status: ProviderApprovalStatus.PENDING }),
            ServiceProvider.countDocuments({ paymentStatus: PaymentStatus.SUCCESS }),
            RegistrationPayment.aggregate([
                { $match: { status: PaymentStatus.SUCCESS } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            ServiceProvider.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('salesPerson', 'fullName email mobileNumber referenceCode'),
        ]);

        let registerFeeRevenue = regPayments[0]?.total || 0;
        if (registerFeeRevenue === 0 && paidProvidersCount > 0) {
            registerFeeRevenue = paidProvidersCount * 499;
        }

        res.status(200).json({
            success: true,
            role: 'ADMIN',
            kpis: {
                totalUsers,
                totalSalesPersons,
                totalProviders,
                registerFeeRevenue,
                approvedProviders,
                pendingProviders,
            },
            recentProviders,
        });
    } catch (error) {
        next(error);
    }
};


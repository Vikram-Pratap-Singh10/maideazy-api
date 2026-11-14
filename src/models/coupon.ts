import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export type DiscountType = 'FLAT' | 'PERCENTAGE';

export interface ICoupon extends Document {
    _id: Types.ObjectId;
    code: string;
    title?: string;
    description?: string;
    discountType: DiscountType;
    discountAmount: number;
    applicablePlans: Types.ObjectId[]; // Empty array means applicable to ALL RegistrationFee plans
    minOrderAmount: number;
    maxDiscountAmount?: number | null;
    maxUses?: number | null; // Maximum times coupon can be redeemed across all users (0 or null = unlimited)
    usedCount: number;
    validFrom?: Date | null;
    validTill?: Date | null;
    isActive: boolean;
    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
    {
        code: {
            type: String,
            required: [true, 'Coupon code is required'],
            unique: true,
            uppercase: true,
            trim: true,
            minlength: [2, 'Coupon code must be at least 2 characters'],
            maxlength: [30, 'Coupon code must not exceed 30 characters'],
        },
        title: {
            type: String,
            trim: true,
            default: '',
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        discountType: {
            type: String,
            enum: ['FLAT', 'PERCENTAGE'],
            default: 'FLAT',
            required: true,
        },
        discountAmount: {
            type: Number,
            required: [true, 'Discount amount is required'],
            min: [1, 'Discount amount must be at least 1'],
        },
        applicablePlans: [
            {
                type: Schema.Types.ObjectId,
                ref: 'RegistrationFee',
            },
        ],
        minOrderAmount: {
            type: Number,
            default: 0,
            min: [0, 'Minimum order amount must be non-negative'],
        },
        maxDiscountAmount: {
            type: Number,
            min: [0, 'Maximum discount amount must be non-negative'],
        },
        maxUses: {
            type: Number,
            min: [0, 'Maximum uses must be non-negative'],
        },
        usedCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        validFrom: {
            type: Date,
        },
        validTill: {
            type: Date,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ isActive: 1 });
CouponSchema.index({ applicablePlans: 1 });
CouponSchema.index({ createdAt: -1 });

export const Coupon: Model<ICoupon> = mongoose.model<ICoupon>('Coupon', CouponSchema);

export default Coupon;

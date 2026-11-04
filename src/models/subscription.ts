import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export enum PlanType {
    DAILY = 'DAILY',
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY',
    QUARTERLY = 'QUARTERLY',
    YEARLY = 'YEARLY',
    CUSTOM = 'CUSTOM',
}

export interface ISubscription extends Document {
    _id: Types.ObjectId;
    title: string;
    description?: string;
    planType: PlanType;
    price: number;
    originalPrice?: number;
    discountPercent?: number;
    durationDays: number;
    features: string[];
    serviceCategory?: string;
    maxBookingsPerMonth?: number;
    hoursPerVisit?: number;
    isActive: boolean;
    createdBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
    {
        title: {
            type: String,
            required: [true, 'Subscription plan title is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        planType: {
            type: String,
            enum: Object.values(PlanType),
            default: PlanType.MONTHLY,
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price must be non-negative'],
        },
        originalPrice: {
            type: Number,
            min: [0, 'Original price must be non-negative'],
        },
        discountPercent: {
            type: Number,
            min: [0, 'Discount percentage cannot be negative'],
            max: [100, 'Discount percentage cannot exceed 100'],
            default: 0,
        },
        durationDays: {
            type: Number,
            required: [true, 'Duration in days is required'],
            min: [1, 'Duration must be at least 1 day'],
            default: 30,
        },
        features: {
            type: [String],
            default: [],
        },
        serviceCategory: {
            type: String,
            trim: true,
            default: 'General Service',
        },
        maxBookingsPerMonth: {
            type: Number,
            min: [0, 'Bookings limit cannot be negative'],
        },
        hoursPerVisit: {
            type: Number,
            min: [0, 'Hours cannot be negative'],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

subscriptionSchema.index({ isActive: 1 });
subscriptionSchema.index({ planType: 1 });
subscriptionSchema.index({ createdAt: -1 });

export const Subscription: Model<ISubscription> = mongoose.model<ISubscription>(
    'Subscription',
    subscriptionSchema
);

export default Subscription;


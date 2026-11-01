import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export interface IRegistrationFee extends Document {
    _id: Types.ObjectId;
    title: string;
    amount: number;
    originalAmount?: number;
    currency: string;
    features: string[];
    description?: string;
    validityInDays?: number;
    isActive: boolean;
    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const RegistrationFeeSchema = new Schema<IRegistrationFee>(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
            default: 'Service Provider Registration Fee',
        },
        amount: {
            type: Number,
            required: [true, 'Registration fee amount is required'],
            min: [1, 'Amount must be greater than 0'],
        },
        originalAmount: {
            type: Number,
            min: [0, 'Original amount must be a positive number'],
        },
        currency: {
            type: String,
            default: 'INR',
            uppercase: true,
            trim: true,
        },
        features: {
            type: [String],
            default: [],
        },
        description: {
            type: String,
            trim: true,
        },
        validityInDays: {
            type: Number,
            min: [0, 'Validity days must be a non-negative number'],
            default: 365,
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

RegistrationFeeSchema.index({ isActive: 1 });
RegistrationFeeSchema.index({ createdAt: -1 });

export const RegistrationFee: Model<IRegistrationFee> = mongoose.model<IRegistrationFee>(
    'RegistrationFee',
    RegistrationFeeSchema
);

export default RegistrationFee;

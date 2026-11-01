import { Schema, model, Document, Types, Model } from 'mongoose';

export enum PaymentStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
}

export enum PaymentGateway {
    RAZORPAY = 'RAZORPAY',
    STRIPE = 'STRIPE',
    PHONEPE = 'PHONEPE',
    CASHFREE = 'CASHFREE',
    MANUAL = 'MANUAL',
}

export interface IRegistrationPayment extends Document {
    _id: Types.ObjectId;
    providerId: Types.ObjectId;
    amount: number;
    currency: string;
    status: PaymentStatus;
    gateway: PaymentGateway;
    orderId: string; // Gateway order ID (e.g., razorpay_order_id)
    paymentId?: string; // Gateway payment ID (e.g., razorpay_payment_id)
    signature?: string; // Verification signature (e.g., razorpay_signature)
    failureReason?: string;
    paidAt?: Date;
    metadata?: Record<string, any>; // Raw gateway response or extra details
    createdAt: Date;
    updatedAt: Date;
}

const RegistrationPaymentSchema = new Schema<IRegistrationPayment>(
    {
        providerId: {
            type: Schema.Types.ObjectId,
            ref: 'ServiceProvider',
            required: [true, 'Provider ID is required'],
            index: true,
        },
        amount: {
            type: Number,
            required: [true, 'Payment amount is required'],
            min: [1, 'Amount must be greater than 0'],
        },
        currency: {
            type: String,
            required: true,
            default: 'INR',
            uppercase: true,
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(PaymentStatus),
            default: PaymentStatus.PENDING,
            index: true,
        },
        gateway: {
            type: String,
            enum: Object.values(PaymentGateway),
            default: PaymentGateway.RAZORPAY,
        },
        orderId: {
            type: String,
            required: [true, 'Gateway Order ID is required'],
            unique: true,
            trim: true,
        },
        paymentId: {
            type: String,
            trim: true,
            sparse: true,
        },
        signature: {
            type: String,
            trim: true,
        },
        failureReason: {
            type: String,
            trim: true,
        },
        paidAt: {
            type: Date,
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

// Indexes for query optimization
RegistrationPaymentSchema.index({ providerId: 1, status: 1 });
RegistrationPaymentSchema.index({ orderId: 1 });
RegistrationPaymentSchema.index({ paymentId: 1 }, { sparse: true });
RegistrationPaymentSchema.index({ createdAt: -1 });

export const RegistrationPayment: Model<IRegistrationPayment> = model<IRegistrationPayment>(
    'RegistrationPayment',
    RegistrationPaymentSchema
);

export default RegistrationPayment;

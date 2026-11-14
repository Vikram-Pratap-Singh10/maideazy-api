import { Schema, model, Document, Model, Types } from 'mongoose';

// Enums for standard options
export enum Gender {
    MALE = 'Male',
    FEMALE = 'Female',
    OTHER = 'Other',
}

export enum JobRole {
    MAID_HOUSEKEEPING = 'Maid / Housekeeping',
    COOKING_ASSISTANT = 'Cooking Assistant',
    NANNY_BABY_CARE = 'Nanny / Baby Care',
    ELDERLY_CARE_ASSISTANT = 'Elderly Care Assistant',
    MULTI_SKILLED_HOME_ASSISTANT = 'Multi-skilled Home Assistant',
    OTHER = 'Other',
}

export enum WorkType {
    FULL_TIME = 'Full-time',
    PART_TIME = 'Part-time',
    LIVE_IN = 'Live-in',
    LIVE_OUT = 'Live-out',
}

export enum ProviderApprovalStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export enum PaymentStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
}

// Subdocument Interfaces
export interface IPreferredLocation {
    pinCode: string;
    city: string;
}

// Main Provider Interface
export interface IProvider extends Document {
    referenceCode?: string;
    salesPerson?: Types.ObjectId;
    fullName: string;
    mobileNumber: string;
    dateOfBirth: Date;
    gender: Gender;
    residentialAddress: string;
    permanentAddress?: string;
    currentAddress?: string;
    isCurrentSameAsPermanent?: boolean;
    city: string;
    pinCode: string;
    jobRoles: string[];
    preferredLocations: IPreferredLocation[];
    workTypes: WorkType[];
    expectedSalary?: number;
    education?: string;
    experience?: string;
    workHours?: string;
    profilePhoto?: string;
    aadhaarNumber?: string;
    aadhaarDocument?: string;
    panCardNumber?: string;
    panCardDocument?: string;
    emergencyContactName?: string;
    emergencyContactNumber?: string;
    emergencyContactRelation?: string;
    emergencyName?: string;
    emergencyContactNo?: string;
    emergencyRelation?: string;
    agreeAccuracy?: boolean;
    criminal?: string;
    criminalDetails?: string;
    agreePcc?: boolean;
    agreeVerification?: boolean;
    agreePrivacy?: boolean;
    status: ProviderApprovalStatus;
    paymentStatus: PaymentStatus;
    registrationFee?: Types.ObjectId;
    extraRoleCharge?: number;
    commissionCredited?: boolean;
    commissionAmount?: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Subdocument Schemas
const PreferredLocationSchema = new Schema<IPreferredLocation>({
    pinCode: {
        type: String,
        required: [true, 'Preferred PIN code is required'],
        trim: true,
        match: [/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit PIN code'],
    },
    city: {
        type: String,
        required: [true, 'Preferred city name is required'],
        trim: true,
    },
},
    { _id: false }
);

// Main Schema
const ProviderSchema = new Schema<IProvider>({
    referenceCode: {
        type: String,
        trim: true,
        uppercase: true,
        index: true,
    },
    salesPerson: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
    },
    mobileNumber: {
        type: String,
        required: [true, 'Mobile number is required'],
        unique: true,
        trim: true,
        match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'],
    },
    dateOfBirth: {
        type: Date,
        required: [true, 'Date of birth is required'],
    },
    gender: {
        type: String,
        enum: Object.values(Gender),
        required: [true, 'Gender is required'],
    },
    residentialAddress: {
        type: String,
        required: [true, 'Residential address is required'],
        trim: true,
    },
    permanentAddress: {
        type: String,
        trim: true,
    },
    currentAddress: {
        type: String,
        trim: true,
    },
    isCurrentSameAsPermanent: {
        type: Boolean,
        default: true,
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
    },
    pinCode: {
        type: String,
        required: [true, 'PIN code is required'],
        trim: true,
        match: [/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit PIN code'],
    },
    jobRoles: {
        type: [String],
        validate: {
            validator: (v: string[]) => Array.isArray(v) && v.length > 0,
            message: 'Select at least one job role',
        },
    },
    preferredLocations: {
        type: [PreferredLocationSchema],
        validate: {
            validator: (v: IPreferredLocation[]) => Array.isArray(v) && v.length > 0,
            message: 'At least one preferred location is required',
        },
    },
    workTypes: {
        type: [String],
        enum: Object.values(WorkType),
        validate: {
            validator: (v: string[]) => Array.isArray(v) && v.length > 0,
            message: 'Select at least one work type',
        },
    },
    expectedSalary: {
        type: Number,
        min: [0, 'Expected salary must be a positive number'],
    },
    education: {
        type: String,
        trim: true,
    },
    experience: {
        type: String,
        trim: true,
    },
    workHours: {
        type: String
    },
    profilePhoto: {
        type: String,
        trim: true,
    },
    aadhaarNumber: {
        type: String,
        trim: true,
    },
    aadhaarDocument: {
        type: String,
        trim: true,
    },
    panCardNumber: {
        type: String,
        trim: true,
        uppercase: true,
    },
    panCardDocument: {
        type: String,
        trim: true,
    },
    emergencyContactName: {
        type: String,
        trim: true,
        alias: 'emergencyName',
    },
    emergencyContactNumber: {
        type: String,
        trim: true,
        alias: 'emergencyContactNo',
    },
    emergencyContactRelation: {
        type: String,
        trim: true,
        alias: 'emergencyRelation',
    },
    agreeAccuracy: {
        type: Boolean,
        default: false,
    },
    criminal: {
        type: String,
        enum: ['none', 'disclose'],
    },
    criminalDetails: {
        type: String,
        trim: true,
    },
    agreePcc: {
        type: Boolean,
        default: false,
    },
    agreeVerification: {
        type: Boolean,
        default: false,
    },
    agreePrivacy: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: Object.values(ProviderApprovalStatus),
        default: ProviderApprovalStatus.PENDING,
        index: true,
    },
    paymentStatus: {
        type: String,
        enum: Object.values(PaymentStatus),
        default: PaymentStatus.PENDING,
        index: true,
    },
    registrationFee: {
        type: Schema.Types.ObjectId,
        ref: 'RegistrationFee',
    },
    extraRoleCharge: {
        type: Number,
        default: 0,
        min: 0,
    },
    commissionCredited: {
        type: Boolean,
        default: false,
        index: true,
    },
    commissionAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
},
    { timestamps: true }
);

// Indexes for common queries
ProviderSchema.index({ mobileNumber: 1 });
ProviderSchema.index({ 'preferredLocations.pinCode': 1 });
ProviderSchema.index({ 'preferredLocations.city': 1 });
ProviderSchema.index({ jobRoles: 1 });
ProviderSchema.index({ referenceCode: 1 });
ProviderSchema.index({ salesPerson: 1 });
ProviderSchema.index({ status: 1 });

export const ServiceProvider: Model<IProvider> = model<IProvider>('ServiceProvider', ProviderSchema);
export default ServiceProvider;

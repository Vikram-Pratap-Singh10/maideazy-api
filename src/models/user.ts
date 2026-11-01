import { Schema, model, Document, Types, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export enum UserType {
    ADMIN = 'ADMIN',
    SALES_PERSON = 'SALES_PERSON',
    TEAM_MEMBER = 'TEAM_MEMBER',
    USER = 'USER', // App side users / customers
}

export interface IPushToken {
    fcmToken: string;
    device?: string;
}

export interface ILocation {
    type?: string;
    coordinates?: number[]; // [longitude, latitude]
    address?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    landmark?: string;
}

export interface IUser extends Document {
    _id: Types.ObjectId;
    fullName: string;
    email: string;
    password?: string;
    mobileNumber?: string;
    role?: Types.ObjectId;
    userType: UserType;
    referenceCode?: string;
    location?: ILocation;
    createdBy?: Types.ObjectId;
    isActive: boolean;
    lastLogin?: Date;
    fcmToken?: string;
    pushTokens?: IPushToken[];
    deviceType?: string;
    appVersionCode?: number;
    maidId?: string;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUser> {
    generateUniqueReferenceCode(prefix?: string): Promise<string>;
}

const PushTokenSchema = new Schema<IPushToken>(
    {
        fcmToken: { type: String, required: true },
        device: { type: String },
    },
    { _id: false }
);

const LocationSchema = new Schema<ILocation>(
    {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
        },
        address: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        pinCode: { type: String, trim: true },
        landmark: { type: String, trim: true },
    },
    { _id: false }
);

const UserSchema = new Schema<IUser, IUserModel>(
    {
        fullName: {
            type: String,
            required: [true, 'Full name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                'Please provide a valid email address',
            ],
        },
        password: {
            type: String,
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        mobileNumber: {
            type: String,
            trim: true,
            match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'],
        },
        role: {
            type: Schema.Types.ObjectId,
            ref: 'Role',
            required: false, // Optional for app-side users
        },
        userType: {
            type: String,
            enum: Object.values(UserType),
            default: UserType.USER,
        },
        referenceCode: {
            type: String,
            trim: true,
            uppercase: true,
            sparse: true,
            unique: true,
        },
        location: {
            type: LocationSchema,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: {
            type: Date,
        },
        fcmToken: {
            type: String,
            trim: true,
        },
        pushTokens: {
            type: [PushTokenSchema],
            default: [],
        },
        deviceType: {
            type: String,
            trim: true,
        },
        appVersionCode: {
            type: Number,
        },
        maidId: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ referenceCode: 1 }, { sparse: true });
UserSchema.index({ role: 1 });
UserSchema.index({ createdBy: 1 });
UserSchema.index({ userType: 1 });
UserSchema.index({ 'location.coordinates': '2dsphere' }, { sparse: true });

// Pre-save hook to hash password
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err: any) {
        next(err);
    }
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

// Static method to generate unique reference code
UserSchema.statics.generateUniqueReferenceCode = async function (
    prefix = 'SP'
): Promise<string> {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codeLength = 6;
    let isUnique = false;
    let generatedCode = '';

    while (!isUnique) {
        let randomPart = '';
        for (let i = 0; i < codeLength; i++) {
            const randomIndex = crypto.randomInt(0, characters.length);
            randomPart += characters[randomIndex];
        }

        generatedCode = `${prefix.toUpperCase()}-${randomPart}`;
        const existing = await this.findOne({ referenceCode: generatedCode });
        if (!existing) {
            isUnique = true;
        }
    }

    return generatedCode;
};

export const User: IUserModel = model<IUser, IUserModel>('User', UserSchema);
export default User;

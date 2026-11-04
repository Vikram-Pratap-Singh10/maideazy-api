import mongoose, { Schema, Document, Types } from 'mongoose';

// Standard Admin Panel Tabs & Actions for frontend UI reference
export enum AdminTab {
    DASHBOARD = 'dashboard',
    ROLES = 'roles',
    SALES_PARTNERS = 'sales_partners',
    SERVICE_PROVIDERS = 'service_providers',
    SUBSCRIPTIONS = 'subscriptions',
    USERS = 'users',
    PAYMENTS = 'payments',
    BANNERS = 'banners',
    SETTINGS = 'settings',
}

export enum TabAction {
    CREATE = 'create',
    READ = 'read',
    UPDATE = 'update',
    DELETE = 'delete',
    ALL = '*',
}

export const ADMIN_TABS_LIST = Object.values(AdminTab);
export const TAB_ACTIONS_LIST = Object.values(TabAction);

export interface IRole extends Document {
    _id: Types.ObjectId;
    name: string;
    description?: string;
    permissions: any[];
    isActive: boolean;
    isDeleted: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
    {
        name: {
            type: String,
            required: [true, 'Role name is required'],
            unique: true,
            trim: true,
        },
        description: {
            type: String,
        },
        permissions: {
            type: [],
            default: [],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

roleSchema.index({ name: 1 });
roleSchema.index({ isActive: 1, isDeleted: 1 });

export const Role = mongoose.model<IRole>('Role', roleSchema);
export default Role;

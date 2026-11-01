import { Schema, model, Document, Types } from 'mongoose';

export interface INotification extends Document {
    recipient?: Types.ObjectId | string;
    sender?: Types.ObjectId | string;
    message?: string;
    title?: string;
    role?: string;
    entityId?: string;
    type?: string;
    data?: Record<string, any>;
    isRead?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
    {
        recipient: { type: Schema.Types.Mixed },
        sender: { type: Schema.Types.Mixed },
        message: { type: String },
        title: { type: String },
        role: { type: String },
        entityId: { type: String },
        type: { type: String },
        data: { type: Schema.Types.Mixed, default: {} },
        isRead: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const Notification = model<INotification>('Notification', NotificationSchema);
export default Notification;


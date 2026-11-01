import { Schema, model, Document } from 'mongoose';

export interface IAppVersion extends Document {
    androidVersionCode?: number;
    iosVersionCode?: number;
    androidVersionName?: string;
    iosVersionName?: string;
    isMandatory?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const AppVersionSchema = new Schema<IAppVersion>(
    {
        androidVersionCode: { type: Number },
        iosVersionCode: { type: Number },
        androidVersionName: { type: String },
        iosVersionName: { type: String },
        isMandatory: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const appVersion = model<IAppVersion>('AppVersion', AppVersionSchema);
export default appVersion;


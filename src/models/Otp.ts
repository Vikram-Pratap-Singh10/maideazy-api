import { Schema, model, Document } from "mongoose";

export interface IOtp extends Document {
  phoneNumber: string;
  otp: string;
  expiry: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    phoneNumber: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
      trim: true,
    },
    expiry: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index to auto-delete after expiry
    },
  },
  {
    timestamps: true,
  }
);

export const OtpModel = model<IOtp>("Otp", OtpSchema);
export default OtpModel;

import dotenv from "dotenv";
import axios from "axios";
import OtpModel from "../models/Otp.js";

dotenv.config();

export interface SendOtpResult {
  success: boolean;
  message: string;
  data?: any;
}

export const sendOtp = async (phoneNumber: string): Promise<SendOtpResult> => {
  try {
    const cleanNumber = phoneNumber.trim().replace(/\D/g, "").slice(-10);
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Remove any existing OTP for this phone number
    await OtpModel.deleteMany({ phoneNumber: cleanNumber });

    // Store new OTP with 5 minutes validity
    await OtpModel.create({
      phoneNumber: cleanNumber,
      otp,
      expiry: new Date(Date.now() + 5 * 60 * 1000),
    });

    const apiKey = process.env.FAST2SMS_API_KEY;
    const entityId = process.env.ENTITY_ID;
    const templateId = process.env.TEMPLATE_ID;

    if (!apiKey) {
      console.warn("[Fast2SMS] FAST2SMS_API_KEY is not defined in .env.");
      return {
        success: false,
        message: "SMS service is not configured",
      };
    }

    try {
      const res = await axios.post(
        "https://www.fast2sms.com/dev/bulkV2",
        {
          route: "dlt",
          sender_id: "DILENT",
          entity_id: entityId,
          message: templateId,
          variables_values: `${otp}|5`,
          numbers: cleanNumber,
        },
        {
          headers: {
            authorization: apiKey,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      console.log(`[Fast2SMS] Dispatched SMS to ${cleanNumber}:`, res.data);
      return {
        success: true,
        message: "OTP sent successfully via SMS",
        data: res.data,
      };
    } catch (smsErr: any) {
      console.error(
        `[Fast2SMS Error] Failed to send SMS to ${cleanNumber}:`,
        smsErr?.response?.data || smsErr.message
      );
      return {
        success: false,
        message: "Failed to send SMS to your mobile number. Please try again later.",
      };
    }
  } catch (err: any) {
    console.error("[sendOtp] General error:", err);
    return {
      success: false,
      message: err.message || "Failed to generate OTP",
    };
  }
};

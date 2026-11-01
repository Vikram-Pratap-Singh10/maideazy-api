import admin from "firebase-admin";
import User from "../models/user.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Notification from "../models/Notification.js";
import appVersion from "../models/appVersion.js";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")!,
    }),
  });
}


// cron job run for app version
export const sendAppUpdateNotification = async () => {
  try {
    // console.log("calllling")
    const version = await appVersion.findOne();

    if (!version) {
      console.log("App version config not found");
      return;
    }

    // Get only required fields
    const users = await User.find({
      fcmToken: { $exists: true, $nin: [null, ""] },
      isActive: true,
      isBlock: false,
    }).select("fcmToken deviceType appVersionCode fullName");

    if (!users.length) {
      console.log("No users found");
      return;
    }

    const ANDROID_LINK = "https://play.google.com/store/apps/details?id=com.creatamaxinfotech.maideazy";
    const IOS_LINK = "https://apps.apple.com/in/app/maideazy/id6757801453";

    const androidTokens: string[] = [];
    const iosTokens: string[] = [];

    // 🔍 Filter outdated users
    for (const user of users) {
      if (
        user.deviceType === "android" &&
        version.androidVersionCode &&
        user.appVersionCode != null && user.appVersionCode < version.androidVersionCode && user.fcmToken
      ) {
        console.log(user.fullName)
        androidTokens.push(user.fcmToken);
      }

      if (
        user.deviceType === "ios" &&
        version.iosVersionCode &&
        user.appVersionCode != null && user.appVersionCode < version.iosVersionCode && user.fcmToken
      ) {
        iosTokens.push(user.fcmToken);
      }
    }

    if (!androidTokens.length && !iosTokens.length) {
      console.log("No outdated users found");
      return;
    }

    const chunkSize = 500;
    for (let i = 0; i < androidTokens.length; i += chunkSize) {
      const chunk = androidTokens.slice(i, i + chunkSize);
      await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: "Update Required 🚀",
          body: "A new version is available. Update now for better experience.",
        },
        data: {
          link: ANDROID_LINK,
          type: "app_update"
        },
      });
    }
    for (let i = 0; i < iosTokens.length; i += chunkSize) {
      const chunk = iosTokens.slice(i, i + chunkSize);
      await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: "Update Required 🚀",
          body: "A new version is available. Update now for better experience.",
        },
        data: {
          link: IOS_LINK,
          type: "app_update"
        },
      });
    }
    console.log(`✅ Sent to Android: ${androidTokens.length}, iOS: ${iosTokens.length}`);
  } catch (err) {
    console.error("FCM update notification error:", err);
  }
};

export default admin;

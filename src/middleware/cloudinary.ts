import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: (process.env.CLOUDNARY_NAME || process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME || '') as string,
  api_key: (process.env.API_KEY || process.env.CLOUDINARY_API_KEY || '') as string,
  api_secret: (process.env.API_SECRET || process.env.CLOUDINARY_API_SECRET || '') as string,
});

export default cloudinary;
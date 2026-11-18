import { Router, Request, Response } from 'express';
import multer from 'multer';
import cloudinary from '../middleware/cloudinary.js';

const router = Router();

// Memory storage for multer to stream directly to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

/**
 * Upload single file directly to Cloudinary (multipart form-data or base64)
 */
router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        const folder = (req.body?.folder as string) || 'maideazy_docs';

        // 1. Handle multipart form file upload
        if (req.file) {
            const file = req.file;

            const uploadResult = await new Promise<any>((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder,
                        resource_type: 'auto',
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                uploadStream.end(file.buffer);
            });

            if (uploadResult?.secure_url || uploadResult?.url) {
                res.status(200).json({
                    success: true,
                    url: uploadResult.secure_url || uploadResult.url,
                    publicId: uploadResult.public_id,
                    format: uploadResult.format,
                });
                return;
            }

            res.status(500).json({
                success: false,
                message: 'Failed to obtain secure URL from Cloudinary',
            });
            return;
        }

        // 2. Handle Base64 string in JSON body
        const { base64 } = req.body;
        if (base64 && typeof base64 === 'string') {
            const uploadResult = await cloudinary.uploader.upload(base64, {
                folder,
                resource_type: 'auto',
            });

            res.status(200).json({
                success: true,
                url: uploadResult.secure_url || uploadResult.url,
                publicId: uploadResult.public_id,
                format: uploadResult.format,
            });
            return;
        }

        res.status(400).json({
            success: false,
            message: 'No file or base64 data provided for upload',
        });
    } catch (error: any) {
        console.error('Cloudinary upload error:', error);
        res.status(500).json({
            success: false,
            message: error?.message || 'Cloudinary upload failed',
            error: error?.http_code ? { code: error.http_code, message: error.message } : undefined,
        });
    }
});

export default router;

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cloudinary from '../middleware/cloudinary.js';

const router = Router();

// Ensure local uploads directory exists
const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Memory storage for multer to easily stream to Cloudinary or save locally
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * Upload single file (multipart form data or base64)
 */
router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        const folder = (req.body?.folder as string) || 'maideazy_docs';

        // 1. Handle multipart file upload
        if (req.file) {
            const file = req.file;

            // Try Cloudinary upload first
            try {
                const uploadResult = await new Promise<any>((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder,
                            resource_type: 'auto',
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(file.buffer);
                });

                if (uploadResult?.secure_url) {
                    res.status(200).json({
                        success: true,
                        url: uploadResult.secure_url,
                        publicId: uploadResult.public_id,
                        format: uploadResult.format,
                    });
                    return;
                }
            } catch (cloudErr) {
                console.warn('Cloudinary upload error, saving locally fallback:', cloudErr);
            }

            // Fallback to local disk
            const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname) || '.png'}`;
            const targetPath = path.join(uploadDir, uniqueFilename);
            fs.writeFileSync(targetPath, file.buffer);

            const fileUrl = `/uploads/${uniqueFilename}`;
            res.status(200).json({
                success: true,
                url: fileUrl,
            });
            return;
        }

        // 2. Handle Base64 string in JSON body
        const { base64 } = req.body;
        if (base64 && typeof base64 === 'string') {
            try {
                const uploadResult = await cloudinary.uploader.upload(base64, {
                    folder,
                    resource_type: 'auto',
                });

                res.status(200).json({
                    success: true,
                    url: uploadResult.secure_url,
                    publicId: uploadResult.public_id,
                });
                return;
            } catch (cloudErr) {
                console.warn('Cloudinary base64 upload failed, saving locally:', cloudErr);
                const matches = base64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                let buffer: Buffer;
                let ext = '.png';

                if (matches && matches[2]) {
                    buffer = Buffer.from(matches[2], 'base64');
                    const mime = matches[1];
                    if (mime?.includes('jpeg') || mime?.includes('jpg')) ext = '.jpg';
                    else if (mime?.includes('pdf')) ext = '.pdf';
                } else {
                    buffer = Buffer.from(base64, 'base64');
                }

                const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
                const targetPath = path.join(uploadDir, uniqueFilename);
                fs.writeFileSync(targetPath, buffer);

                res.status(200).json({
                    success: true,
                    url: `/uploads/${uniqueFilename}`,
                });
                return;
            }
        }

        res.status(400).json({
            success: false,
            message: 'No file or base64 data provided for upload',
        });
    } catch (error: any) {
        console.error('File upload route error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'File upload failed',
        });
    }
});

export default router;


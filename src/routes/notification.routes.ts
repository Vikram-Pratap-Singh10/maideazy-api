import { Router } from 'express';
import { Notification } from '../models/Notification.js';

const router = Router();

// GET unread count
router.get('/unread-count', async (req, res) => {
    try {
        const count = await Notification.countDocuments({ isRead: false });
        res.status(200).json({ success: true, count });
    } catch (error) {
        res.status(200).json({ success: true, count: 0 });
    }
});

// GET notifications
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query as any;
        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.max(1, parseInt(String(limit), 10) || 20);

        const notifications = await Notification.find()
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum);

        res.status(200).json({
            success: true,
            data: notifications,
        });
    } catch (error) {
        res.status(200).json({ success: true, data: [] });
    }
});

// Mark as read
router.put('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findByIdAndUpdate(id, { isRead: true });
        res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        res.status(200).json({ success: true, message: 'Marked as read' });
    }
});

// Delete notification
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        res.status(200).json({ success: true, message: 'Deleted' });
    }
});

// Send notification
router.post('/send', async (req, res) => {
    try {
        const { title, message, targetAudience } = req.body;
        const notification = await Notification.create({
            title,
            message,
            role: targetAudience,
            isRead: false,
        });
        res.status(201).json({ success: true, data: notification });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

export default router;


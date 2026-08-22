import { Response, NextFunction } from 'express';
import axios from 'axios';
import { AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notification.service';
import { User } from '../models/User';

export class NotificationController {
  static async getRecent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await NotificationService.getRecent(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const n = await NotificationService.create(req.user!.tenantId, req.body);
      const noticeTitle = n.title;
      const noticeBody = (n as any).message || n.body || 'You have a new notice announcement.';

      // 1. Realtime Socket.IO emit (for in-app users)
      const io = req.app.get('io');
      if (io) {
        io.to(`tenant-${req.user!.tenantId}`).emit('new-notice', {
          title: noticeTitle,
          body: noticeBody,
        });
        io.emit('new-notice', {
          title: noticeTitle,
          body: noticeBody,
        });
      }

      // 2. Cloud Push Notifications (for closed / background mobile users)
      try {
        const usersWithToken = await User.find({
          tenantId: req.user!.tenantId,
          fcmToken: { $exists: true, $ne: '' },
        }).select('fcmToken');

        const pushTokens = usersWithToken
          .map((u) => u.fcmToken)
          .filter((t): t is string => !!t && t.startsWith('ExponentPushToken'));

        if (pushTokens.length > 0) {
          const messages = pushTokens.map((token) => ({
            to: token,
            sound: 'default',
            title: `📢 ${noticeTitle}`,
            body: noticeBody,
            channelId: 'mahallu-notices',
            priority: 'high',
            data: { type: 'notice', id: n._id },
          }));

          axios.post('https://exp.host/--/api/v2/push/send', messages).catch((err) => {
            console.warn('[Push Notification] Error sending Expo push:', err?.message);
          });
        }
      } catch (pushErr) {
        console.warn('[Push Notification] Failed to send push tokens:', pushErr);
      }

      res.status(201).json({ success: true, data: n });
    } catch (error) {
      next(error);
    }
  }
}

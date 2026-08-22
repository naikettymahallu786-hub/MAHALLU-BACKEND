import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { EventService } from '../services/event.service';

export class EventController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await EventService.getAll(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await EventService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // Socket.IO emit reads req.app, so it stays here rather than in the
  // service — same convention as notification/create.
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const e = await EventService.create(req.user!.tenantId, req.body);

      // Create persistent broadcast notification for all mobile members
      try {
        const { Notification } = await import('../models/Notification');
        const shortBody = e.description
          ? (e.description.length > 150 ? `${e.description.slice(0, 150)}...` : e.description)
          : `മഹല്ലിൽ പുതിയ പരിപാടി നിശ്ചയിച്ചിരിക്കുന്നു. തീയതി: ${new Date(e.date).toLocaleDateString('en-IN')}`;

        await Notification.create({
          tenantId: req.user!.tenantId,
          channel: 'in_app',
          title: `📢 പുതിയ പരിപാടി: ${e.title}`,
          body: shortBody,
          data: { eventId: e._id, type: 'event_announcement' },
          status: 'sent',
          sentAt: new Date(),
        });
      } catch (notifErr) {
        console.error('Failed to create event broadcast notification:', notifErr);
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`tenant-${req.user!.tenantId}`).emit('new-event', {
          title: `📢 New Event: ${e.title}`,
          body: e.description || 'A new event has been scheduled.',
          eventId: e._id,
        });
      }

      res.status(201).json({ success: true, data: e });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await EventService.update(req.params.id, req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await EventService.register(req.params.id, req.user!.tenantId, req.body.memberId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

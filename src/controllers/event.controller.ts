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

      const io = req.app.get('io');
      if (io) {
        io.to(`tenant-${req.user!.tenantId}`).emit('new-event', {
          title: `New Event: ${e.title}`,
          body: e.description || 'A new event has been scheduled.',
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

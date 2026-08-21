import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FamilyService } from '../services/family.service';

export class FamilyController {
  static async getRecurringReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await FamilyService.getRecurringReport(req.user!.tenantId, req.query as any);
      if (result.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.content);
        return;
      }
      res.json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { families, pagination } = await FamilyService.getAll(req.user!.tenantId, req.query as any);
      res.json({ success: true, data: families, pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await FamilyService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await FamilyService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await FamilyService.update(req.params.id, req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await FamilyService.remove(req.params.id, req.user!.tenantId);
      res.json({ success: true, message: 'Family deleted' });
    } catch (error) {
      next(error);
    }
  }

  static async restoreAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { restoredCount, message } = await FamilyService.restoreAll(req.user!.tenantId);
      res.json({ success: true, restoredCount, message });
    } catch (error) {
      next(error);
    }
  }

  static async bulkAssignRecurring(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { modifiedCount, message } = await FamilyService.bulkAssignRecurring(req.user!.tenantId, req.body);
      res.json({ success: true, modifiedCount, message });
    } catch (error) {
      next(error);
    }
  }

  static async remindRecurring(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await FamilyService.remindRecurring(req.params.id, req.user!.tenantId);
      res.json({ success: true, message: 'Reminder sent successfully' });
    } catch (error) {
      next(error);
    }
  }
}

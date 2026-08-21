import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PropertyService } from '../services/property.service';

export class PropertyController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PropertyService.getAll(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PropertyService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getLeases(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PropertyService.getLeases(req.user!.tenantId, req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async createLease(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PropertyService.createLease(req.user!.tenantId, req.params.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getAllRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PropertyService.getAllRequests(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getRequestById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PropertyService.getRequestById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async approveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PropertyService.approveRequest(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async rejectRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await PropertyService.rejectRequest(req.params.id, req.user!.tenantId);
      res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PropertyService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PropertyService.update(req.params.id, req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

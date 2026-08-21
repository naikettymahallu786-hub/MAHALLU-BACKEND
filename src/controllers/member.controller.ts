import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MemberService } from '../services/member.service';

export class MemberController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const { members, pagination } = await MemberService.getAll(tenantId, req.query as any);

      res.status(200).json({
        success: true,
        message: 'Members retrieved',
        data: members,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const member = await MemberService.getById(req.params.id, req.user!.tenantId);
      res.status(200).json({ success: true, message: 'Member found', data: member });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const member = await MemberService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, message: 'Member created', data: member });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const member = await MemberService.update(req.params.id, req.user!.tenantId, req.body);
      res.status(200).json({ success: true, message: 'Member updated', data: member });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await MemberService.delete(req.params.id, req.user!.tenantId);
      res.status(200).json({ success: true, message: 'Member deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async bulkDelete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { count } = await MemberService.bulkDelete(req.user!.tenantId, req.body.ids);
      res.status(200).json({
        success: true,
        message: `${count} members deleted successfully`,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getQRCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const member = await MemberService.getQRCard(req.params.id, req.user!.tenantId);
      res.status(200).json({ success: true, message: 'QR card data', data: member });
    } catch (error) {
      next(error);
    }
  }

  static async search(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const members = await MemberService.search(req.user!.tenantId, req.query.q);
      res.status(200).json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await MemberService.getStats(req.user!.tenantId);
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

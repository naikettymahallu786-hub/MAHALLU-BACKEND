import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { DashboardService } from '../services/dashboard.service';

export class DashboardController {
  static async getKPIs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getKPIs(req.user!.tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getIncomeExpenseChart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getIncomeExpenseChart(req.user!.tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getAttendanceChart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getAttendanceChart(req.user!.tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getMemberGrowthChart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getMemberGrowthChart(req.user!.tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getRecentActivity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getRecentActivity(req.user!.tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

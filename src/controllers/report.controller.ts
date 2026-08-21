import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ReportService } from '../services/report.service';

function sendResult(res: Response, result: { format: 'csv'; content: string; filename: string } | { format: 'json'; data: unknown }) {
  if (result.format === 'json') {
    res.json({ success: true, data: result.data });
    return;
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
  res.status(200).send(result.content);
}

export class ReportController {
  static async getFinancialSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const data = await ReportService.getFinancialSummary(req.user!.tenantId, startDate, endDate);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async exportFinancial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendResult(res, await ReportService.exportFinancial(req.user!.tenantId));
    } catch (error) {
      next(error);
    }
  }

  static async exportMembers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendResult(res, await ReportService.exportMembers(req.user!.tenantId));
    } catch (error) {
      next(error);
    }
  }

  static async exportAcademic(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendResult(res, await ReportService.exportAcademic(req.user!.tenantId));
    } catch (error) {
      next(error);
    }
  }

  static async exportIncomeExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendResult(res, await ReportService.exportIncomeExpense(req.user!.tenantId));
    } catch (error) {
      next(error);
    }
  }

  static async exportPayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendResult(res, await ReportService.exportPayments(req.user!.tenantId));
    } catch (error) {
      next(error);
    }
  }

  static async exportNikah(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendResult(res, await ReportService.exportNikah(req.user!.tenantId, req.query as any));
    } catch (error) {
      next(error);
    }
  }

  static async exportCertificates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendResult(res, await ReportService.exportCertificates(req.user!.tenantId, req.query as any));
    } catch (error) {
      next(error);
    }
  }

  static async exportEvents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendResult(res, await ReportService.exportEvents(req.user!.tenantId, req.query as any));
    } catch (error) {
      next(error);
    }
  }

  static async exportDeath(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendResult(res, await ReportService.exportDeath(req.user!.tenantId, req.query as any));
    } catch (error) {
      next(error);
    }
  }

  static async exportZakat(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendResult(res, await ReportService.exportZakat(req.user!.tenantId, req.query as any));
    } catch (error) {
      next(error);
    }
  }
}

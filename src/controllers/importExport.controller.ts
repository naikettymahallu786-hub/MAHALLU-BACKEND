import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ImportExportService } from '../services/importExport.service';

export class ImportExportController {
  /**
   * Download Demo Excel Template for importing Families and Members
   */
  static async downloadTemplate(req: AuthRequest, res: Response) {
    try {
      const workbook = ImportExportService.buildTemplateWorkbook();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Demo_Import_Template_Families_Members.xlsx"');

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error generating import template:', error);
      res.status(500).json({ success: false, message: 'Failed to generate import template' });
    }
  }

  /**
   * Bulk Import Families and Members from Excel (.xlsx) / CSV (.csv)
   */
  static async importData(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('No spreadsheet file uploaded', 400);
      }

      const outcome = await ImportExportService.importData(
        req.file,
        req.user!.tenantId,
        req.user?.name || 'Admin',
      );
      const { logId, totalRecords, successCount, failedCount, errorDetails } = outcome;

      if (outcome.cancelled) {
        return res.status(200).json({
          success: true,
          message: 'Import process cancelled by user.',
          data: { logId, status: 'CANCELLED', successCount, failedCount, totalRecords, errorDetails },
        });
      }

      return res.status(200).json({
        success: true,
        message: `Import processed: ${successCount} succeeded, ${failedCount} failed`,
        data: { logId, totalRecords, successCount, failedCount, errorDetails },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export All Families & Members as Excel Workbook
   */
  static async exportData(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const workbook = await ImportExportService.buildExportWorkbook(tenantId, req.user?.name || 'Admin');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Export_Families_Members_${Date.now()}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error exporting data:', error);
      res.status(500).json({ success: false, message: 'Failed to export families and members' });
    }
  }

  /**
   * Get Import & Export History Logs
   */
  static async getHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const logs = await ImportExportService.getHistory(req.user!.tenantId);
      res.status(200).json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pause an ongoing Import or Export process
   */
  static async pauseJob(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const log = await ImportExportService.pauseJob(req.params.id, req.user!.tenantId);
      res.status(200).json({ success: true, message: 'Job paused successfully', data: log });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resume a paused Import or Export process
   */
  static async resumeJob(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const log = await ImportExportService.resumeJob(req.params.id, req.user!.tenantId);
      res.status(200).json({ success: true, message: 'Job resumed successfully', data: log });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel an Import or Export process
   */
  static async cancelJob(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const log = await ImportExportService.cancelJob(req.params.id, req.user!.tenantId);
      res.status(200).json({ success: true, message: 'Job cancelled successfully', data: log });
    } catch (error) {
      next(error);
    }
  }
}

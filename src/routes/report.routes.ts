import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ReportController } from '../controllers/report.controller';

const r = Router();
r.use(authenticate);

r.get('/financial', ReportController.getFinancialSummary);
r.get('/export/financial', ReportController.exportFinancial);
r.get('/export/members', ReportController.exportMembers);
r.get('/export/academic', ReportController.exportAcademic);
r.get('/export/income-expense', ReportController.exportIncomeExpense);
r.get('/export/payments', ReportController.exportPayments);
r.get('/export/nikah', ReportController.exportNikah);
r.get('/export/certificates', ReportController.exportCertificates);
r.get('/export/events', ReportController.exportEvents);
r.get('/export/death', ReportController.exportDeath);
r.get('/export/zakat', ReportController.exportZakat);

export default r;

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AuditLogController } from '../controllers/auditLog.controller';

const r = Router();
r.use(authenticate);
r.get('/', AuditLogController.getAll);
export default r;

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { ZakatController } from '../controllers/zakat.controller';

const r = Router();
r.use(authenticate);
r.get('/', authorize(PERMISSIONS.ZAKAT_VIEW), ZakatController.getAll);
r.post('/', authorize(PERMISSIONS.ZAKAT_MANAGE), ZakatController.create);
r.post('/:id/apply', authorize(PERMISSIONS.MEMBER_VIEW), ZakatController.apply);
r.patch('/:id/applicants/:memberId', authorize(PERMISSIONS.ZAKAT_DISTRIBUTE), ZakatController.updateApplicantStatus);
export default r;

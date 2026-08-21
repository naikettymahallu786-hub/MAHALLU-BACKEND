import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '@mahallu/shared-config';
import { NikahController } from '../controllers/nikah.controller';

const r = Router();
r.use(authenticate);
r.get('/', authorize(PERMISSIONS.NIKAH_VIEW), NikahController.getAll);
r.post('/', authorize(PERMISSIONS.NIKAH_REGISTER), NikahController.create);
r.get('/:id', authorize(PERMISSIONS.NIKAH_VIEW), NikahController.getById);
r.put('/:id', authorize(PERMISSIONS.NIKAH_REGISTER), NikahController.update);
r.delete('/:id', authorize(PERMISSIONS.NIKAH_REGISTER), NikahController.remove);
export default r;

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '@mahallu/shared-config';
import { MadrasaController } from '../controllers/madrasa.controller';

const r = Router();
r.use(authenticate);
r.get('/', authorize(PERMISSIONS.MADRASA_VIEW), MadrasaController.get);
r.post('/', authorize(PERMISSIONS.MADRASA_CREATE), MadrasaController.upsert);
export default r;

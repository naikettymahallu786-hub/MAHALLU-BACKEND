import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { SettingsController } from '../controllers/settings.controller';

const r = Router();
r.use(authenticate);
r.get('/', SettingsController.get);
r.put('/', SettingsController.upsert);
export default r;

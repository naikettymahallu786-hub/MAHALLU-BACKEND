import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { NotificationController } from '../controllers/notification.controller';

const r = Router();
r.use(authenticate);
r.get('/', NotificationController.getRecent);
r.post('/', NotificationController.create);
export default r;

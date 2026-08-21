import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '@mahallu/shared-config';
import { MosqueController } from '../controllers/mosque.controller';

const router = Router();
router.use(authenticate);

router.get('/', authorize(PERMISSIONS.MEMBER_VIEW), MosqueController.get);
router.post('/', authorize(PERMISSIONS.SETTINGS_MANAGE), MosqueController.upsert);
router.get('/prayer-times', authorize(PERMISSIONS.MEMBER_VIEW), MosqueController.getPrayerTimes);

export default router;

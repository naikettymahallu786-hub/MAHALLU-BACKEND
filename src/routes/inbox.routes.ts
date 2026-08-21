import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { InboxController } from '../controllers/inbox.controller';

const router = Router();
router.use(authenticate);

router.get('/', InboxController.getUnified);

export default router;

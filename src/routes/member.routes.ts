import { Router } from 'express';
import { MemberController } from '../controllers/member.controller';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '@mahallu/shared-config';
import { auditLog } from '../middleware/requestLogger';

const router = Router();

router.use(authenticate);

// Member Routes
router.get('/stats', authorize(PERMISSIONS.MEMBER_VIEW), MemberController.getStats);
router.get('/search', authorize(PERMISSIONS.MEMBER_VIEW), MemberController.search);
router.post('/bulk-delete', authorize(PERMISSIONS.MEMBER_DELETE), auditLog('Member', 'DELETE'), MemberController.bulkDelete);
router.get('/', authorize(PERMISSIONS.MEMBER_VIEW), MemberController.getAll);
router.get('/:id', authorize(PERMISSIONS.MEMBER_VIEW), MemberController.getById);
router.get('/:id/qr-card', authorize(PERMISSIONS.MEMBER_VIEW), MemberController.getQRCard);
router.post('/', authorize(PERMISSIONS.MEMBER_CREATE), auditLog('Member', 'CREATE'), MemberController.create);
router.put('/:id', authorize(PERMISSIONS.MEMBER_UPDATE), auditLog('Member', 'UPDATE'), MemberController.update);
router.delete('/:id', authorize(PERMISSIONS.MEMBER_DELETE), auditLog('Member', 'DELETE'), MemberController.delete);

export default router;

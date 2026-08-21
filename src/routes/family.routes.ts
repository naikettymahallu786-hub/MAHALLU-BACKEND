import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { FamilyController } from '../controllers/family.controller';

const router = Router();
router.use(authenticate);

// ──────────────────────────────────────────────────
// GET /families/reports/recurring
// Detailed recurring donation report with filters & CSV export
// ──────────────────────────────────────────────────
router.get('/reports/recurring', authorize(PERMISSIONS.FAMILY_VIEW), FamilyController.getRecurringReport);

router.get('/', authorize(PERMISSIONS.FAMILY_VIEW), FamilyController.getAll);
router.get('/:id', authorize(PERMISSIONS.FAMILY_VIEW), FamilyController.getById);
router.post('/', authorize(PERMISSIONS.FAMILY_CREATE), FamilyController.create);
router.put('/:id', authorize(PERMISSIONS.FAMILY_UPDATE), FamilyController.update);
router.delete('/:id', authorize(PERMISSIONS.FAMILY_DELETE), FamilyController.remove);
router.post('/restore-all', authorize(PERMISSIONS.FAMILY_UPDATE), FamilyController.restoreAll);
router.post('/bulk-assign-recurring', authorize(PERMISSIONS.FAMILY_UPDATE), FamilyController.bulkAssignRecurring);
router.post('/:id/remind-recurring', authorize(PERMISSIONS.FAMILY_VIEW), FamilyController.remindRecurring);

export default router;

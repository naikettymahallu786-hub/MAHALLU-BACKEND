import { Router } from 'express';
import { MobileSadarController } from '../../controllers/mobileSadar.controller';

const router = Router();

// ──────────────────────────────────────────────────
// SADAR MUALIM PORTAL
// ──────────────────────────────────────────────────

// GET /mobile/sadar/families
router.get('/sadar/families', MobileSadarController.getFamilies);

// GET /mobile/sadar/families/:familyId/members
// Fetch all members of a family with student enrollment status
router.get('/sadar/families/:familyId/members', MobileSadarController.getFamilyMembers);

// GET /mobile/sadar/classes
router.get('/sadar/classes', MobileSadarController.getClasses);

// POST /mobile/sadar/students
router.post('/sadar/students', MobileSadarController.createStudent);

export default router;

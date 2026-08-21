import { Router } from 'express';
import { MobileUstadhController } from '../../controllers/mobileUstadh.controller';

const router = Router();

// ──────────────────────────────────────────────────
// GET /mobile/me/ustadh/classes
// Ustadh's assigned classes and students
// ──────────────────────────────────────────────────
router.get('/me/ustadh/classes', MobileUstadhController.getClasses);

// ──────────────────────────────────────────────────
// PUT /mobile/me/ustadh/classes/:id/timetable
// Update class timetable (schedule)
// ──────────────────────────────────────────────────
router.put('/me/ustadh/classes/:id/timetable', MobileUstadhController.updateTimetable);

// ──────────────────────────────────────────────────
// POST /mobile/me/ustadh/attendance
// Submit attendance for a class
// ──────────────────────────────────────────────────
router.post('/me/ustadh/attendance', MobileUstadhController.markAttendance);

// ──────────────────────────────────────────────────
// POST /mobile/me/ustadh/notify
// Send notification to class or specific student
// ──────────────────────────────────────────────────
router.post('/me/ustadh/notify', MobileUstadhController.notify);

// ──────────────────────────────────────────────────
// GET /mobile/me/ustadh/homework
// Fetch homework assignments
// ──────────────────────────────────────────────────
router.get('/me/ustadh/homework', MobileUstadhController.getHomework);

// ──────────────────────────────────────────────────
// POST /mobile/me/ustadh/homework
// Create a new homework assignment
// ──────────────────────────────────────────────────
router.post('/me/ustadh/homework', MobileUstadhController.createHomework);

// ──────────────────────────────────────────────────
// PUT /mobile/me/ustadh/homework/:id/grade
// Grade homework submissions
// ──────────────────────────────────────────────────
router.put('/me/ustadh/homework/:id/grade', MobileUstadhController.gradeHomework);

// ──────────────────────────────────────────────────
// GET /mobile/me/ustadh/exams
// Fetch exams for classes assigned to the Ustadh
// ──────────────────────────────────────────────────
router.get('/me/ustadh/exams', MobileUstadhController.getExams);

// ──────────────────────────────────────────────────
// POST /mobile/me/ustadh/exams
// Create an exam
// ──────────────────────────────────────────────────
router.post('/me/ustadh/exams', MobileUstadhController.createExam);

// ──────────────────────────────────────────────────
// PUT /mobile/me/ustadh/exams/:id/results
// Enter exam results for a student
// ──────────────────────────────────────────────────
router.put('/me/ustadh/exams/:id/results', MobileUstadhController.saveExamResults);

export default router;

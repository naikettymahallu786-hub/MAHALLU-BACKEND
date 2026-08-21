import { Router } from 'express';
import { MobileGeneralController } from '../../controllers/mobileGeneral.controller';

const router = Router();

// ──────────────────────────────────────────────────
// GET /mobile/me/profile
// Returns full user + member + family data
// ──────────────────────────────────────────────────
router.get('/me/profile', MobileGeneralController.getProfile);

// ──────────────────────────────────────────────────
// GET /mobile/me/family
// Returns family with all members populated
// ──────────────────────────────────────────────────
router.get('/me/family', MobileGeneralController.getFamily);

// ──────────────────────────────────────────────────
// PUT /mobile/me/family
// Update family details & recurring donation options for logged-in user
// ──────────────────────────────────────────────────
router.put('/me/family', MobileGeneralController.updateFamily);

// ──────────────────────────────────────────────────
// PUT /mobile/me/members/:memberId
// Update family member details by family head/member
// ──────────────────────────────────────────────────
router.put('/me/members/:memberId', MobileGeneralController.updateMember);

// ──────────────────────────────────────────────────
// GET /mobile/me/payments
// Payment history for the logged-in member
// ──────────────────────────────────────────────────
router.get('/me/payments', MobileGeneralController.getPayments);

// ──────────────────────────────────────────────────
// GET /mobile/me/donations
// Donation history for the logged-in member
// ──────────────────────────────────────────────────
router.get('/me/donations', MobileGeneralController.getDonations);

// ──────────────────────────────────────────────────
// GET /mobile/me/notifications
// Notifications for the logged-in user
// ──────────────────────────────────────────────────
router.get('/me/notifications', MobileGeneralController.getNotifications);

// ──────────────────────────────────────────────────
// GET /mobile/me/dues
// Pending dues (donations with status 'pending') for family
// ──────────────────────────────────────────────────
router.get('/me/dues', MobileGeneralController.getDues);

// ──────────────────────────────────────────────────
// GET /mobile/me/student
// Student record for logged-in student user
// ──────────────────────────────────────────────────
router.get('/me/student', MobileGeneralController.getStudent);

// ──────────────────────────────────────────────────
// GET /mobile/me/student/attendance
// Attendance records for the student
// ──────────────────────────────────────────────────
router.get('/me/student/attendance', MobileGeneralController.getStudentAttendance);

// ──────────────────────────────────────────────────
// GET /mobile/me/student/homework
// Homework for the student's class
// ──────────────────────────────────────────────────
router.get('/me/student/homework', MobileGeneralController.getStudentHomework);

// ──────────────────────────────────────────────────
// GET /mobile/me/student/exams
// Exam results for the student
// ──────────────────────────────────────────────────
router.get('/me/student/exams', MobileGeneralController.getStudentExams);

// ──────────────────────────────────────────────────
// GET /mobile/me/children
// For PARENT role: returns all students where guardianId matches
// ──────────────────────────────────────────────────
router.get('/me/children', MobileGeneralController.getChildren);

// ──────────────────────────────────────────────────
// GET /mobile/events
// Upcoming events (public access for authenticated users)
// ──────────────────────────────────────────────────
router.get('/events', MobileGeneralController.getEvents);

// ──────────────────────────────────────────────────
// GET /mobile/announcements
// Recent broadcast notifications
// ──────────────────────────────────────────────────
router.get('/announcements', MobileGeneralController.getAnnouncements);

// ──────────────────────────────────────────────────
// GET /mobile/prayer-times
// Proxy to Aladhan API with tenant location
// ──────────────────────────────────────────────────
router.get('/prayer-times', MobileGeneralController.getPrayerTimes);

// ──────────────────────────────────────────────────
// GET /mobile/teachers
// Teacher directory
// ──────────────────────────────────────────────────
router.get('/teachers', MobileGeneralController.getTeachers);

// ──────────────────────────────────────────────────
// GET /mobile/certificates
// ──────────────────────────────────────────────────
router.get('/certificates', MobileGeneralController.getCertificates);

// ──────────────────────────────────────────────────
// POST /mobile/certificates/request
// ──────────────────────────────────────────────────
router.post('/certificates/request', MobileGeneralController.requestCertificate);

// ──────────────────────────────────────────────────
// GET /mobile/properties
// ──────────────────────────────────────────────────
router.get('/properties', MobileGeneralController.getProperties);

// ──────────────────────────────────────────────────
// POST /mobile/properties/request
// ──────────────────────────────────────────────────
router.post('/properties/request', MobileGeneralController.requestPropertyRental);

// ──────────────────────────────────────────────────
// GET /mobile/member/family-students
// ──────────────────────────────────────────────────
router.get('/member/family-students', MobileGeneralController.getFamilyStudents);

export default router;

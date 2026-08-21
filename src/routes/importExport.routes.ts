import { Router } from 'express';
import multer from 'multer';
import { ImportExportController } from '../controllers/importExport.controller';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authenticate);

router.get('/template', authorize(PERMISSIONS.MEMBER_VIEW), ImportExportController.downloadTemplate);
router.post('/import', authorize(PERMISSIONS.MEMBER_CREATE), upload.single('file'), ImportExportController.importData);
router.get('/export', authorize(PERMISSIONS.MEMBER_EXPORT || PERMISSIONS.MEMBER_VIEW), ImportExportController.exportData);
router.get('/history', authorize(PERMISSIONS.MEMBER_VIEW), ImportExportController.getHistory);
router.put('/history/:id/pause', authorize(PERMISSIONS.MEMBER_CREATE), ImportExportController.pauseJob);
router.put('/history/:id/resume', authorize(PERMISSIONS.MEMBER_CREATE), ImportExportController.resumeJob);
router.put('/history/:id/cancel', authorize(PERMISSIONS.MEMBER_CREATE), ImportExportController.cancelJob);

export default router;

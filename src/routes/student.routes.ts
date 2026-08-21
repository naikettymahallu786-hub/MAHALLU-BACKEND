import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { StudentController } from '../controllers/student.controller';

const router = Router();
router.use(authenticate);

router.get('/', authorize(PERMISSIONS.STUDENT_VIEW), StudentController.getAll);
router.get('/:id', authorize(PERMISSIONS.STUDENT_VIEW), StudentController.getById);
router.post('/', authorize(PERMISSIONS.STUDENT_CREATE), StudentController.create);
router.put('/:id', authorize(PERMISSIONS.STUDENT_UPDATE), StudentController.update);
router.delete('/:id', authorize(PERMISSIONS.STUDENT_DELETE), StudentController.remove);

export default router;

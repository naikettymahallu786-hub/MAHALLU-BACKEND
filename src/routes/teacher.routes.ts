import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { TeacherController } from '../controllers/teacher.controller';

const r = Router();
r.use(authenticate);
r.get('/', authorize(PERMISSIONS.TEACHER_VIEW), TeacherController.getAll);
r.get('/:id', authorize(PERMISSIONS.TEACHER_VIEW), TeacherController.getById);
r.post('/', authorize(PERMISSIONS.TEACHER_CREATE), TeacherController.create);
r.put('/:id', authorize(PERMISSIONS.TEACHER_UPDATE), TeacherController.update);
export default r;

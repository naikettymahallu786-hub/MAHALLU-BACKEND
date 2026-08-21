import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { HomeworkController } from '../controllers/homework.controller';

const r = Router();
r.use(authenticate);
r.get('/', authorize(PERMISSIONS.HOMEWORK_VIEW), HomeworkController.getAll);
r.post('/', authorize(PERMISSIONS.HOMEWORK_CREATE), HomeworkController.create);
r.post('/:id/submit', authorize(PERMISSIONS.HOMEWORK_SUBMIT), HomeworkController.submit);
r.patch('/:id/grade', authorize(PERMISSIONS.HOMEWORK_GRADE), HomeworkController.grade);
export default r;

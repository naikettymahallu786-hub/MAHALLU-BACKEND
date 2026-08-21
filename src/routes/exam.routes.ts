import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '@mahallu/shared-config';
import { ExamController } from '../controllers/exam.controller';

const r = Router();
r.use(authenticate);
r.get('/', authorize(PERMISSIONS.EXAM_VIEW), ExamController.getAll);
r.post('/', authorize(PERMISSIONS.EXAM_CREATE), ExamController.create);
r.put('/:id/results', authorize(PERMISSIONS.EXAM_GRADE), ExamController.updateResults);
export default r;

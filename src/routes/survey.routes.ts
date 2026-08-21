import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { SurveyController } from '../controllers/survey.controller';

const r = Router();
r.use(authenticate);
r.get('/', SurveyController.getAll);
r.post('/', SurveyController.create);
r.post('/:id/respond', SurveyController.respond);
export default r;

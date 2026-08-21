import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '@mahallu/shared-config';
import { EventController } from '../controllers/event.controller';

const r = Router();
r.use(authenticate);

r.get('/', authorize(PERMISSIONS.EVENT_VIEW), EventController.getAll);
r.get('/:id', authorize(PERMISSIONS.EVENT_VIEW), EventController.getById);
r.post('/', authorize(PERMISSIONS.EVENT_CREATE), EventController.create);
r.put('/:id', authorize(PERMISSIONS.EVENT_UPDATE), EventController.update);
r.post('/:id/register', authorize(PERMISSIONS.EVENT_VIEW), EventController.register);

export default r;

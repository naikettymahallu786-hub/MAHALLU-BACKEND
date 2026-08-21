import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { DeathController } from '../controllers/death.controller';

const r = Router();
r.use(authenticate);
r.get('/', authorize(PERMISSIONS.DEATH_VIEW), DeathController.getAll);
r.post('/', authorize(PERMISSIONS.DEATH_CREATE), DeathController.create);
export default r;

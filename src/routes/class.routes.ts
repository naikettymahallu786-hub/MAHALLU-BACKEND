import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { ClassController } from '../controllers/class.controller';

const router = Router();
router.use(authenticate);

router.get('/', authorize(PERMISSIONS.MADRASA_VIEW), ClassController.getAll);
router.get('/:id', authorize(PERMISSIONS.MADRASA_VIEW), ClassController.getById);
router.post('/', authorize(PERMISSIONS.MADRASA_UPDATE), ClassController.create);
router.put('/:id', authorize(PERMISSIONS.MADRASA_UPDATE), ClassController.update);

export default router;

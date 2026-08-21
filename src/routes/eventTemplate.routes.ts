import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { EventTemplateController } from '../controllers/eventTemplate.controller';

const router = Router();
router.use(authenticate);

// GET /event-templates (Fetch all templates for tenant)
router.get('/', authorize(PERMISSIONS.EVENT_VIEW), EventTemplateController.getAll);

// GET /event-templates/:id
router.get('/:id', authorize(PERMISSIONS.EVENT_VIEW), EventTemplateController.getById);

// POST /event-templates (Create custom template)
router.post('/', authorize(PERMISSIONS.EVENT_CREATE), EventTemplateController.create);

// PUT /event-templates/:id (Update template)
router.put('/:id', authorize(PERMISSIONS.EVENT_UPDATE), EventTemplateController.update);

// DELETE /event-templates/:id
router.delete('/:id', authorize(PERMISSIONS.EVENT_UPDATE), EventTemplateController.remove);

export default router;

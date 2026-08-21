import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import mobileGeneralRoutes from './mobile/general.routes';
import mobileUstadhRoutes from './mobile/ustadh.routes';
import mobileSadarRoutes from './mobile/sadar.routes';

// mobile.routes.ts was originally a single 1288-line file covering every
// mobile-app endpoint. It has been split into role-scoped sub-routers,
// each mounted at '/' here so every URL is unchanged for API consumers.
const router = Router();
router.use(authenticate);

router.use('/', mobileGeneralRoutes);
router.use('/', mobileUstadhRoutes);
router.use('/', mobileSadarRoutes);

export default router;

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '@mahallu/shared-config';
import { PropertyController } from '../controllers/property.controller';

const r = Router();
r.use(authenticate);

r.get('/', authorize(PERMISSIONS.PROPERTY_VIEW), PropertyController.getAll);
r.post('/', authorize(PERMISSIONS.PROPERTY_CREATE), PropertyController.create);
r.get('/:id/leases', authorize(PERMISSIONS.PROPERTY_VIEW), PropertyController.getLeases);
r.post('/:id/leases', authorize(PERMISSIONS.PROPERTY_UPDATE), PropertyController.createLease);

// Admin fetches all rental requests
r.get('/requests', authorize(PERMISSIONS.PROPERTY_VIEW), PropertyController.getAllRequests);
// Admin fetches a single rental request
r.get('/requests/:id', authorize(PERMISSIONS.PROPERTY_VIEW), PropertyController.getRequestById);
// Admin approves a rental request
r.post('/requests/:id/approve', authorize(PERMISSIONS.PROPERTY_UPDATE), PropertyController.approveRequest);
// Admin rejects a rental request
r.post('/requests/:id/reject', authorize(PERMISSIONS.PROPERTY_UPDATE), PropertyController.rejectRequest);

r.get('/:id', authorize(PERMISSIONS.PROPERTY_VIEW), PropertyController.getById);
r.put('/:id', authorize(PERMISSIONS.PROPERTY_UPDATE), PropertyController.update);

export default r;

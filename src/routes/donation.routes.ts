import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '@mahallu/shared-config';
import { DonationController } from '../controllers/donation.controller';

const r = Router();
r.use(authenticate);
r.get('/', authorize(PERMISSIONS.DONATION_VIEW), DonationController.getAll);
r.post('/', authorize(PERMISSIONS.DONATION_CREATE), DonationController.create);
r.post('/:id/collect', authorize(PERMISSIONS.DONATION_CREATE), DonationController.collect);

export default r;

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { CertificateController } from '../controllers/certificate.controller';

const r = Router();
r.use(authenticate);

// Admin fetches all issued certificates
r.get('/', authorize(PERMISSIONS.CERTIFICATE_VIEW), CertificateController.getAll);

// Admin fetches all certificate requests
r.get('/requests', authorize(PERMISSIONS.CERTIFICATE_VIEW), CertificateController.getAllRequests);

// Admin fetches a single certificate request
r.get('/requests/:id', authorize(PERMISSIONS.CERTIFICATE_VIEW), CertificateController.getRequestById);

// Admin approves a certificate request with template selection, verified details, E-Sign & E-Stamp
r.post('/requests/:id/approve', authorize(PERMISSIONS.CERTIFICATE_CREATE), CertificateController.approveRequest);

// Admin rejects a certificate request
r.post('/requests/:id/reject', authorize(PERMISSIONS.CERTIFICATE_CREATE), CertificateController.rejectRequest);

// Get single issued certificate details by ID
r.get('/:id', CertificateController.getById);

export default r;

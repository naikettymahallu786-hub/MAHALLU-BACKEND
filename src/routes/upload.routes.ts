import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { UploadController } from '../controllers/upload.controller';

const r = Router();
r.use(authenticate);
r.post('/', UploadController.upload);
export default r;

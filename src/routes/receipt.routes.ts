import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ReceiptController } from '../controllers/receipt.controller';

const r = Router();
r.use(authenticate);
r.get('/', ReceiptController.getAll);
r.get('/:id', ReceiptController.getById);
r.post('/manual', ReceiptController.createManual);
export default r;

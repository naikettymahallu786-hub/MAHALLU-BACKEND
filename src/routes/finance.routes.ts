import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from '@mahallu/shared-config';
import { FinanceController } from '../controllers/finance.controller';

const router = Router();
router.use(authenticate);

// GET /api/v1/finance/transactions
router.get('/transactions', authorize(PERMISSIONS.FINANCE_VIEW), FinanceController.getTransactions);

// POST /api/v1/finance/transactions
router.post('/transactions', authorize(PERMISSIONS.FINANCE_CREATE), FinanceController.createTransaction);

export default router;

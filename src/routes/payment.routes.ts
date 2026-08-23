import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { PaymentController } from '../controllers/payment.controller';

const router = Router();

// Public Checkout UI Page for Mobile Browser (Supports Razorpay and Cashfree)
router.get('/checkout', PaymentController.checkout);
router.get('/cashfree-checkout', PaymentController.cashfreeCheckout);
router.get('/cashfree-return', PaymentController.cashfreeReturn);

// Verify payment signature
router.post('/verify', PaymentController.verify);
router.post('/cashfree-verify', PaymentController.verifyCashfree);

// Authenticated Routes
router.use(authenticate);

// ──────────────────────────────────────────────────
// GET /payments/reports/finance
// Full financial report covering all transactions, categories, methods & date ranges
// ──────────────────────────────────────────────────
router.get('/reports/finance', authorize(PERMISSIONS.PAYMENT_VIEW || PERMISSIONS.FINANCE_VIEW), PaymentController.getFinanceReport);

router.post('/create-order', PaymentController.createOrder);

router.get('/', authorize(PERMISSIONS.PAYMENT_VIEW), PaymentController.getAll);

export default router;

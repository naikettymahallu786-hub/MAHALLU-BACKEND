import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PaymentService } from '../services/payment.service';
import { renderPaymentCheckoutPage } from '../domain/paymentCheckoutPage';

export class PaymentController {
  // Not wrapped in try/catch in the original handler — preserved exactly
  // (a synchronous template render; nothing here can actually throw).
  static checkout(req: Request, res: Response): void {
    const { orderId, paymentId, amount, name, email, phone, redirectUrl } = req.query;
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_TEgC71zlAgHt9w';

    const html = renderPaymentCheckoutPage({ orderId, paymentId, amount, name, email, phone, redirectUrl, keyId });
    res.send(html);
  }

  static async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payment = await PaymentService.verify(req.body);
      res.json({ success: true, message: 'Payment verified', data: payment });
    } catch (error) {
      next(error);
    }
  }

  static async getFinanceReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PaymentService.getFinanceReport(req.user!.tenantId, req.query as any);
      if (result.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.content);
        return;
      }
      res.json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  }

  static async createOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PaymentService.createOrder(req.user!.tenantId, req.user!.userId, req.user!.role, req.body);
      if (result.immediate) {
        res.status(201).json({ success: true, message: 'Payment recorded successfully', data: { payment: result.payment, receipt: result.receipt } });
        return;
      }
      res.json({ success: true, data: { order: result.order, payment: result.payment } });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { payments, pagination } = await PaymentService.getAll(req.user!.tenantId, req.query as any);
      res.json({ success: true, data: payments, pagination });
    } catch (error) {
      next(error);
    }
  }
}

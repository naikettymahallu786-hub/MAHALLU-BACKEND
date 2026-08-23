import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PaymentService } from '../services/payment.service';
import { renderPaymentCheckoutPage } from '../domain/paymentCheckoutPage';
import { renderCashfreeCheckoutPage } from '../domain/cashfreeCheckoutPage';

export class PaymentController {
  // Synchronous Razorpay or Cashfree template renderer
  static checkout(req: Request, res: Response): void {
    const { orderId, paymentId, amount, name, email, phone, redirectUrl, paymentSessionId, gateway } = req.query;

    if (gateway === 'cashfree' || paymentSessionId) {
      const html = renderCashfreeCheckoutPage({
        paymentSessionId: String(paymentSessionId || ''),
        orderId: String(orderId || ''),
        paymentId: String(paymentId || ''),
        amount: Number(amount || 0),
        name: String(name || ''),
        email: String(email || ''),
        phone: String(phone || ''),
        redirectUrl: String(redirectUrl || ''),
        environment: (process.env.CASHFREE_ENV as any) === 'production' ? 'production' : 'sandbox',
      });
      res.send(html);
      return;
    }

    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_TEgC71zlAgHt9w';
    const html = renderPaymentCheckoutPage({ orderId, paymentId, amount, name, email, phone, redirectUrl, keyId });
    res.send(html);
  }

  static cashfreeCheckout(req: Request, res: Response): void {
    const { orderId, paymentId, amount, name, email, phone, redirectUrl, paymentSessionId } = req.query;
    const html = renderCashfreeCheckoutPage({
      paymentSessionId: String(paymentSessionId || ''),
      orderId: String(orderId || ''),
      paymentId: String(paymentId || ''),
      amount: Number(amount || 0),
      name: String(name || ''),
      email: String(email || ''),
      phone: String(phone || ''),
      redirectUrl: String(redirectUrl || ''),
      environment: (process.env.CASHFREE_ENV as any) === 'production' ? 'production' : 'sandbox',
    });
    res.send(html);
  }

  static async cashfreeReturn(req: Request, res: Response): Promise<void> {
    try {
      const orderId = String(req.query.order_id || req.query.orderId || '');
      const paymentId = String(req.query.paymentId || '');
      const redirectUrl = String(req.query.redirectUrl || process.env.MOBILE_DEEP_LINK || 'mahallu://payments');

      if (!orderId) {
        res.redirect(`${redirectUrl}?status=failure&error=missing_order_id`);
        return;
      }

      const result = await PaymentService.verifyCashfreeOrder(orderId, paymentId);

      if (result.success && result.status === 'PAID') {
        const finalPaymentId = result.payment?._id || paymentId;
        res.redirect(`${redirectUrl}?status=success&paymentId=${finalPaymentId}`);
      } else {
        res.redirect(`${redirectUrl}?status=${result.status === 'CANCELLED' ? 'cancelled' : 'failure'}&error=${encodeURIComponent(result.status)}`);
      }
    } catch (error: any) {
      const redirectUrl = String(req.query.redirectUrl || 'mahallu://payments');
      res.redirect(`${redirectUrl}?status=failure&error=${encodeURIComponent(error.message || 'verification_failed')}`);
    }
  }

  static async verifyCashfree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId, paymentId } = req.body;
      const result = await PaymentService.verifyCashfreeOrder(orderId, paymentId);
      res.json({ success: result.success, data: result });
    } catch (error) {
      next(error);
    }
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

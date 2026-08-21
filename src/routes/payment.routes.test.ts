import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Payment } from '../models/Payment';
import { Receipt } from '../models/Receipt';
import { Member } from '../models/Member';
import { Family } from '../models/Family';
import { UserRole } from '@mahallu/shared-types';

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'order_mock123' }),
    },
  }));
});

const app = createApp();
const baseAddress = { line1: 'X', city: 'Kochi', district: 'Ernakulam', pincode: '682001' };

describe('GET /api/v1/payments/checkout', () => {
  it('renders the checkout HTML page with no auth required', async () => {
    const res = await request(app).get('/api/v1/payments/checkout').query({
      orderId: 'order_1',
      paymentId: objectId().toString(),
      amount: 10000,
      name: 'Test User',
      email: 'test@example.com',
      phone: '+919000000000',
    });

    expect(res.status).toBe(200);
    expect(res.text).toContain('Mahallu Payment Checkout');
    expect(res.text).toContain('order_1');
  });
});

describe('POST /api/v1/payments/verify', () => {
  const secret = process.env.RAZORPAY_KEY_SECRET || 'Q7eUlKyyGO7dV2JRpyU1N0sP';

  it('rejects an invalid signature with no auth required', async () => {
    const res = await request(app).post('/api/v1/payments/verify').send({
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'wrong-signature',
      paymentId: objectId().toString(),
    });

    expect(res.status).toBe(400);
  });

  it('accepts a valid signature, marks the payment successful, and generates a receipt', async () => {
    const tenant = await createTenant();
    const member = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Payer',
      gender: 'male',
      phone: '+919000000001',
    });
    const payment = await Payment.create({
      tenantId: tenant._id,
      paymentNo: 'PAY-1',
      type: 'donation',
      amount: 500,
      paidById: member._id,
      gateway: 'razorpay',
      status: 'pending',
    });

    const orderId = 'order_abc';
    const paymentGatewayId = 'pay_abc';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentGatewayId}`)
      .digest('hex');

    const res = await request(app).post('/api/v1/payments/verify').send({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentGatewayId,
      razorpay_signature: signature,
      paymentId: payment._id.toString(),
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('success');

    const receipt = await Receipt.findOne({ tenantId: tenant._id });
    expect(receipt).not.toBeNull();
    const updatedPayment = await Payment.findById(payment._id);
    expect(updatedPayment!.receiptId).toBeDefined();
  });
});

describe('GET /api/v1/payments/reports/finance', () => {
  it('merges Payment, Family dues, and Donation records into one sorted feed with a summary', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Payer',
      gender: 'male',
      phone: '+919000000002',
    });
    await Payment.create({
      tenantId: tenant._id,
      paymentNo: 'PAY-1',
      type: 'donation',
      amount: 100,
      paidById: member._id,
      gateway: 'cash',
      status: 'completed',
    });
    await Family.create({
      tenantId: tenant._id,
      familyCode: 'FAM-1',
      address: baseAddress,
      recurringDonationType: 'monthly',
      outstandingBalance: 50,
      headMemberId: member._id,
    });

    const res = await request(app).get('/api/v1/payments/reports/finance').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalTransactions).toBe(2);
    expect(res.body.data.summary.totalIncome).toBe(100);
    expect(res.body.data.summary.pendingAmount).toBe(50);
    expect(res.body.data.items.some((i: any) => i.paymentNo === 'DUE-FAM-1')).toBe(true);
  });

  it('exports CSV using the unified escapeCSVField style', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Comma, Payer',
      gender: 'male',
      phone: '+919000000003',
    });
    await Payment.create({
      tenantId: tenant._id,
      paymentNo: 'PAY-1',
      type: 'donation',
      amount: 100,
      paidById: member._id,
      gateway: 'cash',
      status: 'completed',
    });

    const res = await request(app)
      .get('/api/v1/payments/reports/finance?format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('"Comma, Payer"');
  });

  it('returns totalPages:1 (not 0) when there are no results at all', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get('/api/v1/payments/reports/finance').set('Authorization', `Bearer ${token}`);
    expect(res.body.data.pagination.totalPages).toBe(1);
  });

  it('returns all items on one page when limit=all', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Payer',
      gender: 'male',
      phone: '+919000000004',
    });
    for (let i = 0; i < 3; i++) {
      await Payment.create({
        tenantId: tenant._id,
        paymentNo: `PAY-${i}`,
        type: 'donation',
        amount: 10,
        paidById: member._id,
        gateway: 'cash',
        status: 'completed',
      });
    }

    const res = await request(app)
      .get('/api/v1/payments/reports/finance?limit=all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.pagination.totalPages).toBe(1);
  });
});

describe('POST /api/v1/payments/create-order', () => {
  it('rejects when the caller lacks PAYMENT_CREATE/PAYMENT_SELF permission', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.STUDENT });

    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, type: 'donation', gateway: 'cash' });

    expect(res.status).toBe(403);
  });

  it('immediately records and receipts a cash payment', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SUPER_ADMIN });

    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, type: 'donation', gateway: 'cash' });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.status).toBe('success');
    expect(res.body.data.receipt).toBeDefined();
  });

  it('creates a Razorpay order for gateway=razorpay (default) and leaves the payment pending', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SUPER_ADMIN });

    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 300, type: 'donation' });

    expect(res.status).toBe(200);
    expect(res.body.data.order.id).toBe('order_mock123');
    expect(res.body.data.payment.status).toBe('pending');
    expect(res.body.data.payment.gatewayOrderId).toBe('order_mock123');
  });
});

describe('GET /api/v1/payments', () => {
  it('paginates and filters by type/status', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Payer',
      gender: 'male',
      phone: '+919000000005',
    });
    await Payment.create({ tenantId: tenant._id, paymentNo: 'PAY-1', type: 'donation', amount: 10, paidById: member._id, gateway: 'cash', status: 'completed' });
    await Payment.create({ tenantId: tenant._id, paymentNo: 'PAY-2', type: 'salary', amount: 20, paidById: member._id, gateway: 'cash', status: 'completed' });

    const res = await request(app)
      .get('/api/v1/payments?type=donation')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });
});

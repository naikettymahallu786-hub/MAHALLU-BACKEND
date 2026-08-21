import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Receipt } from '../models/Receipt';
import { Payment } from '../models/Payment';
import { Family } from '../models/Family';
import { Member } from '../models/Member';

const app = createApp();

const baseAddress = { line1: 'X', city: 'Kochi', district: 'Ernakulam', pincode: '682001' };

async function createMember(tenantId: any, overrides: Partial<Record<string, unknown>> = {}) {
  return Member.create({
    tenantId,
    memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
    name: 'Test Member',
    gender: 'male',
    phone: `+9188888${Math.floor(Math.random() * 100000)}`,
    ...overrides,
  });
}

describe('GET /api/v1/receipts', () => {
  it('lists receipts for the tenant, populated, newest first', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await createMember(tenant._id);
    const payment = await Payment.create({
      tenantId: tenant._id,
      paymentNo: 'PAY-1',
      type: 'donation',
      amount: 100,
      paidById: member._id,
      gateway: 'cash',
      status: 'completed',
    });
    await Receipt.create({ tenantId: tenant._id, receiptNo: 'RCP-1', paymentId: payment._id });

    const res = await request(app).get('/api/v1/receipts').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].paymentId.paidById.name).toBe('Test Member');
  });
});

describe('GET /api/v1/receipts/:id', () => {
  it('returns null data (no 404) when the receipt does not exist — matches pre-existing behavior', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .get(`/api/v1/receipts/${objectId()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

describe('POST /api/v1/receipts/manual', () => {
  it('resolves the payer from an explicit paidById when provided', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await createMember(tenant._id);

    const res = await request(app)
      .post('/api/v1/receipts/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, paidById: member._id.toString(), description: 'Test' });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.paidById).toBe(member._id.toString());
    expect(res.body.data.payment.paymentNo).toMatch(/^PAY-\d{4}-\d{6}$/);
    expect(res.body.data.receipt.receiptNo).toMatch(/^RCP-\d{4}-\d{6}$/);
  });

  it('falls back to the family head when no paidById/paidForId is given but familyId is', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const head = await createMember(tenant._id);
    const family = await Family.create({
      tenantId: tenant._id,
      familyCode: `FAM-${Math.floor(Math.random() * 1e6)}`,
      address: baseAddress,
      headMemberId: head._id,
    });

    const res = await request(app)
      .post('/api/v1/receipts/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 150, familyId: family._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.paidById).toBe(head._id.toString());
  });

  it('falls back to the current user\'s own linked member when no other payer can be resolved', async () => {
    const tenant = await createTenant();
    const member = await createMember(tenant._id);
    const { token } = await createAuthedUser(tenant._id, { memberId: member._id });

    const res = await request(app)
      .post('/api/v1/receipts/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.paidById).toBe(member._id.toString());
  });

  it('falls back to any member in the tenant as a last resort', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const fallbackMember = await createMember(tenant._id);

    const res = await request(app)
      .post('/api/v1/receipts/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.paidById).toBe(fallbackMember._id.toString());
  });

  it('applies processPaymentDues, decrementing the family balance when familyId is provided', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const head = await createMember(tenant._id);
    const family = await Family.create({
      tenantId: tenant._id,
      familyCode: `FAM-${Math.floor(Math.random() * 1e6)}`,
      address: baseAddress,
      headMemberId: head._id,
      outstandingBalance: 500,
    });

    const res = await request(app)
      .post('/api/v1/receipts/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, familyId: family._id.toString() });

    expect(res.status).toBe(201);
    const updated = await Family.findById(family._id);
    expect(updated!.outstandingBalance).toBe(300);
  });
});

import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Family } from '../models/Family';
import { Member } from '../models/Member';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { UserRole } from "../types";

const app = createApp();
const baseAddress = { line1: 'X', city: 'Kochi', district: 'Ernakulam', pincode: '682001' };

async function createFamily(tenantId: any, overrides: Partial<Record<string, unknown>> = {}) {
  return Family.create({
    tenantId,
    familyCode: `FAM-${Math.floor(Math.random() * 1e6)}`,
    address: baseAddress,
    ...overrides,
  });
}

describe('GET /api/v1/families/reports/recurring', () => {
  it('derives PAID/UNPAID/OVERDUE status and computes summary totals', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createFamily(tenant._id, {
      recurringDonationType: 'monthly',
      recurringDonationAmount: 100,
      outstandingBalance: 0,
    });
    await createFamily(tenant._id, {
      recurringDonationType: 'monthly',
      recurringDonationAmount: 200,
      outstandingBalance: 200,
      nextPaymentDueDate: new Date('2020-01-01'),
    });

    const res = await request(app).get('/api/v1/families/reports/recurring').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.paidCount).toBe(1);
    expect(res.body.data.summary.overdueCount).toBe(1);
    expect(res.body.data.summary.totalOutstanding).toBe(200);
  });

  it('does not collide with GET /:id routing (route order preserved)', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get('/api/v1/families/reports/recurring').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toBeDefined();
  });

  it('exports CSV using the unified escapeCSVField style (unquoted plain values, per the approved CSV unification)', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createFamily(tenant._id, { familyCode: 'FAM-0001', recurringDonationType: 'monthly', recurringDonationAmount: 50 });

    const res = await request(app)
      .get('/api/v1/families/reports/recurring?format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.split('\n');
    expect(lines[0]).toBe('Family Code,Head Name,Phone,Ward,Address,Recurring Frequency,Recurring Amount (INR),Outstanding Dues (INR),Next Due Date,Status');
    // Unquoted plain value (unlike the old always-quote "FAM-0001" style).
    expect(lines[1].startsWith('FAM-0001,')).toBe(true);
  });
});

describe('GET /api/v1/families', () => {
  it('paginates and falls back to a Member lookup for the head when headMemberId has no populated name', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await createFamily(tenant._id);
    await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Fallback Head',
      gender: 'male',
      phone: '+919000000000',
      familyId: family._id,
    });

    const res = await request(app).get('/api/v1/families').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].headMemberId.name).toBe('Fallback Head');
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 100, total: 1 });
  });

  it('excludes soft-deleted families by default, includes them with includeDeleted=true', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createFamily(tenant._id, { isDeleted: true });

    const excluded = await request(app).get('/api/v1/families').set('Authorization', `Bearer ${token}`);
    expect(excluded.body.data).toHaveLength(0);

    const included = await request(app)
      .get('/api/v1/families?includeDeleted=true')
      .set('Authorization', `Bearer ${token}`);
    expect(included.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/families/:id', () => {
  it('returns 404 when the family does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get(`/api/v1/families/${objectId()}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('computes nextPaymentDueDate on the fly when unset', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await createFamily(tenant._id, { recurringDonationType: 'monthly', recurringPaymentDay: 15 });

    const res = await request(app).get(`/api/v1/families/${family._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.body.data.nextPaymentDueDate).toBeDefined();
  });
});

describe('POST /api/v1/families', () => {
  it('creates a family with a generated familyCode, QR code, and computed due date', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: baseAddress, recurringDonationType: 'monthly', recurringPaymentDay: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data.familyCode).toMatch(/^FAM-\d{4}$/);
    expect(res.body.data.qrCode).toMatch(/^data:image/);
    expect(res.body.data.nextPaymentDueDate).toBeDefined();
  });
});

describe('PUT /api/v1/families/:id', () => {
  it('recomputes nextPaymentDueDate when recurring fields change', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await createFamily(tenant._id);

    const res = await request(app)
      .put(`/api/v1/families/${family._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recurringDonationType: 'monthly', recurringPaymentDay: 20 });

    expect(res.status).toBe(200);
    expect(res.body.data.nextPaymentDueDate).toBeDefined();
  });

  it('sets outstandingBalance from the request body\'s recurringDonationAmount when markPending is true', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await createFamily(tenant._id);

    const res = await request(app)
      .put(`/api/v1/families/${family._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ markPending: true, recurringDonationAmount: 300 });

    expect(res.body.data.outstandingBalance).toBe(300);
  });

  it('falls back to max(existing outstandingBalance, 100) when markPending is true but no amount is in the body', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await createFamily(tenant._id);

    const res = await request(app)
      .put(`/api/v1/families/${family._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ markPending: true });

    expect(res.body.data.outstandingBalance).toBe(100);
  });

  it('zeroes outstandingBalance when markPending is false', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await createFamily(tenant._id, { outstandingBalance: 500 });

    const res = await request(app)
      .put(`/api/v1/families/${family._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ markPending: false });

    expect(res.body.data.outstandingBalance).toBe(0);
  });
});

describe('DELETE /api/v1/families/:id', () => {
  it('soft-deletes the family', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await createFamily(tenant._id);

    const res = await request(app).delete(`/api/v1/families/${family._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const updated = await Family.findById(family._id).setOptions({ includeDeleted: true });
    expect(updated!.isDeleted).toBe(true);
  });
});

describe('POST /api/v1/families/restore-all', () => {
  it('restores all soft-deleted families for the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createFamily(tenant._id, { isDeleted: true });
    await createFamily(tenant._id, { isDeleted: true });

    const res = await request(app).post('/api/v1/families/restore-all').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.restoredCount).toBe(2);
  });
});

describe('POST /api/v1/families/bulk-assign-recurring', () => {
  it('assigns recurring donation settings to all families when isAllFamilies is true', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createFamily(tenant._id);
    await createFamily(tenant._id);

    const res = await request(app)
      .post('/api/v1/families/bulk-assign-recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ isAllFamilies: true, recurringDonationType: 'yearly', recurringDonationAmount: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.modifiedCount).toBe(2);
    const families = await Family.find({ tenantId: tenant._id });
    expect(families.every((f) => f.recurringDonationType === 'yearly')).toBe(true);
  });

  it('marks pending with an immediate due date when markPending is true', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await createFamily(tenant._id);

    const res = await request(app)
      .post('/api/v1/families/bulk-assign-recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ familyIds: [family._id.toString()], recurringDonationAmount: 250, markPending: true });

    expect(res.status).toBe(200);
    const updated = await Family.findById(family._id);
    expect(updated!.outstandingBalance).toBe(250);
  });
});

describe('POST /api/v1/families/:id/remind-recurring', () => {
  it('returns 404 when the family does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post(`/api/v1/families/${objectId()}/remind-recurring`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when the family has no head member', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await createFamily(tenant._id);

    const res = await request(app)
      .post(`/api/v1/families/${family._id}/remind-recurring`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when the head member has no user account', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const head = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Head',
      gender: 'male',
      phone: '+919000000001',
    });
    const family = await createFamily(tenant._id, { headMemberId: head._id });

    const res = await request(app)
      .post(`/api/v1/families/${family._id}/remind-recurring`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('creates a notification for the head user when everything is set up', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const head = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Head',
      gender: 'male',
      phone: '+919000000002',
    });
    const headUser = await User.create({
      tenantId: tenant._id,
      memberId: head._id,
      name: 'Head',
      email: `head${Date.now()}@example.com`,
      phone: '+919000000003',
      role: UserRole.PARENT,
      passwordHash: 'Original@123',
    });
    const family = await createFamily(tenant._id, {
      headMemberId: head._id,
      recurringDonationAmount: 400,
      recurringDonationType: 'monthly',
    });

    const res = await request(app)
      .post(`/api/v1/families/${family._id}/remind-recurring`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const notifications = await Notification.find({ tenantId: tenant._id, recipientId: headUser._id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toContain('₹400');
  });
});

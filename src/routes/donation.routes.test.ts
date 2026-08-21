import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Donation } from '../models/Donation';
import { Family } from '../models/Family';
import { Member } from '../models/Member';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { Payment } from '../models/Payment';
import { UserRole } from '@mahallu/shared-types';

const app = createApp();

const baseAddress = { line1: 'X', city: 'Kochi', district: 'Ernakulam', pincode: '682001' };

async function createFamily(tenantId: any, overrides: Partial<Record<string, unknown>> = {}) {
  return Family.create({
    tenantId,
    familyCode: `FAM-${Math.floor(Math.random() * 1e6)}`,
    address: baseAddress,
    outstandingBalance: 0,
    ...overrides,
  });
}

async function createHeadMemberAndUser(tenantId: any) {
  const member = await Member.create({
    tenantId,
    memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
    name: 'Family Head',
    gender: 'male',
    phone: `+9188888${Math.floor(Math.random() * 100000)}`,
  });
  const user = await User.create({
    tenantId,
    memberId: member._id,
    name: 'Family Head',
    email: `head${Date.now()}${Math.random()}@example.com`,
    phone: `+9199999${Math.floor(Math.random() * 100000)}`,
    role: UserRole.PARENT,
    passwordHash: 'Original@123',
  });
  return { member, user };
}

describe('GET /api/v1/donations', () => {
  it('paginates and filters by campaign', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Donation.create({ tenantId: tenant._id, amount: 100, campaign: 'Ramadan' });
    await Donation.create({ tenantId: tenant._id, amount: 200, campaign: 'Zakat' });

    const res = await request(app)
      .get('/api/v1/donations?campaign=Ramadan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
  });
});

describe('POST /api/v1/donations', () => {
  it('creates a direct paid donation with no familyId/gateway', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500, campaign: 'General', donorName: 'Anonymous Donor' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('paid');
  });

  it('marks a single family donation pending, increments its balance, and notifies the head user', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const { member, user } = await createHeadMemberAndUser(tenant._id);
    const family = await createFamily(tenant._id, { headMemberId: member._id, outstandingBalance: 100 });

    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 250, campaign: 'Building Fund', familyId: family._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');

    const updatedFamily = await Family.findById(family._id);
    expect(updatedFamily!.outstandingBalance).toBe(350);

    const notifications = await Notification.find({ tenantId: tenant._id, recipientId: user._id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('New Due Added');
  });

  it('collects payment immediately when a gateway is provided, creating a Payment+Receipt and linking them', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const { member } = await createHeadMemberAndUser(tenant._id);
    const family = await createFamily(tenant._id, { headMemberId: member._id });

    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 300, campaign: 'Iftar', familyId: family._id.toString(), gateway: 'cash' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('paid');
    expect(res.body.data.paymentId).toBeDefined();

    const payment = await Payment.findById(res.body.data.paymentId);
    expect(payment).not.toBeNull();
    expect(payment!.paidById.toString()).toBe(member._id.toString());
    expect(payment!.receiptId).toBeDefined();
  });

  it('assigns a pending donation to all families and notifies every head user, when familyId is "all_families"', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const { member: member1, user: user1 } = await createHeadMemberAndUser(tenant._id);
    const { member: member2, user: user2 } = await createHeadMemberAndUser(tenant._id);
    await createFamily(tenant._id, { headMemberId: member1._id });
    await createFamily(tenant._id, { headMemberId: member2._id });

    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, campaign: 'Annual Due', familyId: 'all_families' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((d: any) => d.status === 'pending')).toBe(true);

    const families = await Family.find({ tenantId: tenant._id });
    expect(families.every((f) => f.outstandingBalance === 100)).toBe(true);

    const notifCount = await Notification.countDocuments({ tenantId: tenant._id });
    expect(notifCount).toBe(2);
  });

  it('assigns a paid donation to all families without incrementing balances, when a gateway is provided with selectAllFamilies', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createFamily(tenant._id);

    const res = await request(app)
      .post('/api/v1/donations')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 50, campaign: 'Instant', selectAllFamilies: true, gateway: 'cash' });

    expect(res.status).toBe(201);
    expect(res.body.data[0].status).toBe('paid');

    const family = await Family.findOne({ tenantId: tenant._id });
    expect(family!.outstandingBalance).toBe(0);
  });
});

describe('POST /api/v1/donations/:id/collect', () => {
  it('returns a raw 404 body when the donation does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post(`/api/v1/donations/${objectId()}/collect`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Donation not found' });
  });

  it('returns a raw 400 body when the donation is already paid', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const donation = await Donation.create({ tenantId: tenant._id, amount: 100, status: 'paid' });

    const res = await request(app)
      .post(`/api/v1/donations/${donation._id}/collect`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Donation is already paid' });
  });

  it('collects a pending donation, creates Payment+Receipt, and decrements the family balance', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const { member } = await createHeadMemberAndUser(tenant._id);
    const family = await createFamily(tenant._id, { headMemberId: member._id, outstandingBalance: 300 });
    const donation = await Donation.create({
      tenantId: tenant._id,
      familyId: family._id,
      amount: 300,
      status: 'pending',
    });

    const res = await request(app)
      .post(`/api/v1/donations/${donation._id}/collect`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gateway: 'upi' });

    expect(res.status).toBe(200);
    expect(res.body.data.donation.status).toBe('paid');

    const updatedFamily = await Family.findById(family._id);
    expect(updatedFamily!.outstandingBalance).toBe(0);
  });
});

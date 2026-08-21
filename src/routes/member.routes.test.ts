// Characterization tests for MemberController — written against the
// unmodified controller first to establish a passing baseline before its
// logic moves into MemberService/MemberRepository.
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { Member } from '../models/Member';
import { Family } from '../models/Family';
import { UserRole } from '@mahallu/shared-types';

const app = createApp();

function objectId() {
  return new mongoose.Types.ObjectId();
}

const baseAddress = { line1: 'X', city: 'Kochi', district: 'Ernakulam', pincode: '682001' };

async function createTenant() {
  return Tenant.create({
    name: 'Test Mahallu',
    mahalluCode: `TM${Math.floor(Math.random() * 1e6)}`,
    phone: '+919876500000',
    email: `tenant${Date.now()}${Math.random()}@example.com`,
    address: baseAddress,
  });
}

async function createAuthedUser(tenantId: mongoose.Types.ObjectId) {
  const user = await User.create({
    tenantId,
    name: 'Member Admin',
    email: `memberadmin${Date.now()}${Math.random()}@example.com`,
    phone: `+9199999${Math.floor(Math.random() * 100000)}`,
    role: UserRole.SUPER_ADMIN,
    passwordHash: 'Original@123',
    isActive: true,
  });
  const token = jwt.sign(
    { userId: user._id.toString(), tenantId: tenantId.toString(), role: user.role, permissions: [] },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '15m' },
  );
  return { user, token };
}

async function createMember(tenantId: mongoose.Types.ObjectId, overrides: Partial<Record<string, unknown>> = {}) {
  return Member.create({
    tenantId,
    memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
    name: 'Test Member',
    gender: 'male',
    phone: `+9188888${Math.floor(Math.random() * 100000)}`,
    ...overrides,
  });
}

describe('GET /api/v1/members', () => {
  it('paginates and filters by search/status/gender', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createMember(tenant._id, { name: 'Alice Searchable', status: 'active', gender: 'female' });
    await createMember(tenant._id, { name: 'Bob Other', status: 'inactive', gender: 'male' });

    const res = await request(app)
      .get('/api/v1/members')
      .query({ search: 'Alice', status: 'active', gender: 'female' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Alice Searchable');
    expect(res.body.pagination.total).toBe(1);
  });

  it('excludes soft-deleted members by default', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createMember(tenant._id, { isDeleted: true });

    const res = await request(app).get('/api/v1/members').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(0);
  });

  it('defaults to DEFAULT_PAGINATION (page 1, limit 20) when no page/limit query params are given', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get('/api/v1/members').set('Authorization', `Bearer ${token}`);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20 });
  });
});

describe('GET /api/v1/members/:id', () => {
  it('returns the member when found', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await createMember(tenant._id);

    const res = await request(app).get(`/api/v1/members/${member._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(member._id.toString());
  });

  it('returns 404 when not found', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get(`/api/v1/members/${objectId()}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/members', () => {
  it('generates a memberId and QR code, and creates the member', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Member', gender: 'male', phone: '+919000000001' });

    expect(res.status).toBe(201);
    expect(res.body.data.memberId).toMatch(/^MHL-\d{4}-\d{4}$/);
    expect(res.body.data.qrCode).toMatch(/^data:image/);
  });

  it('pushes the new member into the target family\'s embedded members array when familyId is provided', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-1', address: baseAddress });

    const res = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Family Member', gender: 'female', phone: '+919000000002', familyId: family._id.toString(), relationship: 'Spouse' });

    expect(res.status).toBe(201);
    const updatedFamily = await Family.findById(family._id);
    expect(updatedFamily!.members).toHaveLength(1);
    expect(updatedFamily!.members[0].memberId.toString()).toBe(res.body.data._id);
    expect(updatedFamily!.members[0].relationship).toBe('Spouse');
  });
});

describe('PUT /api/v1/members/:id', () => {
  it('moves the member from the old family to the new family when familyId changes', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const oldFamily = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-OLD', address: baseAddress });
    const newFamily = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-NEW', address: baseAddress });
    const member = await createMember(tenant._id, { familyId: oldFamily._id });
    await Family.findByIdAndUpdate(oldFamily._id, { $push: { members: { memberId: member._id, relationship: 'Member', isHead: false } } });

    const res = await request(app)
      .put(`/api/v1/members/${member._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ familyId: newFamily._id.toString(), relationship: 'Child' });

    expect(res.status).toBe(200);
    const updatedOld = await Family.findById(oldFamily._id);
    const updatedNew = await Family.findById(newFamily._id);
    expect(updatedOld!.members).toHaveLength(0);
    expect(updatedNew!.members).toHaveLength(1);
    expect(updatedNew!.members[0].relationship).toBe('Child');
  });

  it('updates only the relationship in place when the family does not change', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-SAME', address: baseAddress });
    const member = await createMember(tenant._id, { familyId: family._id });
    await Family.findByIdAndUpdate(family._id, { $push: { members: { memberId: member._id, relationship: 'Member', isHead: false } } });

    const res = await request(app)
      .put(`/api/v1/members/${member._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ familyId: family._id.toString(), relationship: 'Head' });

    expect(res.status).toBe(200);
    const updated = await Family.findById(family._id);
    expect(updated!.members).toHaveLength(1);
    expect(updated!.members[0].relationship).toBe('Head');
  });

  it('returns 404 when the member does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .put(`/api/v1/members/${objectId()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/members/:id', () => {
  it('hard-deletes the member and cascades to the User account and Family membership', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const linkedUser = await User.create({
      tenantId: tenant._id, name: 'Linked', email: `linked${Date.now()}@example.com`,
      phone: '+919000000003', role: UserRole.PARENT, passwordHash: 'x', isActive: true,
    });
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-DEL', address: baseAddress });
    const member = await createMember(tenant._id, { userId: linkedUser._id, familyId: family._id });
    await Family.findByIdAndUpdate(family._id, { $push: { members: { memberId: member._id, relationship: 'Member', isHead: false } } });

    const res = await request(app).delete(`/api/v1/members/${member._id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await Member.findById(member._id)).toBeNull();
    const updatedUser = await User.findById(linkedUser._id);
    expect(updatedUser!.isDeleted).toBe(true);
    expect(updatedUser!.isActive).toBe(false);
    const updatedFamily = await Family.findById(family._id);
    expect(updatedFamily!.members).toHaveLength(0);
  });

  it('returns 200 (no error) even when the member does not exist — pre-existing behavior, not a not-found check', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).delete(`/api/v1/members/${objectId()}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/members/bulk-delete', () => {
  it('hard-deletes all matched members and cascades to linked User accounts', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const linkedUser = await User.create({
      tenantId: tenant._id, name: 'Linked2', email: `linked2${Date.now()}@example.com`,
      phone: '+919000000004', role: UserRole.PARENT, passwordHash: 'x', isActive: true,
    });
    const m1 = await createMember(tenant._id, { userId: linkedUser._id });
    const m2 = await createMember(tenant._id);

    const res = await request(app)
      .post('/api/v1/members/bulk-delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [m1._id.toString(), m2._id.toString()] });

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    expect(await Member.findById(m1._id)).toBeNull();
    expect(await Member.findById(m2._id)).toBeNull();
    const updatedUser = await User.findById(linkedUser._id);
    expect(updatedUser!.isDeleted).toBe(true);
  });

  it('rejects when ids is missing or empty', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/members/bulk-delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [] });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/members/:id/qr-card', () => {
  it('generates and persists a QR code when missing', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await createMember(tenant._id, { qrCode: undefined });

    const res = await request(app).get(`/api/v1/members/${member._id}/qr-card`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.qrCode).toMatch(/^data:image/);
    const updated = await Member.findById(member._id);
    expect(updated!.qrCode).toBeDefined();
  });
});

describe('GET /api/v1/members/search', () => {
  it('searches across name/phone/memberId/aadhaarNumber', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createMember(tenant._id, { name: 'Findme Person' });

    const res = await request(app)
      .get('/api/v1/members/search')
      .query({ q: 'Findme' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('rejects when q is missing', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get('/api/v1/members/search').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/members/stats', () => {
  it('returns counts by status and gender', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createMember(tenant._id, { status: 'active', gender: 'male' });
    await createMember(tenant._id, { status: 'active', gender: 'female' });
    await createMember(tenant._id, { status: 'inactive', gender: 'male' });

    const res = await request(app).get('/api/v1/members/stats').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, active: 2, inactive: 1, male: 2, female: 1 });
  });
});

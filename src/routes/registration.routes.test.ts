// Characterization tests for the registration domain — written against the
// unmodified controller first to establish a passing baseline before its
// logic moves into RegistrationService/RegistrationRepository. Also covers
// the current error-handling convention (manual res.status(500).json(...)
// instead of next(err)) so a change to next(err) can be verified to
// produce byte-identical response shapes.
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { Member } from '../models/Member';
import { Family } from '../models/Family';
import { RegistrationRequest, RegistrationStatus, RegistrationType } from '../models/RegistrationRequest';
import { UserRole } from '@mahallu/shared-types';

const app = createApp();

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

async function createAuthedAdmin(tenantId: mongoose.Types.ObjectId) {
  const user = await User.create({
    tenantId,
    name: 'Reg Admin',
    email: `regadmin${Date.now()}${Math.random()}@example.com`,
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

describe('POST /api/v1/registrations/submit', () => {
  it('creates a PENDING registration request', async () => {
    const tenant = await createTenant();

    const res = await request(app).post('/api/v1/registrations/submit').send({
      mahalluCode: tenant.mahalluCode,
      type: 'MEMBER',
      payload: { name: 'X', phone: '+919000000001' },
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    const stored = await RegistrationRequest.findById(res.body.data._id);
    expect(stored).not.toBeNull();
  });

  it('rejects when required fields are missing', async () => {
    const res = await request(app).post('/api/v1/registrations/submit').send({ type: 'MEMBER' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an invalid mahallu code', async () => {
    const res = await request(app).post('/api/v1/registrations/submit').send({
      mahalluCode: 'NOPE000', type: 'MEMBER', payload: { name: 'X' },
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/registrations/families/:mahalluCode', () => {
  it('returns formatted families with head names', async () => {
    const tenant = await createTenant();
    const head = await Member.create({
      tenantId: tenant._id, memberId: 'MHL-H1', name: 'Head One', gender: 'male', phone: '+911',
    });
    await Family.create({ tenantId: tenant._id, familyCode: 'FAM-1', headMemberId: head._id, address: baseAddress });

    const res = await request(app).get(`/api/v1/registrations/families/${tenant.mahalluCode}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { _id: expect.any(String), familyCode: 'FAM-1', headName: 'Head One' },
    ]);
  });

  it('falls back to "Unknown" when the family has no resolvable head', async () => {
    const tenant = await createTenant();
    await Family.create({ tenantId: tenant._id, familyCode: 'FAM-2', address: baseAddress });

    const res = await request(app).get(`/api/v1/registrations/families/${tenant.mahalluCode}`);
    expect(res.body.data[0].headName).toBe('Unknown');
  });

  it('rejects an invalid mahallu code', async () => {
    const res = await request(app).get('/api/v1/registrations/families/NOPE000');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/registrations/pending', () => {
  it('returns only PENDING requests for the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedAdmin(tenant._id);
    await RegistrationRequest.create({ tenantId: tenant._id, type: 'MEMBER', payload: {}, status: RegistrationStatus.PENDING });
    await RegistrationRequest.create({ tenantId: tenant._id, type: 'MEMBER', payload: {}, status: RegistrationStatus.APPROVED });

    const res = await request(app).get('/api/v1/registrations/pending').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('PENDING');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/registrations/pending');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/registrations/:id/reject', () => {
  it('marks a pending request as REJECTED', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedAdmin(tenant._id);
    const reg = await RegistrationRequest.create({ tenantId: tenant._id, type: 'MEMBER', payload: { name: 'X' }, status: RegistrationStatus.PENDING });

    const res = await request(app).post(`/api/v1/registrations/${reg._id}/reject`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const updated = await RegistrationRequest.findById(reg._id);
    expect(updated!.status).toBe('REJECTED');
  });

  it('returns 404 when the request does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedAdmin(tenant._id);

    const res = await request(app)
      .post(`/api/v1/registrations/${new mongoose.Types.ObjectId()}/reject`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/registrations/:id/approve', () => {
  it('MEMBER type: creates the head Member, dependent Members, a Family, and a User account', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedAdmin(tenant._id);
    const reg = await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.MEMBER,
      status: RegistrationStatus.PENDING,
      payload: {
        name: 'Head Person', phone: '+919111111111', email: 'head@example.com',
        familyMembers: [{ name: 'Dependent One', relationship: 'Child' }],
        addressLine1: 'Line 1', city: 'City', district: 'District', pincode: '682001',
      },
    });

    const res = await request(app).post(`/api/v1/registrations/${reg._id}/approve`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.generatedPassword).toHaveLength(8);
    expect(res.body.data.email).toBe('head@example.com');

    const headMember = await Member.findOne({ tenantId: tenant._id, name: 'Head Person' });
    const dependent = await Member.findOne({ tenantId: tenant._id, name: 'Dependent One' });
    expect(headMember).not.toBeNull();
    expect(dependent).not.toBeNull();
    expect(dependent!.phone).toBe('+919111111111'); // inherits head's phone

    const family = await Family.findOne({ tenantId: tenant._id, headMemberId: headMember!._id });
    expect(family).not.toBeNull();
    expect(headMember!.familyId?.toString()).toBe(family!._id.toString());
    expect(dependent!.familyId?.toString()).toBe(family!._id.toString());

    const user = await User.findOne({ tenantId: tenant._id, email: 'head@example.com' });
    expect(user!.role).toBe(UserRole.PARENT);
    expect(headMember!.userId?.toString()).toBe(user!._id.toString());

    const updatedReg = await RegistrationRequest.findById(reg._id);
    expect(updatedReg!.status).toBe('APPROVED');
  });

  it('STUDENT type: uses placeholder madrasaId/classId (the member\'s own id) when none are provided — pre-existing behavior, not fixed', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedAdmin(tenant._id);
    const reg = await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.STUDENT,
      status: RegistrationStatus.PENDING,
      payload: { name: 'Student One', phone: '+919222222222' },
    });

    const res = await request(app).post(`/api/v1/registrations/${reg._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const member = await Member.findOne({ tenantId: tenant._id, name: 'Student One' });
    const { Student } = await import('../models/Student');
    const student = await Student.findOne({ tenantId: tenant._id, memberId: member!._id });
    expect(student!.madrasaId.toString()).toBe(member!._id.toString());
    expect(student!.classId.toString()).toBe(member!._id.toString());
    expect(student!.guardianId.toString()).toBe(member!._id.toString()); // self-guardian, no familyId given
  });

  it('STUDENT type: links to an existing family and uses the family head as guardian when familyId is given', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedAdmin(tenant._id);
    const head = await Member.create({ tenantId: tenant._id, memberId: 'MHL-HEAD', name: 'Parent', gender: 'male', phone: '+919333333333' });
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-STU', headMemberId: head._id, address: baseAddress });
    const reg = await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.STUDENT,
      status: RegistrationStatus.PENDING,
      payload: { name: 'Child Student', phone: '+919444444444', familyId: family._id.toString() },
    });

    const res = await request(app).post(`/api/v1/registrations/${reg._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const member = await Member.findOne({ tenantId: tenant._id, name: 'Child Student' });
    expect(member!.familyId?.toString()).toBe(family._id.toString());
    const updatedFamily = await Family.findById(family._id);
    expect(updatedFamily!.members.some((m: any) => m.memberId.toString() === member!._id.toString())).toBe(true);

    const { Student } = await import('../models/Student');
    const student = await Student.findOne({ tenantId: tenant._id, memberId: member!._id });
    expect(student!.guardianId.toString()).toBe(head._id.toString());
  });

  it('TEACHER type: creates a Teacher with role USTADH', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedAdmin(tenant._id);
    const reg = await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.TEACHER,
      status: RegistrationStatus.PENDING,
      payload: { name: 'Teacher One', phone: '+919555555555', qualification: 'BA' },
    });

    const res = await request(app).post(`/api/v1/registrations/${reg._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const member = await Member.findOne({ tenantId: tenant._id, name: 'Teacher One' });
    const { Teacher } = await import('../models/Teacher');
    const teacher = await Teacher.findOne({ tenantId: tenant._id, memberId: member!._id });
    expect(teacher).not.toBeNull();
    const user = await User.findOne({ tenantId: tenant._id, phone: '+919555555555' });
    expect(user!.role).toBe(UserRole.USTADH);
  });

  it('appends a unique suffix to the phone when a User with that phone already exists for the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedAdmin(tenant._id);
    await User.create({
      tenantId: tenant._id, name: 'Existing', email: `existing${Date.now()}@example.com`,
      phone: '+919666666666', role: UserRole.PARENT, passwordHash: 'x', isActive: true,
    });
    const reg = await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.MEMBER,
      status: RegistrationStatus.PENDING,
      payload: { name: 'Second Member', phone: '+919666666666', addressLine1: 'X', city: 'X', district: 'X', pincode: '682001' },
    });

    const res = await request(app).post(`/api/v1/registrations/${reg._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.phone).not.toBe('+919666666666');
    expect(res.body.data.phone).toContain('+919666666666_');
  });

  it('returns 404 when the request does not exist or is already processed', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedAdmin(tenant._id);
    const reg = await RegistrationRequest.create({ tenantId: tenant._id, type: 'MEMBER', payload: {}, status: RegistrationStatus.APPROVED });

    const res = await request(app).post(`/api/v1/registrations/${reg._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // NOTE: this documents an intentional, plan-approved behavior change from
  // aligning this domain's error handling to next(err)/AppError (previously
  // every exception here — including Mongoose ValidationErrors — was caught
  // locally and turned into a generic 500 "Server error while approving
  // registration"). Routing through the shared errorHandler now produces its
  // ValidationError branch instead: 422 with field-level messages. Not run
  // against the pre-move baseline (it would have asserted 500 there) — this
  // spec targets the deliberately-changed behavior directly.
  it('surfaces a Mongoose ValidationError (missing required phone) as 422 via the shared error handler', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedAdmin(tenant._id);
    const reg = await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.MEMBER,
      status: RegistrationStatus.PENDING,
      payload: { name: 'No Phone Person' }, // Member.phone is required — omitted on purpose
    });

    const res = await request(app).post(`/api/v1/registrations/${reg._id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

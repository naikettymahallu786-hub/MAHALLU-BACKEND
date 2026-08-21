// Characterization tests for the 4 auth endpoints that currently bypass
// AuthService and query User/Tenant directly in AuthController (me,
// adminResetPassword, forgotPassword, resetPassword). Written against the
// unmodified controller first to establish a passing baseline before that
// logic moves into AuthService — the HTTP contract asserted here must not
// change as a result of that move.
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { UserRole } from '@mahallu/shared-types';

const app = createApp();

async function createTenant(overrides: Partial<Record<string, unknown>> = {}) {
  return Tenant.create({
    name: 'Test Mahallu',
    mahalluCode: `TM${Math.floor(Math.random() * 1e6)}`,
    phone: '+919876500000',
    email: `tenant${Date.now()}@example.com`,
    address: { line1: 'Main Road', city: 'Kochi', district: 'Ernakulam', pincode: '682001' },
    ...overrides,
  });
}

async function createUser(tenantId: mongoose.Types.ObjectId, overrides: Partial<Record<string, unknown>> = {}) {
  return User.create({
    tenantId,
    name: 'Test User',
    email: `user${Date.now()}${Math.random()}@example.com`,
    phone: `+9199999${Math.floor(Math.random() * 100000)}`,
    role: UserRole.SUPER_ADMIN,
    passwordHash: 'Original@123',
    isActive: true,
    ...overrides,
  });
}

function signAccessToken(user: { _id: mongoose.Types.ObjectId; tenantId: mongoose.Types.ObjectId; role: string }) {
  return jwt.sign(
    { userId: user._id.toString(), tenantId: user.tenantId.toString(), role: user.role, permissions: [] },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '15m' },
  );
}

describe('GET /api/v1/auth/me', () => {
  it('returns the authenticated user and their tenant', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id);
    const token = signAccessToken(user);

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user._id).toBe(user._id.toString());
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.tenant._id).toBe(tenant._id.toString());
    expect(res.body.data.tenant.mahalluCode).toBe(tenant.mahalluCode);
  });

  it('rejects requests with no token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/:memberId/admin-reset-password', () => {
  it('resets the password for the target user when the caller is SUPER_ADMIN', async () => {
    const tenant = await createTenant();
    const admin = await createUser(tenant._id, { role: UserRole.SUPER_ADMIN });
    const adminToken = signAccessToken(admin);
    const target = await createUser(tenant._id, { memberId: new mongoose.Types.ObjectId() });

    const res = await request(app)
      .post(`/api/v1/auth/${target.memberId}/admin-reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'NewPassword@123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await User.findById(target._id).select('+passwordHash');
    expect(await updated!.comparePassword('NewPassword@123')).toBe(true);
  });

  it('updates the login email when loginId contains "@"', async () => {
    const tenant = await createTenant();
    const admin = await createUser(tenant._id, { role: UserRole.SUPER_ADMIN });
    const adminToken = signAccessToken(admin);
    const target = await createUser(tenant._id, { memberId: new mongoose.Types.ObjectId() });

    const res = await request(app)
      .post(`/api/v1/auth/${target.memberId}/admin-reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ loginId: 'newemail@example.com' });

    expect(res.status).toBe(200);
    const updated = await User.findById(target._id);
    expect(updated!.email).toBe('newemail@example.com');
  });

  it('updates the login phone when loginId has no "@"', async () => {
    const tenant = await createTenant();
    const admin = await createUser(tenant._id, { role: UserRole.SUPER_ADMIN });
    const adminToken = signAccessToken(admin);
    const target = await createUser(tenant._id, { memberId: new mongoose.Types.ObjectId() });

    const res = await request(app)
      .post(`/api/v1/auth/${target.memberId}/admin-reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ loginId: '+919000000001' });

    expect(res.status).toBe(200);
    const updated = await User.findById(target._id);
    expect(updated!.phone).toBe('+919000000001');
  });

  it('rejects when neither newPassword nor loginId is provided', async () => {
    const tenant = await createTenant();
    const admin = await createUser(tenant._id, { role: UserRole.SUPER_ADMIN });
    const adminToken = signAccessToken(admin);

    const res = await request(app)
      .post(`/api/v1/auth/${new mongoose.Types.ObjectId()}/admin-reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects a new password shorter than 6 characters', async () => {
    const tenant = await createTenant();
    const admin = await createUser(tenant._id, { role: UserRole.SUPER_ADMIN });
    const adminToken = signAccessToken(admin);

    const res = await request(app)
      .post(`/api/v1/auth/${new mongoose.Types.ObjectId()}/admin-reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'abc' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when no user account exists for the given memberId', async () => {
    const tenant = await createTenant();
    const admin = await createUser(tenant._id, { role: UserRole.SUPER_ADMIN });
    const adminToken = signAccessToken(admin);

    const res = await request(app)
      .post(`/api/v1/auth/${new mongoose.Types.ObjectId()}/admin-reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'NewPassword@123' });

    expect(res.status).toBe(404);
  });

  it('rejects when the caller does not have SUPER_ADMIN or SECRETARY role', async () => {
    const tenant = await createTenant();
    const nonAdmin = await createUser(tenant._id, { role: UserRole.PARENT });
    const token = signAccessToken(nonAdmin);

    const res = await request(app)
      .post(`/api/v1/auth/${new mongoose.Types.ObjectId()}/admin-reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'NewPassword@123' });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/auth/forgot-password', () => {
  it('generates and stores an OTP, returning it in the response body (pre-existing behavior, not fixed by this task)', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id, { email: 'forgot@example.com' });

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ tenantCode: tenant.mahalluCode, identifier: 'forgot@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.otp).toMatch(/^\d{6}$/);
    expect(res.body.data.expiresAt).toBeDefined();

    const updated = await User.findById(user._id).select('+resetPasswordOTP +resetPasswordOTPExpires');
    expect(updated!.resetPasswordOTP).toBe(res.body.data.otp);
  });

  it('returns a generic success message without leaking whether the account exists', async () => {
    const tenant = await createTenant();

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ tenantCode: tenant.mahalluCode, identifier: 'no-such-user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeUndefined();
  });

  it('rejects when tenantCode or identifier is missing', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ identifier: 'x@example.com' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid mahallu code', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ tenantCode: 'NOPE000', identifier: 'x@example.com' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  it('resets the password when the OTP is valid and unexpired', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id, { email: 'reset@example.com' });
    await User.findByIdAndUpdate(user._id, {
      resetPasswordOTP: '123456',
      resetPasswordOTPExpires: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app).post('/api/v1/auth/reset-password').send({
      tenantCode: tenant.mahalluCode,
      identifier: 'reset@example.com',
      otp: '123456',
      newPassword: 'BrandNew@123',
    });

    expect(res.status).toBe(200);
    const updated = await User.findById(user._id).select('+passwordHash +resetPasswordOTP');
    expect(await updated!.comparePassword('BrandNew@123')).toBe(true);
    expect(updated!.resetPasswordOTP).toBeUndefined();
  });

  it('rejects when required fields are missing', async () => {
    const res = await request(app).post('/api/v1/auth/reset-password').send({ identifier: 'x@example.com' });
    expect(res.status).toBe(400);
  });

  it('rejects a new password shorter than 6 characters', async () => {
    const tenant = await createTenant();
    const res = await request(app).post('/api/v1/auth/reset-password').send({
      tenantCode: tenant.mahalluCode,
      identifier: 'x@example.com',
      otp: '123456',
      newPassword: 'abc',
    });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid mahallu code', async () => {
    const res = await request(app).post('/api/v1/auth/reset-password').send({
      tenantCode: 'NOPE000',
      identifier: 'x@example.com',
      otp: '123456',
      newPassword: 'BrandNew@123',
    });
    expect(res.status).toBe(404);
  });

  it('rejects when no OTP was ever requested for the user', async () => {
    const tenant = await createTenant();
    await createUser(tenant._id, { email: 'noOtp@example.com' });

    const res = await request(app).post('/api/v1/auth/reset-password').send({
      tenantCode: tenant.mahalluCode,
      identifier: 'noOtp@example.com',
      otp: '123456',
      newPassword: 'BrandNew@123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects an expired OTP', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id, { email: 'expired@example.com' });
    await User.findByIdAndUpdate(user._id, {
      resetPasswordOTP: '654321',
      resetPasswordOTPExpires: new Date(Date.now() - 1000),
    });

    const res = await request(app).post('/api/v1/auth/reset-password').send({
      tenantCode: tenant.mahalluCode,
      identifier: 'expired@example.com',
      otp: '654321',
      newPassword: 'BrandNew@123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects an incorrect OTP', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id, { email: 'wrongotp@example.com' });
    await User.findByIdAndUpdate(user._id, {
      resetPasswordOTP: '111111',
      resetPasswordOTPExpires: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app).post('/api/v1/auth/reset-password').send({
      tenantCode: tenant.mahalluCode,
      identifier: 'wrongotp@example.com',
      otp: '999999',
      newPassword: 'BrandNew@123',
    });
    expect(res.status).toBe(400);
  });
});

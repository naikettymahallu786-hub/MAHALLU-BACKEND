// Characterization tests for AuthService's simpler methods (refreshToken,
// logout, setup2FA, verify2FA, changePassword, updateFCMToken) — written
// against the unmodified service first to establish a passing baseline
// before their raw User queries move into AuthRepository. login() is
// deliberately out of scope here; it's complex/security-sensitive enough
// to warrant its own dedicated task.
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import mongoose from 'mongoose';
import { AuthService } from './auth.service';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { UserRole } from '@mahallu/shared-types';
import { isTokenBlacklisted } from '../config/redis';

async function createTenant() {
  return Tenant.create({
    name: 'Test Mahallu',
    mahalluCode: `TM${Math.floor(Math.random() * 1e6)}`,
    phone: '+919876500000',
    email: `tenant${Date.now()}${Math.random()}@example.com`,
    address: { line1: 'Main Road', city: 'Kochi', district: 'Ernakulam', pincode: '682001' },
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

function signRefreshToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
}

describe('AuthService.refreshToken', () => {
  it('issues new tokens and rotates the refresh token when the old one is valid', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id);
    const oldToken = signRefreshToken(user._id.toString());
    await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: oldToken } });

    const result = await AuthService.refreshToken(oldToken);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(oldToken);

    const updated = await User.findById(user._id).select('+refreshTokens');
    expect(updated!.refreshTokens).not.toContain(oldToken);
    expect(updated!.refreshTokens).toContain(result.refreshToken);

    const blacklisted = await isTokenBlacklisted(oldToken);
    expect(blacklisted).toBe(true);
  });

  it('rejects a malformed/invalid JWT', async () => {
    await expect(AuthService.refreshToken('not-a-real-token')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('rejects a well-formed token that is not in the user\'s stored refreshTokens', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id);
    const neverStoredToken = signRefreshToken(user._id.toString());

    await expect(AuthService.refreshToken(neverStoredToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a token for a user that no longer exists', async () => {
    const fakeToken = signRefreshToken(new mongoose.Types.ObjectId().toString());
    await expect(AuthService.refreshToken(fakeToken)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('AuthService.logout', () => {
  it('removes the refresh token and blacklists the access token', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id);
    const refreshToken = signRefreshToken(user._id.toString());
    await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: refreshToken } });
    const accessToken = 'some-access-token-value';

    await AuthService.logout(user._id.toString(), refreshToken, accessToken);

    const updated = await User.findById(user._id).select('+refreshTokens');
    expect(updated!.refreshTokens).not.toContain(refreshToken);

    expect(await isTokenBlacklisted(accessToken)).toBe(true);
  });
});

describe('AuthService.setup2FA', () => {
  it('generates and persists a 2FA secret for an existing user', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id);

    const result = await AuthService.setup2FA(user._id.toString());

    expect(result.secret).toBeDefined();
    expect(result.qrCode).toMatch(/^data:image/);

    const updated = await User.findById(user._id).select('+twoFactorSecret');
    expect(updated!.twoFactorSecret).toBe(result.secret);
  });

  it('throws when the user does not exist', async () => {
    await expect(AuthService.setup2FA(new mongoose.Types.ObjectId().toString())).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('AuthService.verify2FA', () => {
  it('enables 2FA when a valid TOTP code is provided', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id);
    const { secret } = await AuthService.setup2FA(user._id.toString());
    const validToken = speakeasy.totp({ secret, encoding: 'base32' });

    await AuthService.verify2FA(user._id.toString(), validToken);

    const updated = await User.findById(user._id);
    expect(updated!.twoFactorEnabled).toBe(true);
  });

  it('rejects when 2FA has not been set up', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id);

    await expect(AuthService.verify2FA(user._id.toString(), '123456')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an invalid TOTP code', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id);
    await AuthService.setup2FA(user._id.toString());

    await expect(AuthService.verify2FA(user._id.toString(), '000000')).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('AuthService.changePassword', () => {
  it('updates the password and clears refresh tokens when the current password is correct', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id, { passwordHash: 'CurrentPass@123' });
    await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: 'some-token' } });

    await AuthService.changePassword(user._id.toString(), 'CurrentPass@123', 'NewPass@456');

    const updated = await User.findById(user._id).select('+passwordHash +refreshTokens');
    expect(await updated!.comparePassword('NewPass@456')).toBe(true);
    expect(updated!.refreshTokens).toEqual([]);
  });

  it('rejects when the current password is incorrect', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id, { passwordHash: 'CurrentPass@123' });

    await expect(
      AuthService.changePassword(user._id.toString(), 'WrongPassword', 'NewPass@456'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws when the user does not exist', async () => {
    await expect(
      AuthService.changePassword(new mongoose.Types.ObjectId().toString(), 'x', 'NewPass@456'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('AuthService.updateFCMToken', () => {
  it('persists the FCM token on the user', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id);

    await AuthService.updateFCMToken(user._id.toString(), 'fcm-token-abc123');

    const updated = await User.findById(user._id);
    expect(updated!.fcmToken).toBe('fcm-token-abc123');
  });
});

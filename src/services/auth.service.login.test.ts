// Characterization tests for AuthService.login() — the most complex and
// security-sensitive function in the codebase (direct lookup, demo-account
// auto-provisioning, and a Member/Family fallback search that can create or
// reactivate User accounts as a side effect of a login attempt). Written
// against the unmodified implementation first to establish a passing
// baseline before its raw queries move into AuthRepository — every branch
// tested here must produce identical results after that move.
import mongoose from 'mongoose';
import { AuthService } from './auth.service';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { Member } from '../models/Member';
import { Family } from '../models/Family';
import { UserRole } from "../types";

async function createTenant(overrides: Partial<Record<string, unknown>> = {}) {
  return Tenant.create({
    name: 'Test Mahallu',
    mahalluCode: `TM${Math.floor(Math.random() * 1e6)}`,
    phone: '+919876500000',
    email: `tenant${Date.now()}${Math.random()}@example.com`,
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
    role: UserRole.PARENT,
    passwordHash: 'Original@123',
    isActive: true,
    ...overrides,
  });
}

const baseAddress = { line1: 'X', city: 'Kochi', district: 'Ernakulam', pincode: '682001' };

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

describe('AuthService.login — direct User match', () => {
  it('logs in successfully by email', async () => {
    const tenant = await createTenant();
    await createUser(tenant._id, { email: 'direct@example.com', passwordHash: 'Correct@123' });

    const { tokens, user } = await AuthService.login('direct@example.com', 'Correct@123', tenant.mahalluCode);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(user.email).toBe('direct@example.com');
    expect((user as any).passwordHash).toBeUndefined();
  });

  it('logs in successfully by phone', async () => {
    const tenant = await createTenant();
    await createUser(tenant._id, { phone: '+919000000099', passwordHash: 'Correct@123' });

    const { user } = await AuthService.login('+919000000099', 'Correct@123', tenant.mahalluCode);
    expect(user.phone).toBe('+919000000099');
  });

  it('rejects an incorrect password', async () => {
    const tenant = await createTenant();
    await createUser(tenant._id, { email: 'wrongpass@example.com', passwordHash: 'Correct@123' });

    await expect(
      AuthService.login('wrongpass@example.com', 'WrongPassword', tenant.mahalluCode),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a deactivated account', async () => {
    const tenant = await createTenant();
    await createUser(tenant._id, { email: 'inactive@example.com', passwordHash: 'Correct@123', isActive: false });

    await expect(
      AuthService.login('inactive@example.com', 'Correct@123', tenant.mahalluCode),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects an invalid tenant code', async () => {
    await expect(AuthService.login('x@example.com', 'x', 'NOPE000')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects an unknown identifier when no tenant code is given (no fallback search possible)', async () => {
    await expect(AuthService.login('nobody@example.com', 'x')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('updates lastLoginAt and stores the new refresh token', async () => {
    const tenant = await createTenant();
    const user = await createUser(tenant._id, { email: 'lastlogin@example.com', passwordHash: 'Correct@123' });

    const { tokens } = await AuthService.login('lastlogin@example.com', 'Correct@123', tenant.mahalluCode);

    const updated = await User.findById(user._id).select('+refreshTokens');
    expect(updated!.lastLoginAt).toBeInstanceOf(Date);
    expect(updated!.refreshTokens).toContain(tokens.refreshToken);
  });
});

describe('AuthService.login — demo account auto-provisioning', () => {
  it('creates the JMM001 tenant and a SUPER_ADMIN user for admin@mahallu.app when neither exists', async () => {
    const { user } = await AuthService.login('admin@mahallu.app', 'Admin@123456');

    expect(user.role).toBe(UserRole.SUPER_ADMIN);
    const tenant = await Tenant.findOne({ mahalluCode: 'JMM001' });
    expect(tenant).not.toBeNull();
  });

  it('creates a MADRASA_PRINCIPAL user for madrasa.admin@mahallu.app', async () => {
    const { user } = await AuthService.login('madrasa.admin@mahallu.app', 'Madrasa@123456');
    expect(user.role).toBe(UserRole.MADRASA_PRINCIPAL);
  });

  it('reuses an existing JMM001 tenant instead of creating a duplicate', async () => {
    await createTenant({ mahalluCode: 'JMM001' });
    const before = await Tenant.countDocuments({ mahalluCode: 'JMM001' });

    await AuthService.login('sadar@mahallu.app', 'Sadar@123456');

    const after = await Tenant.countDocuments({ mahalluCode: 'JMM001' });
    expect(after).toBe(before);
  });
});

describe('AuthService.login — Member fallback search', () => {
  it('creates a new User (role PARENT) when a matching Member exists with no linked account at all', async () => {
    const tenant = await createTenant();
    const member = await createMember(tenant._id, { email: 'memberfallback@example.com' });

    const { user } = await AuthService.login('memberfallback@example.com', 'ChosenPass@123', tenant.mahalluCode);

    expect(user.role).toBe(UserRole.PARENT);
    const updatedMember = await Member.findById(member._id);
    expect(updatedMember!.userId?.toString()).toBe((user as any)._id.toString());

    const createdUser = await User.findById((user as any)._id).select('+passwordHash');
    expect(await createdUser!.comparePassword('ChosenPass@123')).toBe(true);
  });

  it('matches a Member by memberId when the identifier is neither an email nor found by phone', async () => {
    const tenant = await createTenant();
    await createMember(tenant._id, { memberId: 'MHL-LOGIN-TEST', phone: '+919777000000' });

    const { user } = await AuthService.login('MHL-LOGIN-TEST', 'ChosenPass@123', tenant.mahalluCode);
    expect(user).toBeDefined();
  });

  it('reactivates a soft-deleted existing User linked to the member\'s identity, resetting its password to the submitted one', async () => {
    const tenant = await createTenant();
    const staleUser = await createUser(tenant._id, {
      email: 'reactivate@example.com',
      passwordHash: 'StaleOldPassword',
      isDeleted: true,
      isActive: false,
    });
    const member = await createMember(tenant._id, { email: 'reactivate@example.com' });

    const { user } = await AuthService.login('reactivate@example.com', 'BrandNewChoice@1', tenant.mahalluCode);

    expect((user as any)._id.toString()).toBe(staleUser._id.toString());
    const reactivated = await User.findById(staleUser._id).select('+passwordHash');
    expect(reactivated!.isDeleted).toBe(false);
    expect(reactivated!.isActive).toBe(true);
    expect(reactivated!.memberId?.toString()).toBe(member._id.toString());
    expect(await reactivated!.comparePassword('BrandNewChoice@1')).toBe(true);
  });

  it('uses the member\'s already-linked active User account directly, requiring its real current password', async () => {
    const tenant = await createTenant();
    const linkedUser = await createUser(tenant._id, {
      email: 'linked@example.com',
      passwordHash: 'TheRealPassword@1',
    });
    await createMember(tenant._id, { email: 'linked@example.com', userId: linkedUser._id });

    // Wrong password against the already-linked account must fail — it must
    // NOT silently reset the password the way the "no linked account" and
    // "soft-deleted account" branches do.
    await expect(
      AuthService.login('linked@example.com', 'SomeOtherGuess', tenant.mahalluCode),
    ).rejects.toMatchObject({ statusCode: 401 });

    // The real password still works.
    const { user } = await AuthService.login('linked@example.com', 'TheRealPassword@1', tenant.mahalluCode);
    expect((user as any)._id.toString()).toBe(linkedUser._id.toString());
  });
});

describe('AuthService.login — Family fallback search', () => {
  it('creates a new User for the family head when no Member/User match exists but the familyCode does', async () => {
    const tenant = await createTenant();
    const headMember = await createMember(tenant._id, { name: 'Head Person' });
    const family = await Family.create({
      tenantId: tenant._id,
      familyCode: 'FAM-LOGIN-TEST',
      headMemberId: headMember._id,
      address: baseAddress,
    });

    const { user } = await AuthService.login('FAM-LOGIN-TEST', 'FamilyChosenPass@1', tenant.mahalluCode);

    expect(user.role).toBe(UserRole.PARENT);
    const updatedHead = await Member.findById(headMember._id);
    expect(updatedHead!.userId?.toString()).toBe((user as any)._id.toString());
    void family;
  });

  it('matches familyCode case-insensitively', async () => {
    const tenant = await createTenant();
    const headMember = await createMember(tenant._id, {});
    await Family.create({
      tenantId: tenant._id,
      familyCode: 'FAM-CASE-TEST',
      headMemberId: headMember._id,
      address: baseAddress,
    });

    const { user } = await AuthService.login('fam-case-test', 'FamilyChosenPass@1', tenant.mahalluCode);
    expect(user).toBeDefined();
  });
});

describe('AuthService.login — no match anywhere', () => {
  it('rejects when the identifier matches no User, Member, or Family', async () => {
    const tenant = await createTenant();
    await expect(
      AuthService.login('totally-unknown@example.com', 'whatever', tenant.mahalluCode),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

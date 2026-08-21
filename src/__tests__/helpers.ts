import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { UserRole } from "../types";

export function objectId() {
  return new mongoose.Types.ObjectId();
}

export const baseAddress = { line1: 'X', city: 'Kochi', district: 'Ernakulam', pincode: '682001' };

export async function createTenant(overrides: Partial<Record<string, unknown>> = {}) {
  return Tenant.create({
    name: 'Test Mahallu',
    mahalluCode: `TM${Math.floor(Math.random() * 1e6)}`,
    phone: '+919876500000',
    email: `tenant${Date.now()}${Math.random()}@example.com`,
    address: baseAddress,
    ...overrides,
  });
}

// authorize() middleware derives permissions from ROLE_PERMISSIONS[role]
// server-side, not from the JWT payload's `permissions` field — so the
// empty array here doesn't affect what a SUPER_ADMIN test token can do.
export async function createAuthedUser(
  tenantId: mongoose.Types.ObjectId,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const user = await User.create({
    tenantId,
    name: 'Test Admin',
    email: `admin${Date.now()}${Math.random()}@example.com`,
    phone: `+9199999${Math.floor(Math.random() * 100000)}`,
    role: UserRole.SUPER_ADMIN,
    passwordHash: 'Original@123',
    isActive: true,
    ...overrides,
  });
  const token = jwt.sign(
    { userId: user._id.toString(), tenantId: tenantId.toString(), role: user.role, permissions: [] },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '15m' },
  );
  return { user, token };
}

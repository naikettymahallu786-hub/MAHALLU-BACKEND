// Characterization tests for the dashboard endpoints (all 5 read the DB
// directly in DashboardController today — no service/repository layer).
// Written against the unmodified controller first to establish a passing
// baseline before that logic moves into DashboardService/DashboardRepository.
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { createApp } from '../app';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { Family } from '../models/Family';
import { Member } from '../models/Member';
import { Student } from '../models/Student';
import { Teacher } from '../models/Teacher';
import { Payment } from '../models/Payment';
import { Donation } from '../models/Donation';
import { Transaction } from '../models/Transaction';
import { Attendance } from '../models/Attendance';
import { UserRole, PaymentType, PaymentStatus, AttendanceStatus } from '@mahallu/shared-types';

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
    name: 'Dashboard User',
    email: `dash${Date.now()}${Math.random()}@example.com`,
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

describe('GET /api/v1/dashboard/kpis', () => {
  it('combines Payment and Transaction sums for income/expense, and returns the other counts/sums', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const now = dayjs();

    await Family.create({ tenantId: tenant._id, familyCode: 'FAM-1', address: baseAddress });
    await Member.create({
      tenantId: tenant._id, memberId: 'MHL-1', name: 'M1', gender: 'male', phone: '+911', status: 'active',
    });
    await Student.create({
      tenantId: tenant._id, admissionNo: 'STD-1', memberId: objectId(), madrasaId: objectId(),
      classId: objectId(), guardianId: objectId(), status: 'active', feeBalance: 500,
    });
    await Teacher.create({
      tenantId: tenant._id, memberId: objectId(), madrasaId: objectId(), employeeId: 'EMP-1',
      qualification: 'X', salary: 1000, status: 'active',
    });
    await Payment.create({
      tenantId: tenant._id, paymentNo: 'PAY-1', type: PaymentType.SUBSCRIPTION, amount: 300,
      paidById: objectId(), gateway: 'cash', status: PaymentStatus.SUCCESS,
    });
    await Payment.create({
      tenantId: tenant._id, paymentNo: 'PAY-2', type: PaymentType.SALARY, amount: 200,
      paidById: objectId(), gateway: 'cash', status: PaymentStatus.SUCCESS,
    });
    await Payment.create({
      tenantId: tenant._id, paymentNo: 'PAY-3', type: PaymentType.ZAKAT, amount: 150,
      paidById: objectId(), gateway: 'cash', status: PaymentStatus.SUCCESS,
    });
    await Donation.create({ tenantId: tenant._id, amount: 400 });
    await Transaction.create({
      tenantId: tenant._id, type: 'INCOME', amount: 100, category: 'x', date: now.toDate(), description: 'x',
    });
    await Transaction.create({
      tenantId: tenant._id, type: 'EXPENSE', amount: 50, category: 'x', date: now.toDate(), description: 'x',
    });

    const res = await request(app).get('/api/v1/dashboard/kpis').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalFamilies: 1,
      totalMembers: 1,
      activeStudents: 1,
      activeTeachers: 1,
      // "income" payment types are [SUBSCRIPTION, DONATION, RENTAL, ZAKAT] per
      // the controller's own $in filter — the ZAKAT payment counts here too,
      // in addition to zakatCollected below (same underlying payment, two KPIs).
      monthlyIncome: 300 + 150 + 100, // SUBSCRIPTION + ZAKAT payments + Transaction INCOME
      monthlyExpenses: 200 + 50, // SALARY payment + Transaction EXPENSE
      pendingFees: 500,
      monthlyDonations: 400,
      zakatCollected: 150,
    });
  });

  it('returns zeros when nothing exists for the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get('/api/v1/dashboard/kpis').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalFamilies: 0,
      totalMembers: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      pendingFees: 0,
      monthlyDonations: 0,
      zakatCollected: 0,
    });
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/dashboard/kpis');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/dashboard/charts/income-expense', () => {
  it('merges Payment and Transaction aggregates by year/month/isExpense', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const now = dayjs();

    await Payment.create({
      tenantId: tenant._id, paymentNo: 'PAY-1', type: PaymentType.SUBSCRIPTION, amount: 300,
      paidById: objectId(), gateway: 'cash', status: PaymentStatus.SUCCESS, createdAt: now.toDate(),
    });
    await Transaction.create({
      tenantId: tenant._id, type: 'INCOME', amount: 150, category: 'x', date: now.toDate(), description: 'x',
    });

    const res = await request(app)
      .get('/api/v1/dashboard/charts/income-expense')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const bucket = res.body.data.find(
      (d: any) => d._id.year === now.year() && d._id.month === now.month() + 1 && d._id.isExpense === false,
    );
    expect(bucket).toBeDefined();
    expect(bucket.total).toBe(300 + 150);
  });
});

describe('GET /api/v1/dashboard/charts/attendance', () => {
  it('groups student attendance counts by date and status', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    await Attendance.create({
      tenantId: tenant._id, entityType: 'student', entityId: objectId(), date: new Date(),
      status: AttendanceStatus.PRESENT, markedById: objectId(),
    });
    await Attendance.create({
      tenantId: tenant._id, entityType: 'student', entityId: objectId(), date: new Date(),
      status: AttendanceStatus.ABSENT, markedById: objectId(),
    });

    const res = await request(app).get('/api/v1/dashboard/charts/attendance').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const total = res.body.data.reduce((sum: number, d: any) => sum + d.count, 0);
    expect(total).toBe(2);
  });
});

describe('GET /api/v1/dashboard/charts/member-growth', () => {
  it('groups member creation counts by year/month', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    await Member.create({
      tenantId: tenant._id, memberId: 'MHL-G1', name: 'G1', gender: 'male', phone: '+9111',
    });

    const res = await request(app).get('/api/v1/dashboard/charts/member-growth').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const total = res.body.data.reduce((sum: number, d: any) => sum + d.count, 0);
    expect(total).toBe(1);
  });
});

describe('GET /api/v1/dashboard/recent-activity', () => {
  it('returns up to 5 of the most recent members, payments, and donations', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    for (let i = 0; i < 3; i++) {
      await Member.create({
        tenantId: tenant._id, memberId: `MHL-R${i}`, name: `R${i}`, gender: 'male', phone: `+922${i}`,
      });
    }
    await Payment.create({
      tenantId: tenant._id, paymentNo: 'PAY-R1', type: PaymentType.DONATION, amount: 10,
      paidById: objectId(), gateway: 'cash', status: PaymentStatus.SUCCESS,
    });
    await Donation.create({ tenantId: tenant._id, amount: 20 });

    const res = await request(app).get('/api/v1/dashboard/recent-activity').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recentMembers).toHaveLength(3);
    expect(res.body.data.recentPayments).toHaveLength(1);
    expect(res.body.data.recentDonations).toHaveLength(1);
  });
});

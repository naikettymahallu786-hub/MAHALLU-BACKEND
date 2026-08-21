import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Payment } from '../models/Payment';
import { Member } from '../models/Member';
import { Family } from '../models/Family';
import { Student } from '../models/Student';
import { Transaction } from '../models/Transaction';
import { Nikah } from '../models/Nikah';
import { Certificate } from '../models/Certificate';
import { Event } from '../models/Event';
import { DeathRecord } from '../models/DeathRecord';
import { Zakat } from '../models/Zakat';

const app = createApp();
const baseAddress = { line1: 'X', city: 'Kochi', district: 'Ernakulam', pincode: '682001' };

describe('GET /api/v1/reports/financial', () => {
  // KNOWN PRE-EXISTING BUG (confirmed present on main, unrelated to this
  // migration — same root cause as attendance's /report bug found and
  // flagged earlier in this migration, and copied verbatim here). The
  // $match filter's tenantId is a plain string, but Mongoose's raw
  // .aggregate() pipelines don't auto-cast against the schema, so it never
  // matches the ObjectId values stored on Payment documents — this
  // endpoint has always returned an empty array. Same "flag only" choice
  // the user already made for the identical bug class; this test
  // documents the actual (always-empty) behavior.
  it('always returns an empty array — tenantId string never matches the stored ObjectId in a raw aggregate $match', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'M',
      gender: 'male',
      phone: '+919000000000',
    });
    await Payment.create({ tenantId: tenant._id, paymentNo: 'PAY-1', type: 'donation', amount: 100, paidById: member._id, gateway: 'cash', status: 'completed' });
    await Payment.create({ tenantId: tenant._id, paymentNo: 'PAY-2', type: 'donation', amount: 200, paidById: member._id, gateway: 'cash', status: 'completed' });

    const res = await request(app).get('/api/v1/reports/financial').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /api/v1/reports/export/financial', () => {
  it('returns a CSV with the expected headers and a data row', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Payer, Inc.',
      gender: 'male',
      phone: '+919000000000',
    });
    await Payment.create({ tenantId: tenant._id, paymentNo: 'PAY-1', type: 'donation', amount: 100, paidById: member._id, gateway: 'cash', status: 'completed' });

    const res = await request(app).get('/api/v1/reports/export/financial').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toBe('attachment; filename=financial_report.csv');
    const lines = res.text.split('\n');
    expect(lines[0]).toBe('Payment No,Date,Type,Amount,Gateway,Payment ID,Order ID,Status,Description,Paid For,Paid By');
    // Payer name contains a comma, so escapeCSVField must quote it.
    expect(lines[1]).toContain('"Payer, Inc."');
  });
});

describe('GET /api/v1/reports/export/members', () => {
  it('exports a member census CSV', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-1', address: baseAddress });
    await Member.create({
      tenantId: tenant._id,
      memberId: 'MHL-1',
      name: 'Alice',
      gender: 'female',
      phone: '+919000000001',
      familyId: family._id,
    });

    const res = await request(app).get('/api/v1/reports/export/members').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Alice,MHL-1,FAM-1');
  });
});

describe('GET /api/v1/reports/export/academic', () => {
  it('exports an academic progress CSV', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Student.create({
      tenantId: tenant._id,
      admissionNo: 'STD-1',
      memberId: objectId(),
      madrasaId: objectId(),
      classId: objectId(),
      guardianId: objectId(),
      name: 'Fallback Name',
    });

    const res = await request(app).get('/api/v1/reports/export/academic').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('STD-1');
  });
});

describe('GET /api/v1/reports/export/income-expense', () => {
  it('exports transactions as CSV', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Transaction.create({ tenantId: tenant._id, type: 'INCOME', amount: 500, category: 'Donation', date: new Date('2026-01-01'), description: 'Test' });

    const res = await request(app).get('/api/v1/reports/export/income-expense').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('INCOME,Donation,500,Test');
  });
});

describe('GET /api/v1/reports/export/nikah', () => {
  it('supports format=json returning the raw records', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Nikah.create({
      tenantId: tenant._id,
      nikahNo: 'NKH-1',
      brideName: 'B',
      brideFatherName: 'BF',
      groomName: 'G',
      groomFatherName: 'GF',
      imamId: objectId(),
      mehr: 5000,
      date: new Date('2026-05-01'),
    });

    const res = await request(app)
      .get('/api/v1/reports/export/nikah?format=json')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('filters by date range using computeDateRange', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Nikah.create({
      tenantId: tenant._id,
      nikahNo: 'NKH-1',
      brideName: 'B',
      brideFatherName: 'BF',
      groomName: 'G',
      groomFatherName: 'GF',
      imamId: objectId(),
      mehr: 5000,
      date: new Date('2025-01-01'),
    });
    await Nikah.create({
      tenantId: tenant._id,
      nikahNo: 'NKH-2',
      brideName: 'B2',
      brideFatherName: 'BF',
      groomName: 'G2',
      groomFatherName: 'GF',
      imamId: objectId(),
      mehr: 6000,
      date: new Date('2026-06-01'),
    });

    const res = await request(app)
      .get('/api/v1/reports/export/nikah?format=json&year=2026')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nikahNo).toBe('NKH-2');
  });
});

describe('GET /api/v1/reports/export/certificates', () => {
  it('filters by type and status', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Certificate.create({ tenantId: tenant._id, certificateNo: 'CERT-1', type: 'residence', recipientId: objectId(), issuedBy: objectId(), isRevoked: false });
    await Certificate.create({ tenantId: tenant._id, certificateNo: 'CERT-2', type: 'residence', recipientId: objectId(), issuedBy: objectId(), isRevoked: true });

    const res = await request(app)
      .get('/api/v1/reports/export/certificates?format=json&status=revoked')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].certificateNo).toBe('CERT-2');
  });
});

describe('GET /api/v1/reports/export/events', () => {
  it('exports events as CSV', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Event.create({ tenantId: tenant._id, title: 'Iftar', date: new Date('2026-05-01'), isPaid: false });

    const res = await request(app).get('/api/v1/reports/export/events').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Iftar');
    expect(res.text).toContain('Free');
  });
});

describe('GET /api/v1/reports/export/death', () => {
  it('exports death records as CSV with a default burial place', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await DeathRecord.create({ tenantId: tenant._id, memberId: objectId(), dateOfDeath: new Date('2026-01-01') });

    const res = await request(app).get('/api/v1/reports/export/death').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Mahallu Ground');
  });
});

describe('GET /api/v1/reports/export/zakat', () => {
  it('flattens applicants across years and filters by status/search', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await Member.create({
      tenantId: tenant._id,
      memberId: 'MHL-1',
      name: 'Zakat Applicant',
      gender: 'male',
      phone: '+919000000002',
    });
    await Zakat.create({
      tenantId: tenant._id,
      year: 2026,
      applicants: [
        { memberId: member._id, amountRequested: 1000, status: 'approved' },
        { memberId: objectId(), amountRequested: 500, status: 'pending' },
      ],
    });

    const res = await request(app)
      .get('/api/v1/reports/export/zakat?format=json&status=approved')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].memberName).toBe('Zakat Applicant');
  });
});

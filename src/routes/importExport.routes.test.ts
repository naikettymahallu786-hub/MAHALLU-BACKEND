// Verifies the import-export routes were split into their own router file
// without changing any URLs — same full paths as when they were nested
// inside member.routes.ts, and no collision with member.routes.ts's own
// `/:id` route now that they're separate routers.
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { Member } from '../models/Member';
import { ImportExportLog } from '../models/ImportExportLog';
import { UserRole } from "../types";

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

async function createAuthedUser(tenantId: mongoose.Types.ObjectId) {
  const user = await User.create({
    tenantId,
    name: 'IE Admin',
    email: `ieadmin${Date.now()}${Math.random()}@example.com`,
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

describe('import-export routes are reachable at their pre-split URLs', () => {
  it('GET /api/v1/members/import-export/history reaches ImportExportController.getHistory, not member routes', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await ImportExportLog.create({
      tenantId: tenant._id, type: 'IMPORT', entity: 'FAMILIES_MEMBERS', fileName: 'x.xlsx',
      status: 'COMPLETED', totalRecords: 1, successCount: 1, failedCount: 0, errorDetails: [], performedBy: 'Admin',
    });

    const res = await request(app).get('/api/v1/members/import-export/history').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /api/v1/members/:id (an actual member) still resolves via member.routes.ts, unaffected by the split', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await Member.create({
      tenantId: tenant._id, memberId: 'MHL-IE1', name: 'X', gender: 'male', phone: '+919000000009',
    });

    const res = await request(app).get(`/api/v1/members/${member._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(member._id.toString());
  });

  it('PUT /api/v1/members/import-export/history/:id/pause reaches ImportExportController.pauseJob', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const log = await ImportExportLog.create({
      tenantId: tenant._id, type: 'IMPORT', entity: 'FAMILIES_MEMBERS', fileName: 'x.xlsx',
      status: 'PROCESSING', totalRecords: 1, successCount: 0, failedCount: 0, errorDetails: [], performedBy: 'Admin',
    });

    const res = await request(app)
      .put(`/api/v1/members/import-export/history/${log._id}/pause`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAUSED');
  });
});

describe('PUT /api/v1/members/import-export/history/:id/resume', () => {
  it('sets status to PROCESSING', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const log = await ImportExportLog.create({
      tenantId: tenant._id, type: 'IMPORT', entity: 'FAMILIES_MEMBERS', fileName: 'x.xlsx',
      status: 'PAUSED', totalRecords: 1, successCount: 0, failedCount: 0, errorDetails: [], performedBy: 'Admin',
    });

    const res = await request(app)
      .put(`/api/v1/members/import-export/history/${log._id}/resume`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PROCESSING');
  });

  it('returns 404 when the log does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .put(`/api/v1/members/import-export/history/${new mongoose.Types.ObjectId()}/resume`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/members/import-export/history/:id/cancel', () => {
  it('sets status to CANCELLED', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const log = await ImportExportLog.create({
      tenantId: tenant._id, type: 'IMPORT', entity: 'FAMILIES_MEMBERS', fileName: 'x.xlsx',
      status: 'PROCESSING', totalRecords: 1, successCount: 0, failedCount: 0, errorDetails: [], performedBy: 'Admin',
    });

    const res = await request(app)
      .put(`/api/v1/members/import-export/history/${log._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });
});

describe('GET /api/v1/members/import-export/template', () => {
  it('returns a downloadable xlsx workbook', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .get('/api/v1/members/import-export/template')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('Demo_Import_Template_Families_Members.xlsx');
    // XLSX files are zip archives — first two bytes are the "PK" zip magic number
    expect((res.body as Buffer).slice(0, 2).toString()).toBe('PK');
  });
});

describe('GET /api/v1/members/import-export/export', () => {
  it('exports members/families as xlsx and logs an EXPORT record', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const { Family } = await import('../models/Family');
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-EXP', address: baseAddress });
    await Member.create({
      tenantId: tenant._id, memberId: 'MHL-EXP1', name: 'Export Me', gender: 'male', phone: '+919000000010',
      familyId: family._id,
    });

    const res = await request(app)
      .get('/api/v1/members/import-export/export')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect((res.body as Buffer).slice(0, 2).toString()).toBe('PK');

    const logs = await ImportExportLog.find({ tenantId: tenant._id, type: 'EXPORT' });
    expect(logs).toHaveLength(1);
    expect(logs[0].totalRecords).toBe(1);
  });
});

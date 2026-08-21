import request from 'supertest';
import { createApp } from '../../app';
import { createTenant, createAuthedUser, objectId, baseAddress } from '../../__tests__/helpers';
import { Member } from '../../models/Member';
import { Family } from '../../models/Family';
import { Class } from '../../models/Class';
import { Student } from '../../models/Student';
import { UserRole } from '@mahallu/shared-types';

const app = createApp();

async function makeHeadMember(tenantId: any) {
  return Member.create({
    tenantId,
    memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
    name: 'Family Head',
    gender: 'male',
    phone: `+9198${Math.floor(Math.random() * 1e8)}`,
  });
}

describe('mobile sadar role gating', () => {
  it('every endpoint returns 403 {success:false,message:"Sadar Mualim role required"} for a non-sadar user', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.STUDENT });

    const forbidden = { success: false, message: 'Sadar Mualim role required' };

    const r1 = await request(app).get('/api/v1/mobile/sadar/families').set('Authorization', `Bearer ${token}`);
    expect(r1.status).toBe(403);
    expect(r1.body).toEqual(forbidden);

    const r2 = await request(app).get(`/api/v1/mobile/sadar/families/${objectId()}/members`).set('Authorization', `Bearer ${token}`);
    expect(r2.status).toBe(403);
    expect(r2.body).toEqual(forbidden);

    const r3 = await request(app).get('/api/v1/mobile/sadar/classes').set('Authorization', `Bearer ${token}`);
    expect(r3.status).toBe(403);
    expect(r3.body).toEqual(forbidden);

    const r4 = await request(app).post('/api/v1/mobile/sadar/students').set('Authorization', `Bearer ${token}`).send({});
    expect(r4.status).toBe(403);
    expect(r4.body).toEqual(forbidden);
  });
});

describe('GET /api/v1/mobile/sadar/families', () => {
  it('lists families with headName derived from headMemberId', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SADAR_MUALIM });
    const head = await makeHeadMember(tenant._id);
    await Family.create({ tenantId: tenant._id, familyCode: 'FAM-1', address: baseAddress, headMemberId: head._id, members: [] });
    await Family.create({ tenantId: tenant._id, familyCode: 'FAM-2', address: baseAddress, members: [] });

    const res = await request(app).get('/api/v1/mobile/sadar/families').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const fam1 = res.body.data.find((f: any) => f.familyCode === 'FAM-1');
    const fam2 = res.body.data.find((f: any) => f.familyCode === 'FAM-2');
    expect(fam1.headName).toBe('Family Head');
    expect(fam2.headName).toBe('Unknown');
  });
});

describe('GET /api/v1/mobile/sadar/families/:familyId/members', () => {
  it('flags members already enrolled as students with their class name', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SADAR_MUALIM });
    const head = await makeHeadMember(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-3', address: baseAddress, headMemberId: head._id, members: [] });

    const childMember = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Child',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
      familyId: family._id,
    });
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'Class X', academicYear: '2026' });
    await Student.create({
      tenantId: tenant._id,
      memberId: childMember._id,
      classId: klass._id,
      guardianId: head._id,
      admissionNo: 'ADM-1',
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'active',
      familyId: family._id,
    });

    const res = await request(app)
      .get(`/api/v1/mobile/sadar/families/${family._id}/members`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const entry = res.body.data.find((m: any) => m._id === childMember._id.toString());
    expect(entry.isEnrolledStudent).toBe(true);
    expect(entry.enrolledClassName).toBe('Class X');
  });
});

describe('GET /api/v1/mobile/sadar/classes', () => {
  it('lists all classes for the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SADAR_MUALIM });
    await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'A', academicYear: '2026' });
    await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'B', academicYear: '2026' });

    const res = await request(app).get('/api/v1/mobile/sadar/classes').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('POST /api/v1/mobile/sadar/students', () => {
  it('requires familyId and classId', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SADAR_MUALIM });
    const res = await request(app).post('/api/v1/mobile/sadar/students').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Family and Class selection are required' });
  });

  it('returns 404 for an unknown family', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SADAR_MUALIM });
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'C', academicYear: '2026' });
    const res = await request(app)
      .post('/api/v1/mobile/sadar/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ familyId: objectId().toString(), classId: klass._id.toString() });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Family not found');
  });

  it('returns 404 for an unknown class', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SADAR_MUALIM });
    const head = await makeHeadMember(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-4', address: baseAddress, headMemberId: head._id, members: [] });
    const res = await request(app)
      .post('/api/v1/mobile/sadar/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ familyId: family._id.toString(), classId: objectId().toString() });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Class not found');
  });

  it('creates a new child Member + Student when no memberId is given, and registers it in the class', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SADAR_MUALIM });
    const head = await makeHeadMember(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-5', address: baseAddress, headMemberId: head._id, members: [] });
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'D', academicYear: '2026' });

    const res = await request(app)
      .post('/api/v1/mobile/sadar/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ familyId: family._id.toString(), classId: klass._id.toString(), name: 'New Kid', relationship: 'Child', gender: 'male' });

    expect(res.status).toBe(201);
    expect(res.body.data.classId.toString()).toBe(klass._id.toString());

    const updatedFamily = await Family.findById(family._id);
    expect(updatedFamily!.members).toHaveLength(1);

    const updatedClass = await Class.findById(klass._id);
    expect(updatedClass!.students.map((s) => s.toString())).toContain(res.body.data._id.toString());
  });

  it('requires a name when memberId is not provided', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SADAR_MUALIM });
    const head = await makeHeadMember(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-6', address: baseAddress, headMemberId: head._id, members: [] });
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'E', academicYear: '2026' });

    const res = await request(app)
      .post('/api/v1/mobile/sadar/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ familyId: family._id.toString(), classId: klass._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Please select a child or enter a child name');
  });

  it('re-enrolls an existing Student when memberId is given for an already-registered member', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.SADAR_MUALIM });
    const head = await makeHeadMember(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-7', address: baseAddress, headMemberId: head._id, members: [] });
    const oldClass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'Old', academicYear: '2026' });
    const newClass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'New', academicYear: '2026' });

    const childMember = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Existing Kid',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
      familyId: family._id,
    });
    const existingStudent = await Student.create({
      tenantId: tenant._id,
      memberId: childMember._id,
      classId: oldClass._id,
      guardianId: head._id,
      admissionNo: 'ADM-OLD',
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'promoted',
      familyId: family._id,
    });

    const res = await request(app)
      .post('/api/v1/mobile/sadar/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ familyId: family._id.toString(), classId: newClass._id.toString(), memberId: childMember._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.data._id.toString()).toBe(existingStudent._id.toString());
    expect(res.body.data.classId.toString()).toBe(newClass._id.toString());
    expect(res.body.data.status).toBe('active');
  });
});

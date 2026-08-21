import request from 'supertest';
import axios from 'axios';
import { createApp } from '../../app';
import { createTenant, createAuthedUser, objectId, baseAddress } from '../../__tests__/helpers';
import { Member } from '../../models/Member';
import { Family } from '../../models/Family';
import { Payment } from '../../models/Payment';
import { Donation } from '../../models/Donation';
import { Notification } from '../../models/Notification';
import { Student } from '../../models/Student';
import { Class } from '../../models/Class';
import { Attendance } from '../../models/Attendance';
import { Homework } from '../../models/Homework';
import { Exam } from '../../models/Exam';
import { Event } from '../../models/Event';
import { Teacher } from '../../models/Teacher';
import { Certificate } from '../../models/Certificate';
import { CertificateRequest } from '../../models/CertificateRequest';
import { Property } from '../../models/Property';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const app = createApp();

async function makeMemberUser(tenantId: any, overrides: Record<string, unknown> = {}) {
  const member = await Member.create({
    tenantId,
    memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
    name: 'Test Member',
    gender: 'male',
    phone: `+9198${Math.floor(Math.random() * 1e8)}`,
  });
  const { user, token } = await createAuthedUser(tenantId, { memberId: member._id, ...overrides });
  return { member, user, token };
}

describe('GET /api/v1/mobile/me/profile', () => {
  it('returns user + member + family + tenant', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-P1', address: baseAddress, headMemberId: member._id, members: [] });
    await Member.updateOne({ _id: member._id }, { $set: { familyId: family._id } });

    const res = await request(app).get('/api/v1/mobile/me/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user._id).toBeDefined();
    expect(res.body.data.member._id).toBe(member._id.toString());
    expect(res.body.data.family.familyCode).toBe('FAM-P1');
    expect(res.body.data.tenant.name).toBeDefined();
  });
});

describe('GET/PUT /api/v1/mobile/me/family', () => {
  it('GET returns null when the caller has no memberId', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const res = await request(app).get('/api/v1/mobile/me/family').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('PUT throws 404 when member has no family, and updates recurring donation fields on success', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);

    const noFamilyRes = await request(app)
      .put('/api/v1/mobile/me/family')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardNo: '3' });
    expect(noFamilyRes.status).toBe(404);
    expect(noFamilyRes.body.message).toBe('Family not found');

    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-P2', address: baseAddress, headMemberId: member._id, members: [] });
    await Member.updateOne({ _id: member._id }, { $set: { familyId: family._id } });

    const res = await request(app)
      .put('/api/v1/mobile/me/family')
      .set('Authorization', `Bearer ${token}`)
      .send({ wardNo: '5', recurringDonationType: 'monthly', recurringPaymentDay: 10, recurringPaymentMonth: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.wardNo).toBe('5');
    expect(res.body.data.nextPaymentDueDate).toBeTruthy();
  });
});

describe('PUT /api/v1/mobile/me/members/:memberId', () => {
  it('rejects updating a member outside the caller family with 403', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-P3', address: baseAddress, headMemberId: member._id, members: [] });
    await Member.updateOne({ _id: member._id }, { $set: { familyId: family._id } });

    const stranger = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Stranger',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
    });

    const res = await request(app)
      .put(`/api/v1/mobile/me/members/${stranger._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('updates a family member and syncs the linked User name/phone', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-P4', address: baseAddress, headMemberId: member._id, members: [] });
    await Member.updateOne({ _id: member._id }, { $set: { familyId: family._id } });

    const childMember = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Child Old Name',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
      familyId: family._id,
    });
    const { user: childUser } = await createAuthedUser(tenant._id, { memberId: childMember._id });
    await Member.updateOne({ _id: childMember._id }, { $set: { userId: childUser._id } });

    const res = await request(app)
      .put(`/api/v1/mobile/me/members/${childMember._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Child New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Child New Name');

    const { User } = await import('../../models/User');
    const updatedUser = await User.findById(childUser._id);
    expect(updatedUser!.name).toBe('Child New Name');
  });
});

describe('GET /api/v1/mobile/me/payments', () => {
  it('returns [] with page:1 pagination when caller has no memberId', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const res = await request(app).get('/api/v1/mobile/me/payments').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it('returns the members own payment history', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    await Payment.create({ tenantId: tenant._id, paymentNo: 'PAY-1', type: 'donation', amount: 10, paidById: member._id, gateway: 'cash', status: 'completed' });

    const res = await request(app).get('/api/v1/mobile/me/payments').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/mobile/me/donations', () => {
  it('returns the members own donations', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    await Donation.create({ tenantId: tenant._id, donorId: member._id, amount: 50, campaign: 'General', status: 'paid' });

    const res = await request(app).get('/api/v1/mobile/me/donations').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/mobile/me/notifications', () => {
  it('returns notifications addressed to the caller plus broadcasts', async () => {
    const tenant = await createTenant();
    const { user, token } = await makeMemberUser(tenant._id);
    await Notification.create({ tenantId: tenant._id, channel: 'in_app', recipientId: user._id, title: 'Direct', body: 'Hi', status: 'sent' });
    await Notification.create({ tenantId: tenant._id, channel: 'in_app', title: 'Broadcast', body: 'All', status: 'sent' });

    const res = await request(app).get('/api/v1/mobile/me/notifications').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('GET /api/v1/mobile/me/dues', () => {
  it('returns pending donation dues for the family', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    const family = await Family.create({ tenantId: tenant._id, familyCode: 'FAM-P5', address: baseAddress, headMemberId: member._id, members: [] });
    await Member.updateOne({ _id: member._id }, { $set: { familyId: family._id } });
    await Donation.create({ tenantId: tenant._id, familyId: family._id, amount: 100, campaign: 'Dues', status: 'pending' });
    await Donation.create({ tenantId: tenant._id, familyId: family._id, amount: 100, campaign: 'Dues', status: 'paid' });

    const res = await request(app).get('/api/v1/mobile/me/dues').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('mobile me/student portal', () => {
  it('GET /me/student enriches classId.schedule from a directly-assigned Teacher (schedule IS selected here)', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    const student = await Student.create({
      tenantId: tenant._id,
      memberId: member._id,
      classId: objectId(), // deliberately a non-existent Class so populate() resolves it to null
      guardianId: objectId(),
      admissionNo: 'ADM-S1',
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'active',
    });

    const teacherMember = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Direct Teacher',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
    });
    await Teacher.create({
      tenantId: tenant._id,
      memberId: teacherMember._id,
      madrasaId: objectId(),
      employeeId: `EMP-${Math.floor(Math.random() * 1e8)}`,
      qualification: 'Aalim',
      salary: 1000,
      assignedStudents: [student._id],
      schedule: [{ day: 'Mon', startTime: '10:00', endTime: '11:00', subject: 'Fiqh' }],
    });

    const res = await request(app).get('/api/v1/mobile/me/student').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.classId.schedule).toHaveLength(1);
    expect(res.body.data.classId.name).toBe('Directly Assigned');
  });

  it('GET /me/student/attendance filters to the given month/year', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    const student = await Student.create({
      tenantId: tenant._id,
      memberId: member._id,
      classId: objectId(),
      guardianId: objectId(),
      admissionNo: 'ADM-S2',
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'active',
    });
    await Attendance.create({ tenantId: tenant._id, entityType: 'student', entityId: student._id, classId: objectId(), date: new Date('2026-03-15'), status: 'present', markedById: objectId() });
    await Attendance.create({ tenantId: tenant._id, entityType: 'student', entityId: student._id, classId: objectId(), date: new Date('2026-04-15'), status: 'present', markedById: objectId() });

    const res = await request(app)
      .get('/api/v1/mobile/me/student/attendance?month=3&year=2026')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /me/student/homework attaches mySubmission', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'X', academicYear: '2026' });
    const student = await Student.create({
      tenantId: tenant._id,
      memberId: member._id,
      classId: klass._id,
      guardianId: objectId(),
      admissionNo: 'ADM-S3',
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'active',
    });
    await Homework.create({
      tenantId: tenant._id,
      classId: klass._id,
      teacherId: objectId(),
      subject: 'Fiqh',
      title: 'HW1',
      dueDate: new Date(),
      submissions: [{ studentId: student._id, grade: 90 }],
    });

    const res = await request(app).get('/api/v1/mobile/me/student/homework').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].mySubmission.grade).toBe(90);
  });

  it('GET /me/student/exams strips results down to myResult', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'Y', academicYear: '2026' });
    const student = await Student.create({
      tenantId: tenant._id,
      memberId: member._id,
      classId: klass._id,
      guardianId: objectId(),
      admissionNo: 'ADM-S4',
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'active',
    });
    await Exam.create({
      tenantId: tenant._id,
      madrasaId: objectId(),
      classId: klass._id,
      title: 'Midterm',
      date: new Date(),
      totalMarks: 100,
      passMark: 40,
      isPublished: true,
      results: [{ studentId: student._id, marks: [{ subject: 'Fiqh', marksObtained: 85, totalMarks: 100 }], totalObtained: 85 }],
    });

    const res = await request(app).get('/api/v1/mobile/me/student/exams').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].myResult.totalObtained).toBe(85);
    expect(res.body.data[0].results).toBeUndefined();
  });
});

describe('GET /api/v1/mobile/me/children', () => {
  it('enriches each child with attendancePercent and pendingHomework', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'Z', academicYear: '2026' });
    const childMember = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Kid',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
    });
    const child = await Student.create({
      tenantId: tenant._id,
      memberId: childMember._id,
      classId: klass._id,
      guardianId: member._id,
      admissionNo: 'ADM-C1',
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'active',
    });
    const recentDate = new Date();
    await Attendance.create({ tenantId: tenant._id, entityType: 'student', entityId: child._id, classId: klass._id, date: recentDate, status: 'present', markedById: objectId() });

    const res = await request(app).get('/api/v1/mobile/me/children').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].attendancePercent).toBe(100);
  });
});

describe('GET /api/v1/mobile/events', () => {
  it('returns upcoming events by default and cleans the description', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const future = new Date();
    future.setDate(future.getDate() + 5);
    await Event.create({
      tenantId: tenant._id,
      title: 'Eid Gathering',
      description: '**bold** announcement',
      date: future,
    });

    const res = await request(app).get('/api/v1/mobile/events').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].description).not.toContain('*');
  });
});

describe('GET /api/v1/mobile/announcements', () => {
  it('returns sent/delivered broadcast notifications only', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Notification.create({ tenantId: tenant._id, channel: 'push', title: 'Sent', body: 'x', status: 'sent' });
    await Notification.create({ tenantId: tenant._id, channel: 'push', title: 'Pending', body: 'x', status: 'pending' });

    const res = await request(app).get('/api/v1/mobile/announcements').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Sent');
  });
});

describe('GET /api/v1/mobile/prayer-times', () => {
  it('falls back to an empty-but-200 response when the upstream API is unreachable', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('network down'));
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get('/api/v1/mobile/prayer-times').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.timings).toEqual({});
    expect(res.body.message).toBe('Prayer times unavailable');
  });

  it('returns real timings plus iqamah times from Settings on success', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { data: { timings: { Fajr: '05:00' } } } });
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const { Settings } = await import('../../models/Settings');
    await Settings.create({ tenantId: tenant._id, iqamahTimes: { Fajr: '05:15' } });

    const res = await request(app).get('/api/v1/mobile/prayer-times').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.timings.Fajr).toBe('05:00');
    expect(res.body.data.iqamahTimes.Fajr).toBe('05:15');
  });
});

describe('GET /api/v1/mobile/teachers', () => {
  it('lists active teachers', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const teacherMember = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'T1',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
    });
    await Teacher.create({
      tenantId: tenant._id,
      memberId: teacherMember._id,
      madrasaId: objectId(),
      employeeId: `EMP-${Math.floor(Math.random() * 1e8)}`,
      qualification: 'Aalim',
      salary: 1000,
      status: 'active',
    });

    const res = await request(app).get('/api/v1/mobile/teachers').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('mobile certificates', () => {
  it('GET requires a member profile', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const res = await request(app).get('/api/v1/mobile/certificates').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('POST validates type/purpose and creates a request', async () => {
    const tenant = await createTenant();
    const { token } = await makeMemberUser(tenant._id);

    const badRes = await request(app).post('/api/v1/mobile/certificates/request').set('Authorization', `Bearer ${token}`).send({});
    expect(badRes.status).toBe(400);

    const res = await request(app)
      .post('/api/v1/mobile/certificates/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'membership', purpose: 'Bank KYC' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
  });

  it('GET returns both requests and directly-issued certificates', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    await CertificateRequest.create({ tenantId: tenant._id, requestedBy: member._id, type: 'membership', purpose: 'x', status: 'PENDING' });
    await Certificate.create({ tenantId: tenant._id, certificateNo: 'C-1', type: 'membership', recipientId: member._id, issuedBy: objectId() });

    const res = await request(app).get('/api/v1/mobile/certificates').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.requests).toHaveLength(1);
    expect(res.body.data.issuedCerts).toHaveLength(1);
  });
});

describe('mobile properties', () => {
  it('GET requires a member profile', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const res = await request(app).get('/api/v1/mobile/properties').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('POST validates propertyId/quantityRequested and creates a rental request', async () => {
    const tenant = await createTenant();
    const { token } = await makeMemberUser(tenant._id);
    const property = await Property.create({ tenantId: tenant._id, propertyCode: 'P-1', type: 'equipment', name: 'Chairs' });

    const badRes = await request(app).post('/api/v1/mobile/properties/request').set('Authorization', `Bearer ${token}`).send({});
    expect(badRes.status).toBe(400);

    const res = await request(app)
      .post('/api/v1/mobile/properties/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ propertyId: property._id.toString(), quantityRequested: 5, purpose: 'Event' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
  });
});

describe('GET /api/v1/mobile/member/family-students', () => {
  it('requires a member profile', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const res = await request(app).get('/api/v1/mobile/member/family-students').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('aggregates attendance/homework/exam/notice data for every enrolled family student', async () => {
    const tenant = await createTenant();
    const { member, token } = await makeMemberUser(tenant._id);
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'FS', academicYear: '2026' });
    const family = await Family.create({
      tenantId: tenant._id,
      familyCode: 'FAM-FS',
      address: baseAddress,
      headMemberId: member._id,
      members: [{ memberId: member._id, relationship: 'Self', isHead: true }],
    });
    await Member.updateOne({ _id: member._id }, { $set: { familyId: family._id } });

    const student = await Student.create({
      tenantId: tenant._id,
      memberId: member._id,
      classId: klass._id,
      guardianId: member._id,
      admissionNo: 'ADM-FS1',
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'active',
    });
    await Attendance.create({ tenantId: tenant._id, entityType: 'student', entityId: student._id, classId: klass._id, date: new Date(), status: 'present', markedById: objectId() });

    const res = await request(app).get('/api/v1/mobile/member/family-students').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].attendance.total).toBe(1);
    expect(res.body.data[0].attendance.percentage).toBe(100);
  });
});

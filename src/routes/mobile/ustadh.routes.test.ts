import request from 'supertest';
import { createApp } from '../../app';
import { createTenant, createAuthedUser, objectId } from '../../__tests__/helpers';
import { Member } from '../../models/Member';
import { Teacher } from '../../models/Teacher';
import { Class } from '../../models/Class';
import { Student } from '../../models/Student';
import { Homework } from '../../models/Homework';
import { Exam } from '../../models/Exam';
import { Attendance } from '../../models/Attendance';
import { Notification } from '../../models/Notification';
import { UserRole } from '@mahallu/shared-types';

const app = createApp();

async function makeUstadh(tenantId: any) {
  const member = await Member.create({
    tenantId,
    memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
    name: 'Ustadh One',
    gender: 'male',
    phone: `+9198${Math.floor(Math.random() * 1e8)}`,
  });
  const { user, token } = await createAuthedUser(tenantId, { role: UserRole.USTADH, memberId: member._id });
  const teacher = await Teacher.create({
    tenantId,
    memberId: member._id,
    madrasaId: objectId(),
    employeeId: `EMP-${Math.floor(Math.random() * 1e8)}`,
    qualification: 'Aalim',
    salary: 10000,
  });
  return { member, user, token, teacher };
}

describe('GET /api/v1/mobile/me/ustadh/classes', () => {
  it('returns [] for a non-ustadh user', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.STUDENT });
    const res = await request(app).get('/api/v1/mobile/me/ustadh/classes').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns [] when the ustadh has no Teacher profile', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.USTADH, memberId: objectId() });
    const res = await request(app).get('/api/v1/mobile/me/ustadh/classes').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns the teacher's classes with students grouped in, and never surfaces assignedStudents as a direct-assigned pseudo-class", async () => {
    const tenant = await createTenant();
    const { token, teacher } = await makeUstadh(tenant._id);

    const klass = await Class.create({
      tenantId: tenant._id,
      madrasaId: objectId(),
      name: 'Class A',
      teacherId: teacher._id,
      academicYear: '2026',
    });

    const studentMember = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Kid One',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
    });
    await Student.create({
      tenantId: tenant._id,
      memberId: studentMember._id,
      classId: klass._id,
      guardianId: objectId(),
      admissionNo: `ADM-1`,
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'active',
    });

    // assignedStudents set directly on the Teacher doc — should NOT appear,
    // because the repository looks up the teacher with .select('_id') only.
    const directMember = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Direct Kid',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
    });
    const directStudent = await Student.create({
      tenantId: tenant._id,
      memberId: directMember._id,
      classId: objectId(),
      guardianId: objectId(),
      admissionNo: `ADM-2`,
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'active',
    });
    await Teacher.updateOne({ _id: teacher._id }, { $set: { assignedStudents: [directStudent._id] } });

    const res = await request(app).get('/api/v1/mobile/me/ustadh/classes').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Class A');
    expect(res.body.data[0].students).toHaveLength(1);
    expect(res.body.data.find((c: any) => c._id === 'direct-assigned')).toBeUndefined();
  });
});

describe('PUT /api/v1/mobile/me/ustadh/classes/:id/timetable', () => {
  it('returns {error} (not {success:false,message}) for a non-array schedule', async () => {
    const tenant = await createTenant();
    const { token } = await makeUstadh(tenant._id);
    const res = await request(app)
      .put('/api/v1/mobile/me/ustadh/classes/some-id/timetable')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: 'not-an-array' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Schedule must be an array' });
  });

  it('returns 403 {error:"Unauthorized"} for a non-ustadh user', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.STUDENT });
    const res = await request(app)
      .put('/api/v1/mobile/me/ustadh/classes/some-id/timetable')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: [] });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('updates the Teacher schedule directly for the direct-assigned pseudo id', async () => {
    const tenant = await createTenant();
    const { token, teacher } = await makeUstadh(tenant._id);
    const schedule = [{ day: 'Mon', startTime: '10:00', endTime: '11:00', subject: 'Fiqh' }];

    const res = await request(app)
      .put('/api/v1/mobile/me/ustadh/classes/direct-assigned/timetable')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule });

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe('direct-assigned');
    const updated = await Teacher.findById(teacher._id).lean();
    expect((updated as any)!.schedule).toHaveLength(1);
  });

  it('returns 404 {error} for a class the teacher does not own', async () => {
    const tenant = await createTenant();
    const { token } = await makeUstadh(tenant._id);
    const res = await request(app)
      .put(`/api/v1/mobile/me/ustadh/classes/${objectId()}/timetable`)
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: [] });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Class not found' });
  });

  it('updates a real class schedule', async () => {
    const tenant = await createTenant();
    const { token, teacher } = await makeUstadh(tenant._id);
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'B', teacherId: teacher._id, academicYear: '2026' });
    const schedule = [{ day: 'Tue', startTime: '09:00', endTime: '10:00', subject: 'Tajweed' }];

    const res = await request(app)
      .put(`/api/v1/mobile/me/ustadh/classes/${klass._id}/timetable`)
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule });

    expect(res.status).toBe(200);
    expect(res.body.data.schedule).toHaveLength(1);
  });
});

describe('POST /api/v1/mobile/me/ustadh/attendance', () => {
  it('rejects non-ustadh with {success:false,message} shape (different from the timetable route)', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id, { role: UserRole.STUDENT });
    const res = await request(app).post('/api/v1/mobile/me/ustadh/attendance').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Unauthorized' });
  });

  it('rejects invalid data', async () => {
    const tenant = await createTenant();
    const { token } = await makeUstadh(tenant._id);
    const res = await request(app)
      .post('/api/v1/mobile/me/ustadh/attendance')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: objectId().toString() });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Invalid data' });
  });

  it('upserts attendance records via bulkWrite', async () => {
    const tenant = await createTenant();
    const { token } = await makeUstadh(tenant._id);
    const classId = objectId().toString();
    const studentId = objectId().toString();

    const res = await request(app)
      .post('/api/v1/mobile/me/ustadh/attendance')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId, date: '2026-08-20', records: [{ studentId, status: 'present' }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Attendance marked successfully' });
    const record = await Attendance.findOne({ tenantId: tenant._id, entityId: studentId });
    expect(record).not.toBeNull();
    expect(record!.status).toBe('present');
  });
});

describe('POST /api/v1/mobile/me/ustadh/notify', () => {
  it('sends in-app notifications to guardians of the target students', async () => {
    const tenant = await createTenant();
    const { token, teacher } = await makeUstadh(tenant._id);

    const guardianMember = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Guardian',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
    });
    const { user: guardianUser } = await createAuthedUser(tenant._id, { memberId: guardianMember._id });

    const studentMember = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Kid',
      gender: 'male',
      phone: `+9198${Math.floor(Math.random() * 1e8)}`,
    });
    const klass = await Class.create({
      tenantId: tenant._id,
      madrasaId: objectId(),
      name: 'C',
      teacherId: teacher._id,
      academicYear: '2026',
      students: [],
    });
    const student = await Student.create({
      tenantId: tenant._id,
      memberId: studentMember._id,
      classId: klass._id,
      guardianId: guardianMember._id,
      admissionNo: 'ADM-3',
      admissionDate: new Date(),
      madrasaId: objectId(),
      status: 'active',
    });
    await Class.updateOne({ _id: klass._id }, { $set: { students: [student._id] } });

    const res = await request(app)
      .post('/api/v1/mobile/me/ustadh/notify')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: klass._id.toString(), title: 'Reminder', message: 'Bring books' });

    expect(res.status).toBe(200);
    const notif = await Notification.findOne({ recipientId: guardianUser._id });
    expect(notif).not.toBeNull();
    expect(notif!.title).toBe('[C] Reminder');
  });

  it('returns 404 for an unknown class', async () => {
    const tenant = await createTenant();
    const { token } = await makeUstadh(tenant._id);
    const res = await request(app)
      .post('/api/v1/mobile/me/ustadh/notify')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: objectId().toString(), title: 'X', message: 'Y' });
    expect(res.status).toBe(404);
  });
});

describe('mobile ustadh homework', () => {
  it('GET returns [] with no teacher profile, POST creates homework, GET then returns it', async () => {
    const tenant = await createTenant();
    const { token, teacher } = await makeUstadh(tenant._id);
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'D', teacherId: teacher._id, academicYear: '2026' });

    const createRes = await request(app)
      .post('/api/v1/mobile/me/ustadh/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: klass._id.toString(), subject: 'Arabic', title: 'Ex 1', dueDate: '2026-09-01' });
    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);

    const listRes = await request(app).get('/api/v1/mobile/me/ustadh/homework').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.data).toHaveLength(1);
  });

  it('grades a homework submission', async () => {
    const tenant = await createTenant();
    const { token, teacher } = await makeUstadh(tenant._id);
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'E', teacherId: teacher._id, academicYear: '2026' });
    const homework = await Homework.create({
      tenantId: tenant._id,
      classId: klass._id,
      teacherId: teacher._id,
      subject: 'Fiqh',
      title: 'HW',
      dueDate: new Date(),
      submissions: [],
    });
    const studentId = objectId().toString();

    const res = await request(app)
      .put(`/api/v1/mobile/me/ustadh/homework/${homework._id}/grade`)
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId, grade: 90 });

    expect(res.status).toBe(200);
    const updated = await Homework.findById(homework._id);
    expect(updated!.submissions).toHaveLength(1);
    expect((updated!.submissions[0] as any).grade).toBe(90);
  });
});

describe('mobile ustadh exams', () => {
  it('creates an exam and lists it for the assigned classes', async () => {
    const tenant = await createTenant();
    const { token, teacher } = await makeUstadh(tenant._id);
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'F', teacherId: teacher._id, academicYear: '2026' });

    const createRes = await request(app)
      .post('/api/v1/mobile/me/ustadh/exams')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: klass._id.toString(), title: 'Midterm', subjects: ['Fiqh'], date: '2026-09-10', totalMarks: 100, passMark: 40 });
    expect(createRes.status).toBe(200);

    const listRes = await request(app).get('/api/v1/mobile/me/ustadh/exams').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.data).toHaveLength(1);
  });

  it('saves exam results for a student', async () => {
    const tenant = await createTenant();
    const { token, teacher } = await makeUstadh(tenant._id);
    const klass = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'G', teacherId: teacher._id, academicYear: '2026' });
    const exam = await Exam.create({
      tenantId: tenant._id,
      madrasaId: objectId(),
      classId: klass._id,
      title: 'Final',
      date: new Date(),
      totalMarks: 100,
      passMark: 40,
      results: [],
    });
    const studentId = objectId().toString();

    const res = await request(app)
      .put(`/api/v1/mobile/me/ustadh/exams/${exam._id}/results`)
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId, marks: { Fiqh: 80 }, totalObtained: 80, percentage: 80, grade: 'A', isPassed: true });

    expect(res.status).toBe(200);
    const updated = await Exam.findById(exam._id);
    expect(updated!.results).toHaveLength(1);
  });
});

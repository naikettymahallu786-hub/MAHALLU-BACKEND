import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Attendance } from '../models/Attendance';
import { Student } from '../models/Student';

const app = createApp();

describe('POST /api/v1/attendance/bulk', () => {
  it('upserts attendance records via bulkWrite', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const classId = objectId();
    const studentId = objectId();

    const res = await request(app)
      .post('/api/v1/attendance/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        classId: classId.toString(),
        date: '2026-05-01',
        entityType: 'student',
        records: [{ entityId: studentId.toString(), status: 'present' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('1 attendance records saved');

    const record = await Attendance.findOne({ tenantId: tenant._id, entityId: studentId });
    expect(record).not.toBeNull();
    expect(record!.status).toBe('present');
  });

  it('updates an existing record on the same entity/date instead of duplicating it', async () => {
    const tenant = await createTenant();
    const { token, user } = await createAuthedUser(tenant._id);
    const classId = objectId();
    const studentId = objectId();
    const date = new Date('2026-05-01');
    await Attendance.create({
      tenantId: tenant._id,
      entityType: 'student',
      entityId: studentId,
      classId,
      date,
      status: 'absent',
      markedById: user._id,
    });

    await request(app)
      .post('/api/v1/attendance/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        classId: classId.toString(),
        date: '2026-05-01',
        entityType: 'student',
        records: [{ entityId: studentId.toString(), status: 'present' }],
      });

    const records = await Attendance.find({ tenantId: tenant._id, entityId: studentId });
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('present');
  });
});

describe('GET /api/v1/attendance/class/:classId', () => {
  it('defaults unsaved students to "present" and marks saved ones from the actual record', async () => {
    const tenant = await createTenant();
    const { token, user } = await createAuthedUser(tenant._id);
    const classId = objectId();
    const student1 = await Student.create({
      tenantId: tenant._id,
      admissionNo: 'STD-1',
      memberId: objectId(),
      madrasaId: objectId(),
      classId,
      guardianId: objectId(),
      status: 'active',
    });
    const student2 = await Student.create({
      tenantId: tenant._id,
      admissionNo: 'STD-2',
      memberId: objectId(),
      madrasaId: objectId(),
      classId,
      guardianId: objectId(),
      status: 'active',
    });
    const queryDate = new Date('2026-05-01');
    queryDate.setHours(0, 0, 0, 0);
    await Attendance.create({
      tenantId: tenant._id,
      entityType: 'student',
      entityId: student1._id,
      classId,
      date: queryDate,
      status: 'absent',
      markedById: user._id,
    });

    const res = await request(app)
      .get(`/api/v1/attendance/class/${classId}?date=2026-05-01`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.data.map((d: any) => [d.entityId._id, d]));
    expect(byId[student1._id.toString()].status).toBe('absent');
    expect(byId[student1._id.toString()].isSaved).toBe(true);
    expect(byId[student2._id.toString()].status).toBe('present');
    expect(byId[student2._id.toString()].isSaved).toBe(false);
  });
});

describe('GET /api/v1/attendance/class/:classId/monthly', () => {
  it('returns students and records for the given month', async () => {
    const tenant = await createTenant();
    const { token, user } = await createAuthedUser(tenant._id);
    const classId = objectId();
    const student = await Student.create({
      tenantId: tenant._id,
      admissionNo: 'STD-3',
      memberId: objectId(),
      madrasaId: objectId(),
      classId,
      guardianId: objectId(),
      status: 'active',
    });
    await Attendance.create({
      tenantId: tenant._id,
      entityType: 'student',
      entityId: student._id,
      classId,
      date: new Date('2026-05-15'),
      status: 'present',
      markedById: user._id,
    });

    const res = await request(app)
      .get(`/api/v1/attendance/class/${classId}/monthly?year=2026&month=5`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.students).toHaveLength(1);
    expect(res.body.data.records).toHaveLength(1);
  });
});

describe('GET /api/v1/attendance/report', () => {
  // KNOWN PRE-EXISTING BUG (confirmed present on main, unrelated to this
  // migration — the filter/aggregate construction is copied verbatim).
  // The $match filter's tenantId is a plain string (from req.user.tenantId),
  // but Mongoose's raw .aggregate() pipelines — unlike .find() — do not
  // auto-cast query values against the schema. Attendance documents store
  // tenantId as an ObjectId, so this string never matches and the endpoint
  // always returns an empty array, regardless of how much attendance data
  // actually exists. Verified empirically (0 matches with a string filter,
  // 1 match with an explicit ObjectId cast, same underlying data). User has
  // chosen to leave this as-is for now; this test documents the actual
  // current (always-empty) behavior, not the intended one.
  it('always returns an empty array — tenantId string never matches the stored ObjectId in a raw aggregate $match', async () => {
    const tenant = await createTenant();
    const { token, user } = await createAuthedUser(tenant._id);
    const studentId = objectId();
    await Attendance.create({
      tenantId: tenant._id,
      entityType: 'student',
      entityId: studentId,
      date: new Date('2026-05-01'),
      status: 'present',
      markedById: user._id,
    });
    await Attendance.create({
      tenantId: tenant._id,
      entityType: 'student',
      entityId: studentId,
      date: new Date('2026-05-02'),
      status: 'absent',
      markedById: user._id,
    });

    const res = await request(app)
      .get('/api/v1/attendance/report?entityType=student')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

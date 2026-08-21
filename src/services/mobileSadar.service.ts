import { MobileSadarRepository as Repo } from '../repositories/mobileSadar.repository';

// All 4 endpoints check role === 'sadar_mualim' via a fresh full-document
// User lookup (User.findById(userId).lean(), no .select()) — preserved
// verbatim rather than swapped for authorizeRoles(), per the same decision
// documented in mobileUstadh.service.ts.

type StatusResult = { status: number; body: Record<string, unknown> };

const FORBIDDEN: StatusResult = { status: 403, body: { success: false, message: 'Sadar Mualim role required' } };

export class MobileSadarService {
  static async getFamilies(userId: string, tenantId: string): Promise<StatusResult> {
    const user = await Repo.findUser(userId);
    if (!user || user.role !== 'sadar_mualim') return FORBIDDEN;

    const families = await Repo.findFamiliesWithHead(tenantId);
    const formatted = families.map((f: any) => ({
      _id: f._id,
      familyCode: f.familyCode,
      headName: f.headMemberId?.name || 'Unknown',
    }));

    return { status: 200, body: { success: true, data: formatted } };
  }

  static async getFamilyMembers(userId: string, tenantId: string, familyId: string): Promise<StatusResult> {
    const user = await Repo.findUser(userId);
    if (!user || user.role !== 'sadar_mualim') return FORBIDDEN;

    const members = await Repo.findMembersByFamily(familyId, tenantId);
    const memberIds = members.map((m: any) => m._id);
    const existingStudents = await Repo.findActiveStudentsByMemberIds(memberIds, tenantId);

    const studentMap = new Map<string, string>();
    existingStudents.forEach((st: any) => {
      studentMap.set(st.memberId.toString(), st.classId?.name || 'Enrolled');
    });

    const formattedMembers = members.map((m: any) => {
      const isEnrolled = studentMap.has(m._id.toString());
      return {
        _id: m._id,
        name: m.name,
        gender: m.gender,
        relationship: m.relationship || 'Member',
        phone: m.phone,
        memberId: m.memberId,
        dateOfBirth: m.dateOfBirth,
        isEnrolledStudent: isEnrolled,
        enrolledClassName: isEnrolled ? studentMap.get(m._id.toString()) : null,
      };
    });

    return { status: 200, body: { success: true, data: formattedMembers } };
  }

  static async getClasses(userId: string, tenantId: string): Promise<StatusResult> {
    const user = await Repo.findUser(userId);
    if (!user || user.role !== 'sadar_mualim') return FORBIDDEN;

    const classes = await Repo.findAllClasses(tenantId);
    return { status: 200, body: { success: true, data: classes } };
  }

  static async createStudent(
    userId: string,
    tenantId: string,
    body: {
      familyId?: string;
      classId?: string;
      memberId?: string;
      name?: string;
      relationship?: string;
      gender?: string;
      admissionNo?: string;
    },
  ): Promise<StatusResult> {
    const user = await Repo.findUser(userId);
    if (!user || user.role !== 'sadar_mualim') return FORBIDDEN;

    const { familyId, classId, memberId, name, relationship, gender, admissionNo } = body;
    if (!familyId || !classId) {
      return { status: 400, body: { success: false, message: 'Family and Class selection are required' } };
    }

    const family = await Repo.findFamilyWithHead(familyId, tenantId);
    if (!family) return { status: 404, body: { success: false, message: 'Family not found' } };

    const classDoc = await Repo.findClassById(classId, tenantId);
    if (!classDoc) return { status: 404, body: { success: false, message: 'Class not found' } };

    const headMember = family.headMemberId as any;
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();

    let targetMemberId: unknown = memberId;

    if (!targetMemberId) {
      if (!name || !name.trim()) {
        return { status: 400, body: { success: false, message: 'Please select a child or enter a child name' } };
      }
      const studentMember = await Repo.createMember({
        tenantId,
        memberId: `MHL-${new Date().getFullYear()}-${randomStr}`,
        name: name.trim(),
        phone: headMember?.phone || '0000000000',
        familyId: family._id,
        relationship: relationship || 'Child',
        gender: gender || 'male',
        status: 'active',
      });

      (family as any).members.push({
        memberId: studentMember._id,
        relationship: relationship || 'Child',
        isHead: false,
      });
      await Repo.saveFamily(family);

      targetMemberId = studentMember._id;
    }

    let studentDoc: any = await Repo.findStudentByMember(targetMemberId, tenantId);
    if (studentDoc) {
      studentDoc.classId = classId;
      studentDoc.status = 'active';
      if (admissionNo) studentDoc.admissionNo = admissionNo;
      await Repo.saveStudent(studentDoc);
    } else {
      studentDoc = await Repo.createStudent({
        tenantId,
        memberId: targetMemberId,
        admissionNo: admissionNo || `ADM-${new Date().getFullYear()}-${randomStr}`,
        admissionDate: new Date(),
        classId,
        madrasaId: (classDoc as any).madrasaId,
        guardianId: family.headMemberId,
        familyId: family._id,
        status: 'active',
      });
    }

    await Repo.addStudentToClass(classId, studentDoc._id);

    return { status: 201, body: { success: true, data: studentDoc } };
  }
}

import { AppError } from '../middleware/errorHandler';
import { TeacherRepository } from '../repositories/teacher.repository';
import { MadrasaRepository } from '../repositories/madrasa.repository';
import { Madrasa } from '../models/Madrasa';
import { Member } from '../models/Member';
import { User } from '../models/User';
import { UserRole, Gender, MemberStatus } from '../types';
import { buildPaginationMeta } from '../domain/pagination';
import { generateSequentialId } from '../domain/idGenerator';

export class TeacherService {
  static async getAll(tenantId: string, query: { page?: string; limit?: string }) {
    const pageNum = parseInt(query.page as string) || 1;
    const limitNum = parseInt(query.limit as string) || 1000;

    const [teachers, total] = await Promise.all([
      TeacherRepository.findAllByTenant(tenantId, (pageNum - 1) * limitNum, limitNum),
      TeacherRepository.countByTenant(tenantId),
    ]);

    return { teachers, pagination: buildPaginationMeta(pageNum, limitNum, total) };
  }

  static async getById(id: string, tenantId: string) {
    const teacher = await TeacherRepository.findByIdAndTenant(id, tenantId);
    if (!teacher) throw new AppError('Teacher not found', 404);
    return teacher;
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    let madrasaId = body.madrasaId;
    if (!madrasaId) {
      let madrasa = await MadrasaRepository.findByTenantRaw(tenantId);
      if (!madrasa) {
        madrasa = await Madrasa.create({
          tenantId,
          name: 'Mahallu Madrasa',
          academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          classes: [],
          subjects: ['Quran', 'Fiqh', 'Aqeedah', 'Akhlaq', 'Arabic', 'Thareekh'],
        });
      }
      madrasaId = madrasa._id;
    }

    let memberId = body.memberId;
    let userId: any = null;

    const email = body.email ? (body.email as string).trim().toLowerCase() : undefined;
    const password = body.password ? (body.password as string).trim() : undefined;
    const phone = body.phone ? (body.phone as string).trim() : '+919876543210';
    const name = (body.name as string) || 'Usthadh';

    // 1. Create or find User login account for Usthadh
    if (email || password || body.name) {
      const userEmail = email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${Date.now().toString().slice(-4)}@mahallu.app`;
      const userPhone = phone;
      const userPass = password || 'Usthadh@123456';

      let existingUser = await User.findOne({ tenantId, $or: [{ email: userEmail }, { phone: userPhone }] });
      if (!existingUser) {
        existingUser = await User.create({
          tenantId,
          name,
          email: userEmail,
          phone: userPhone,
          role: UserRole.USTADH,
          passwordHash: userPass,
          isActive: true,
        });
      }
      userId = existingUser._id;
    }

    // 2. Create Member document if memberId is not given
    if (!memberId && body.name) {
      const memberCount = await Member.countDocuments({ tenantId });
      const memberCode = generateSequentialId('MEM', memberCount, { padWidth: 4 });
      const newMember = await Member.create({
        tenantId,
        memberId: memberCode,
        name,
        phone,
        email,
        gender: Gender.MALE,
        status: MemberStatus.ACTIVE,
        userId: userId || undefined,
      });
      memberId = newMember._id;

      if (userId) {
        await User.findByIdAndUpdate(userId, { memberId: newMember._id });
      }
    }

    if (!memberId) {
      throw new AppError('Member or Teacher name is required', 400);
    }

    const count = await TeacherRepository.countByTenant(tenantId);
    const employeeId = generateSequentialId('EMP', count, { includeYear: false, padWidth: 4 });
    const qualification = (body.qualification as string) || 'Islamic Scholar / Usthadh';
    const salary = typeof body.salary === 'number' ? body.salary : 0;

    return TeacherRepository.create({
      ...body,
      tenantId,
      madrasaId,
      memberId,
      employeeId,
      qualification,
      salary,
    });
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    const teacher = await TeacherRepository.updateByIdAndTenant(id, tenantId, body);
    if (!teacher) throw new AppError('Teacher not found', 404);
    return teacher;
  }
}

import { RegistrationStatus, RegistrationType } from '../models/RegistrationRequest';
import { UserRole, Gender, MemberStatus } from '@mahallu/shared-types';
import { AppError } from '../middleware/errorHandler';
import { RegistrationRepository } from '../repositories/registration.repository';

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = '';
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function generateId(prefix: string) {
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${randomStr}`;
}

export class RegistrationService {
  static async submitRegistration(mahalluCode: string, type: string, payload: Record<string, any>) {
    if (!mahalluCode || !type || !payload) {
      throw new AppError('Missing required fields', 400);
    }

    const tenant = await RegistrationRepository.findTenantByMahalluCode(mahalluCode.toUpperCase());
    if (!tenant) {
      throw new AppError('Invalid Mahallu Code', 404);
    }

    return RegistrationRepository.createRegistrationRequest({
      tenantId: tenant._id,
      type,
      payload,
    });
  }

  static async getFamiliesForRegistration(mahalluCode: string) {
    if (!mahalluCode) throw new AppError('Mahallu code is required', 400);

    const tenant = await RegistrationRepository.findTenantByMahalluCode(mahalluCode.toUpperCase());
    if (!tenant) throw new AppError('Invalid Mahallu Code', 404);

    const families = await RegistrationRepository.findFamiliesByTenant(tenant._id.toString());

    return families.map((f: any) => ({
      _id: f._id,
      familyCode: f.familyCode,
      headName: (f.headMemberId as any)?.name || 'Unknown',
    }));
  }

  static async getPendingRegistrations(tenantId: string) {
    return RegistrationRepository.findPendingRegistrations(tenantId);
  }

  static async rejectRegistration(tenantId: string, id: string) {
    const request = await RegistrationRepository.findRegistrationByIdAndTenant(id, tenantId);
    if (!request) {
      throw new AppError('Registration request not found', 404);
    }

    request.status = RegistrationStatus.REJECTED;
    await request.save();
  }

  static async approveRegistration(tenantId: string, id: string) {
    const request = await RegistrationRepository.findRegistrationByIdAndTenant(id, tenantId);
    if (!request || request.status !== RegistrationStatus.PENDING) {
      throw new AppError('Registration request not found or already processed', 404);
    }

    const { type, payload } = request;
    const generatedPassword = generatePassword();

    // We must generate a unique fallback email in case a family shares a phone number
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    let email = payload.email || `${payload.phone}_${uniqueSuffix}@mahallu.local`;

    // 1. Create Base Member Profile for ALL types
    const member = await RegistrationRepository.createMember({
      tenantId,
      memberId: generateId('MHL'),
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      gender: payload.gender || Gender.MALE,
      dateOfBirth: payload.dob ? new Date(payload.dob) : undefined,
      status: MemberStatus.ACTIVE,
      occupation: payload.occupation,
      qualification: payload.qualification,
    });

    let role = UserRole.STUDENT;

    // 2. Handle Specific Role Logic
    if (type === RegistrationType.MEMBER) {
      role = UserRole.PARENT;

      const familyMembersData = [{ memberId: member._id, relationship: 'Head', isHead: true }];

      if (payload.familyMembers && Array.isArray(payload.familyMembers)) {
        for (const fm of payload.familyMembers) {
          if (fm.name && fm.relationship) {
            const dependent = await RegistrationRepository.createMember({
              tenantId,
              memberId: generateId('MHL'),
              name: fm.name,
              phone: payload.phone, // Dependents use the head's phone number if not provided
              gender: fm.gender || Gender.MALE,
              status: MemberStatus.ACTIVE,
            });
            familyMembersData.push({ memberId: dependent._id, relationship: fm.relationship, isHead: false });
          }
        }
      }

      const family = await RegistrationRepository.createFamily({
        tenantId,
        familyCode: generateId('FAM'),
        headMemberId: member._id,
        members: familyMembersData,
        address: {
          line1: payload.addressLine1 || 'N/A',
          city: payload.city || 'Unknown',
          district: payload.district || 'Unknown',
          state: payload.state || 'Unknown',
          pincode: payload.pincode || '000000',
          country: 'India',
        },
        outstandingBalance: 0,
      });

      await RegistrationRepository.updateManyMembersSetFamilyId(
        familyMembersData.map(m => m.memberId),
        family._id,
      );
    } else if (type === RegistrationType.STUDENT) {
      role = UserRole.STUDENT;

      let guardianId = member._id;

      if (payload.familyId) {
        const family = await RegistrationRepository.findFamilyById(payload.familyId);
        if (family) {
          guardianId = family.headMemberId;
          member.familyId = family._id;

          family.members.push({
            memberId: member._id,
            relationship: 'Child/Dependent',
            isHead: false,
          });
          await family.save();
        }
      }

      // Dummy class & madrasa IDs if none passed. Ideally selected during registration.
      await RegistrationRepository.createStudent({
        tenantId,
        memberId: member._id,
        admissionNo: generateId('ADM'),
        admissionDate: new Date(),
        madrasaId: payload.madrasaId || member._id, // placeholder
        classId: payload.classId || member._id,     // placeholder
        guardianId: guardianId,                     // Self or parent
        status: 'active',
        feePaid: 0,
        feeBalance: 0,
      });
    } else if (type === RegistrationType.TEACHER || type === (RegistrationType as any).SADAR_MUALIM) {
      role = type === RegistrationType.TEACHER ? UserRole.USTADH : UserRole.SADAR_MUALIM;

      await RegistrationRepository.createTeacher({
        tenantId,
        memberId: member._id,
        madrasaId: payload.madrasaId || member._id, // placeholder
        employeeId: generateId('EMP'),
        subjects: payload.subjects || [],
        qualification: payload.qualification || '',
        salary: 0,
        joiningDate: new Date(),
        status: 'active',
        documents: [],
      });
    }

    // 3. Create the User Account
    let userPhone = payload.phone;
    const existingUser = await RegistrationRepository.findUserByTenantAndPhone(tenantId, userPhone);
    if (existingUser) {
      userPhone = `${userPhone}_${uniqueSuffix}`;
    }

    const user = await RegistrationRepository.createUser({
      tenantId,
      name: payload.name,
      email: email.toLowerCase(),
      phone: userPhone,
      role: role,
      passwordHash: generatedPassword,
      memberId: member._id,
      isActive: true,
    });

    member.userId = user._id;
    await member.save();

    // 4. Update request status
    request.status = RegistrationStatus.APPROVED;
    await request.save();

    return {
      email: user.email,
      phone: user.phone,
      generatedPassword,
    };
  }
}

import QRCode from 'qrcode';
import { AppError } from '../middleware/errorHandler';
import { MemberRepository } from '../repositories/member.repository';
import { DEFAULT_PAGINATION } from "../config/constants";
import { generateSequentialId } from '../domain/idGenerator';
import { buildPaginationMeta } from '../domain/pagination';

export class MemberService {
  static async getAll(
    tenantId: string,
    query: { page?: string; limit?: string; search?: string; status?: string; familyId?: string; gender?: string },
  ) {
    const { page = DEFAULT_PAGINATION.page, limit = DEFAULT_PAGINATION.limit, search, status, familyId, gender } = query;

    const pageNum = Math.max(1, parseInt(page as unknown as string) || 1);
    const limitNum = Math.min(parseInt(limit as unknown as string) || 50, 5000);

    const filter: Record<string, any> = { tenantId, isDeleted: { $ne: true } };
    if (status) filter.status = status;
    if (familyId) filter.familyId = familyId;
    if (gender) filter.gender = gender;
    if (search) {
      const cleanSearch = String(search).trim();
      const searchRegex = new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: searchRegex }, { phone: searchRegex }, { memberId: searchRegex }];
    }

    const [members, total] = await Promise.all([
      MemberRepository.findMembers(filter, (pageNum - 1) * limitNum, limitNum),
      MemberRepository.countMembers(filter),
    ]);

    return {
      members,
      pagination: buildPaginationMeta(pageNum, limitNum, total),
    };
  }

  static async getById(id: string, tenantId: string) {
    const member = await MemberRepository.findMemberById(id, tenantId);
    if (!member) throw new AppError('Member not found', 404);
    return member;
  }

  static async create(tenantId: string, body: Record<string, any>) {
    // Generate member ID
    const count = await MemberRepository.countMembersByTenant(tenantId);
    const memberId = generateSequentialId('MHL', count, { padWidth: 4 });

    // Generate QR code
    const qrData = JSON.stringify({ memberId, tenantId, type: 'member' });
    const qrCode = await QRCode.toDataURL(qrData);

    const member = await MemberRepository.createMember({
      ...body,
      tenantId,
      memberId,
      qrCode,
    });

    // Sync with Family if familyId is provided
    if (body.familyId) {
      await MemberRepository.pushMemberIntoFamily(body.familyId, tenantId, {
        memberId: member._id,
        relationship: body.relationship || 'Member',
        isHead: false,
      });
    }

    return member;
  }

  static async update(id: string, tenantId: string, body: Record<string, any>) {
    const oldMember = await MemberRepository.findMemberByIdAndTenant(id, tenantId);
    if (!oldMember) throw new AppError('Member not found', 404);

    const oldFamilyId = oldMember.familyId?.toString();
    const newFamilyId = body.familyId?.toString();

    const member = await MemberRepository.updateMember(id, tenantId, body);

    // Handle Family changes
    if (oldFamilyId !== newFamilyId) {
      if (oldFamilyId) {
        // Remove from old family
        await MemberRepository.pullMemberFromFamily(oldFamilyId, tenantId, member?._id);
      }
      if (newFamilyId) {
        // Add to new family
        await MemberRepository.pushMemberIntoFamily(newFamilyId, tenantId, {
          memberId: member?._id,
          relationship: body.relationship || 'Member',
          isHead: false,
        });
      }
    } else if (newFamilyId && body.relationship !== undefined) {
      // Just update relationship if family didn't change
      await MemberRepository.updateMemberRelationshipInFamily(newFamilyId, tenantId, member?._id, body.relationship);
    }

    return member;
  }

  static async delete(id: string, tenantId: string) {
    const member = await MemberRepository.deleteMemberById(id, tenantId);
    if (!member) {
      await MemberRepository.softDeleteMemberById(id, tenantId);
    }

    if (member?.userId) {
      await MemberRepository.deactivateUser(member.userId);
    }

    await MemberRepository.pullMemberFromAllFamilies(tenantId, id);
  }

  static async bulkDelete(tenantId: string, ids: unknown) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('Member IDs list is required', 400);
    }

    const members = await MemberRepository.findMembersByIdsAndTenant(ids, tenantId);
    const memberIds = members.map((m) => m._id);
    const userIds = members.map((m) => m.userId).filter(Boolean);

    await MemberRepository.hardDeleteMembersByIds(memberIds, tenantId);
    await MemberRepository.softDeleteMembersByIds(memberIds);

    if (userIds.length > 0) {
      await MemberRepository.deactivateUsersByIds(userIds);
    }

    await MemberRepository.pullMembersFromAllFamilies(tenantId, memberIds);

    return { count: members.length };
  }

  static async getQRCard(id: string, tenantId: string) {
    const member = await MemberRepository.findMemberByIdAndTenantWithFamilyAddress(id, tenantId);
    if (!member) throw new AppError('Member not found', 404);

    // Generate fresh QR if missing
    if (!member.qrCode) {
      const qrData = JSON.stringify({ memberId: member.memberId, tenantId: member.tenantId, type: 'member' });
      const qrCode = await QRCode.toDataURL(qrData);
      await MemberRepository.updateMemberQrCode(member._id, qrCode);
      member.qrCode = qrCode;
    }

    return member;
  }

  static async search(tenantId: string, q: unknown) {
    if (!q) throw new AppError('Search query required', 400);
    return MemberRepository.searchMembers(tenantId, q as string);
  }

  static async getStats(tenantId: string) {
    const baseFilter = { tenantId, isDeleted: { $ne: true } };

    const [total, active, inactive, deceased, male, female] = await Promise.all([
      MemberRepository.countMembers(baseFilter),
      MemberRepository.countMembers({ ...baseFilter, status: 'active' }),
      MemberRepository.countMembers({ ...baseFilter, status: 'inactive' }),
      MemberRepository.countMembers({ ...baseFilter, status: 'deceased' }),
      MemberRepository.countMembers({ ...baseFilter, gender: 'male' }),
      MemberRepository.countMembers({ ...baseFilter, gender: 'female' }),
    ]);

    return { total, active, inactive, deceased, male, female };
  }
}

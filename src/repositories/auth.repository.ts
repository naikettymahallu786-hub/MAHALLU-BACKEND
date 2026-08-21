import { User, UserDocument } from '../models/User';
import { Tenant, TenantDocument } from '../models/Tenant';
import { Member, MemberDocument } from '../models/Member';
import { Family } from '../models/Family';

// Repository methods return hydrated (non-`.lean()`) Mongoose documents
// wherever the caller needs to mutate and `.save()` them — that `.save()`
// call is not a "new" direct-DB-access from the service, since the
// repository already brokered the read that produced the document.
export class AuthRepository {
  static async findUserWithMemberById(userId: string) {
    return User.findById(userId).populate('memberId', 'name photo phone').lean();
  }

  static async findTenantByIdBasicFields(tenantId: string) {
    return Tenant.findById(tenantId).select('name mahalluCode logo').lean();
  }

  static async findUserByTenantAndMemberId(tenantId: string, memberId: string): Promise<UserDocument | null> {
    return User.findOne({ tenantId, memberId });
  }

  // Preserves the pre-existing query exactly as found in
  // auth.controller.ts's forgotPassword/resetPassword: matches on either
  // `mahalluCode` or a `code` field that does not exist on the current
  // Tenant schema. Left unchanged rather than "fixed" — see migration plan
  // risk notes for this task.
  static async findActiveTenantByCode(tenantCode: string) {
    return Tenant.findOne({
      $or: [{ mahalluCode: tenantCode }, { code: tenantCode }],
      isActive: true,
    });
  }

  static async findActiveUserByIdentifierWithOTPFields(
    tenantId: string,
    identifier: string,
  ): Promise<UserDocument | null> {
    return User.findOne({
      tenantId,
      $or: [{ email: identifier }, { phone: identifier }],
      isDeleted: { $ne: true },
    }).select('+resetPasswordOTP +resetPasswordOTPExpires');
  }

  static async findActiveUserByIdentifierWithResetFields(
    tenantId: string,
    identifier: string,
  ): Promise<UserDocument | null> {
    return User.findOne({
      tenantId,
      $or: [{ email: identifier }, { phone: identifier }],
      isDeleted: { $ne: true },
    }).select('+resetPasswordOTP +resetPasswordOTPExpires +passwordHash');
  }

  static async findUserWithRefreshTokensById(userId: string) {
    return User.findById(userId).select('+refreshTokens').lean<UserDocument>();
  }

  static async pullUserRefreshToken(userId: string, token: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { $pull: { refreshTokens: token } });
  }

  static async pushUserRefreshToken(userId: string, token: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { $push: { refreshTokens: token } });
  }

  static async clearUserRefreshTokens(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { $set: { refreshTokens: [] } });
  }

  static async findUserById(userId: string): Promise<UserDocument | null> {
    return User.findById(userId);
  }

  static async findUserWithTwoFactorSecretById(userId: string): Promise<UserDocument | null> {
    return User.findById(userId).select('+twoFactorSecret');
  }

  static async updateUserTwoFactorSecret(userId: string, twoFactorSecret: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { twoFactorSecret });
  }

  static async updateUserTwoFactorEnabled(userId: string, twoFactorEnabled: boolean): Promise<void> {
    await User.findByIdAndUpdate(userId, { twoFactorEnabled });
  }

  static async findUserWithPasswordHashById(userId: string): Promise<UserDocument | null> {
    return User.findById(userId).select('+passwordHash');
  }

  static async updateUserFcmToken(userId: string, fcmToken: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { fcmToken });
  }

  // ---- login() query set ----
  // Named per their exact call site rather than aggressively deduplicated:
  // several of these look similar but differ in subtle, deliberate ways
  // (isActive filter present/absent, tenantId conditional/required,
  // isDeleted filter present/absent) that must be preserved exactly.

  static async findActiveTenantByMahalluCode(mahalluCode: string): Promise<TenantDocument | null> {
    return Tenant.findOne({ mahalluCode, isActive: true });
  }

  static async findTenantByMahalluCode(mahalluCode: string): Promise<TenantDocument | null> {
    return Tenant.findOne({ mahalluCode });
  }

  static async createTenant(data: Record<string, unknown>): Promise<TenantDocument> {
    return Tenant.create(data);
  }

  static async createUser(data: Record<string, unknown>): Promise<UserDocument> {
    return User.create(data);
  }

  static async findActiveUserByEmail(
    tenantId: string | undefined,
    email: string,
  ): Promise<UserDocument | null> {
    return User.findOne({
      ...(tenantId && { tenantId }),
      email,
      isDeleted: false,
    }).select('+passwordHash +refreshTokens').lean<UserDocument>();
  }

  static async findActiveUserByPhones(
    tenantId: string | undefined,
    phones: string[],
  ): Promise<UserDocument | null> {
    return User.findOne({
      ...(tenantId && { tenantId }),
      phone: { $in: phones },
      isDeleted: false,
    }).select('+passwordHash +refreshTokens').lean<UserDocument>();
  }

  static async findUserByEmailAndTenant(tenantId: string, email: string): Promise<UserDocument | null> {
    return User.findOne({ email, tenantId }).select('+passwordHash +refreshTokens').lean<UserDocument>();
  }

  static async findMemberByIdentifiers(
    tenantId: string,
    orConditions: Record<string, unknown>[],
  ): Promise<MemberDocument | null> {
    return Member.findOne({ tenantId, $or: orConditions });
  }

  static async findMemberById(memberId: string): Promise<MemberDocument | null> {
    return Member.findById(memberId);
  }

  static async findActiveUserById(userId: string): Promise<UserDocument | null> {
    return User.findOne({ _id: userId, isDeleted: false }).select('+passwordHash +refreshTokens').lean<UserDocument>();
  }

  static async findUserByTenantAndIdentityOr(
    tenantId: string,
    orConditions: Record<string, unknown>[],
  ): Promise<UserDocument | null> {
    return User.findOne({ tenantId, $or: orConditions });
  }

  static async findUserByIdWithAuthFields(userId: string): Promise<UserDocument | null> {
    return User.findById(userId).select('+passwordHash +refreshTokens').lean<UserDocument>();
  }

  static async findFamilyByCodeRegex(tenantId: string, familyCodeRegex: RegExp) {
    return Family.findOne({ tenantId, familyCode: familyCodeRegex });
  }

  static async pushUserRefreshTokenAndUpdateLastLogin(userId: string, token: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $push: { refreshTokens: token },
      lastLoginAt: new Date(),
    });
  }
}

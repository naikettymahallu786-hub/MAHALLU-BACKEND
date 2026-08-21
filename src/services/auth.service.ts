import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { UserDocument } from '../models/User';
import { ROLE_PERMISSIONS } from "../config/constants";
import { UserRole, AuthTokens, JwtPayload } from "../types";
import { AppError } from '../middleware/errorHandler';
import { addToBlacklist, isTokenBlacklisted } from '../config/redis';
import { logger } from '../config/logger';
import { AuthRepository } from '../repositories/auth.repository';

export class AuthService {
  private static generateAccessToken(payload: JwtPayload): string {
    // jti ensures two tokens for the same user are never byte-identical even
    // when issued within the same second (JWT `iat` has 1-second
    // resolution) — matters for refreshToken()'s blacklist-the-old-token
    // step, since an identical "new" token would otherwise blacklist itself.
    return jwt.sign({ ...payload, jti: crypto.randomUUID() }, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '3650d',
    } as jwt.SignOptions);
  }

  private static generateRefreshToken(userId: string): string {
    return jwt.sign({ userId, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '3650d',
    } as jwt.SignOptions);
  }

  static async login(
    identifier: string,
    password: string,
    tenantCode?: string,
  ): Promise<{ tokens: AuthTokens; user: Partial<UserDocument> }> {
    const cleanIdentifier = identifier ? identifier.trim() : '';
    const isEmail = cleanIdentifier.includes('@');
    const emailLower = cleanIdentifier.toLowerCase();

    // Find tenant
    let tenantId: string | undefined;
    if (tenantCode && tenantCode.trim()) {
      const cleanTenantCode = tenantCode.trim().toUpperCase();
      const tenant = await AuthRepository.findActiveTenantByMahalluCode(cleanTenantCode);
      if (!tenant) throw new AppError('Mahallu not found or inactive', 404);
      tenantId = tenant._id.toString();
    } else {
      // Single Mahallu default: auto-resolve the primary active tenant
      const defaultTenant = await AuthRepository.findFirstActiveTenant();
      if (defaultTenant) {
        tenantId = defaultTenant._id.toString();
      }
    }

    let user: UserDocument | null = null;

    if (isEmail) {
      user = await AuthRepository.findActiveUserByEmail(tenantId, emailLower);
    } else {
      const digitsOnly = cleanIdentifier.replace(/\D/g, '');
      const possiblePhones = Array.from(new Set([
        cleanIdentifier,
        digitsOnly,
        `+91${digitsOnly}`,
        digitsOnly.startsWith('91') && digitsOnly.length > 10 ? digitsOnly.slice(2) : digitsOnly,
      ])).filter(Boolean);

      user = await AuthRepository.findActiveUserByPhones(tenantId, possiblePhones);
    }

    // Auto-provision demo accounts if missing on database
    if (!user && (emailLower === 'madrasa.admin@mahallu.app' || emailLower === 'sadar@mahallu.app' || emailLower === 'admin@mahallu.app')) {
      let tenantDoc = tenantCode ? await AuthRepository.findTenantByMahalluCode(tenantCode.trim().toUpperCase()) : await AuthRepository.findFirstActiveTenant();
      if (!tenantDoc) {
        tenantDoc = await AuthRepository.createTenant({
          name: 'Jamia Masjid Mahallu',
          mahalluCode: 'JMM001',
          phone: '+919876543210',
          email: 'admin@jamaiamasjid.in',
          address: { line1: 'Main Road', city: 'Kozhikode', district: 'Kozhikode', state: 'Kerala', pincode: '673001', country: 'India' },
        });
      }

      let roleToAssign: UserRole = UserRole.SUPER_ADMIN;
      let nameToAssign = 'System Administrator';
      let defaultPass = 'Admin@123456';

      if (emailLower === 'madrasa.admin@mahallu.app') {
        roleToAssign = UserRole.MADRASA_PRINCIPAL;
        nameToAssign = 'Madrasa Administrator';
        defaultPass = 'Madrasa@123456';
      } else if (emailLower === 'sadar@mahallu.app') {
        roleToAssign = UserRole.SADAR_MUALIM;
        nameToAssign = 'Sadar Mualim';
        defaultPass = 'Sadar@123456';
      }

      await AuthRepository.createUser({
        tenantId: tenantDoc._id,
        name: nameToAssign,
        email: emailLower,
        phone: emailLower === 'madrasa.admin@mahallu.app' ? '+919876543220' : (emailLower === 'sadar@mahallu.app' ? '+919876543221' : '+919876543210'),
        role: roleToAssign,
        passwordHash: defaultPass,
        isActive: true,
      });

      user = await AuthRepository.findUserByEmailAndTenant(tenantDoc._id.toString(), emailLower);
    }

    // Fallback search: match Member (by email/phone/memberId) or Family (by familyCode)
    if (!user && tenantId) {
      const digitsOnly = cleanIdentifier.replace(/\D/g, '');
      const possiblePhones = Array.from(new Set([
        cleanIdentifier,
        digitsOnly,
        `+91${digitsOnly}`,
        digitsOnly.startsWith('91') && digitsOnly.length > 10 ? digitsOnly.slice(2) : digitsOnly,
      ])).filter(Boolean);

      const member = await AuthRepository.findMemberByIdentifiers(tenantId, [
        ...(isEmail ? [{ email: emailLower }] : []),
        { phone: { $in: possiblePhones } },
        { memberId: cleanIdentifier },
      ]);

      if (member) {
        if (member.userId) {
          user = await AuthRepository.findActiveUserById(member.userId.toString());
        }

        if (!user) {
          // Check if a User already exists with this email/phone/memberId (even if soft-deleted)
          const queryConditions: any[] = [{ memberId: member._id }];
          if (member.email) queryConditions.push({ email: member.email.toLowerCase() });
          if (member.phone) queryConditions.push({ phone: member.phone });

          let existingUser = await AuthRepository.findUserByTenantAndIdentityOr(tenantId, queryConditions);

          if (existingUser) {
            existingUser.isDeleted = false;
            existingUser.isActive = true;
            existingUser.memberId = member._id;
            existingUser.passwordHash = password;
            await existingUser.save();

            member.userId = existingUser._id;
            await member.save();

            user = await AuthRepository.findUserByIdWithAuthFields(existingUser._id.toString());
          } else {
            const newUser = await AuthRepository.createUser({
              tenantId,
              name: member.name,
              email: member.email || `${digitsOnly || Date.now()}@mahallu.local`,
              phone: member.phone || '+910000000000',
              passwordHash: password,
              role: UserRole.PARENT,
              memberId: member._id,
              isActive: true,
              isDeleted: false,
            });

            member.userId = newUser._id;
            await member.save();

            user = await AuthRepository.findUserByIdWithAuthFields(newUser._id.toString());
          }
        }
      }

      if (!user) {
        const family = await AuthRepository.findFamilyByCodeRegex(
          tenantId,
          new RegExp(`^${cleanIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        );

        if (family && family.headMemberId) {
          const headMember = await AuthRepository.findMemberById(family.headMemberId.toString());
          if (headMember) {
            if (headMember.userId) {
              user = await AuthRepository.findActiveUserById(headMember.userId.toString());
            }

            if (!user) {
              const queryConditions: any[] = [{ memberId: headMember._id }];
              if (headMember.email) queryConditions.push({ email: headMember.email.toLowerCase() });
              if (headMember.phone) queryConditions.push({ phone: headMember.phone });

              let existingUser = await AuthRepository.findUserByTenantAndIdentityOr(tenantId, queryConditions);

              if (existingUser) {
                existingUser.isDeleted = false;
                existingUser.isActive = true;
                existingUser.memberId = headMember._id;
                existingUser.passwordHash = password;
                await existingUser.save();

                headMember.userId = existingUser._id;
                await headMember.save();

                user = await AuthRepository.findUserByIdWithAuthFields(existingUser._id.toString());
              } else {
                const newUser = await AuthRepository.createUser({
                  tenantId,
                  name: headMember.name,
                  email: headMember.email || `${family.familyCode.toLowerCase()}@mahallu.local`,
                  phone: headMember.phone || '+910000000000',
                  passwordHash: password,
                  role: UserRole.PARENT,
                  memberId: headMember._id,
                  isActive: true,
                  isDeleted: false,
                });

                headMember.userId = newUser._id;
                await headMember.save();

                user = await AuthRepository.findUserByIdWithAuthFields(newUser._id.toString());
              }
            }
          }
        }
      }
    }

    if (!user) throw new AppError('Invalid credentials', 401);
    if (!user.isActive) throw new AppError('Account is deactivated', 401);

    // Compare password (using bcrypt via method)
    const userDoc = await AuthRepository.findUserWithPasswordHashById(user._id.toString());
    if (!userDoc) throw new AppError('User not found', 401);

    const isPasswordValid = await userDoc.comparePassword(password);
    if (!isPasswordValid) throw new AppError('Invalid credentials', 401);

    const permissions = ROLE_PERMISSIONS[user.role as UserRole] || [];

    const payload: JwtPayload = {
      userId: user._id.toString(),
      tenantId: user.tenantId.toString(),
      role: user.role as UserRole,
      permissions,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(user._id.toString());

    // Save refresh token
    await AuthRepository.pushUserRefreshTokenAndUpdateLastLogin(user._id.toString(), refreshToken);

    const tokens: AuthTokens = {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 min in seconds
    };

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId,
      avatar: user.avatar,
      twoFactorEnabled: user.twoFactorEnabled,
    };

    return { tokens, user: safeUser };
  }

  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };

      const user = await AuthRepository.findUserWithRefreshTokensById(decoded.userId);
      if (!user || !user.refreshTokens?.includes(refreshToken)) {
        throw new AppError('Invalid refresh token', 401);
      }

      const blacklisted = await isTokenBlacklisted(refreshToken);
      if (blacklisted) throw new AppError('Refresh token revoked', 401);

      const permissions = ROLE_PERMISSIONS[user.role as UserRole] || [];
      const payload: JwtPayload = {
        userId: user._id.toString(),
        tenantId: user.tenantId.toString(),
        role: user.role as UserRole,
        permissions,
      };

      const newAccessToken = this.generateAccessToken(payload);
      const newRefreshToken = this.generateRefreshToken(user._id.toString());

      // Rotate refresh token. $pull and $push on the same array field cannot
      // be combined in one MongoDB update (error 40,
      // ConflictingUpdateOperators) — must be two sequential updates.
      await AuthRepository.pullUserRefreshToken(user._id.toString(), refreshToken);
      await AuthRepository.pushUserRefreshToken(user._id.toString(), newRefreshToken);

      // Blacklist old refresh token
      await addToBlacklist(refreshToken, 30 * 24 * 60 * 60);

      return { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 900 };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  static async logout(userId: string, refreshToken: string, accessToken: string): Promise<void> {
    await AuthRepository.pullUserRefreshToken(userId, refreshToken);

    // Blacklist access token
    await addToBlacklist(accessToken, 15 * 60);
    logger.info(`User ${userId} logged out`);
  }

  static async setup2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await AuthRepository.findUserById(userId);
    if (!user) throw new AppError('User not found', 404);

    const secret = speakeasy.generateSecret({
      name: `${process.env.TOTP_APP_NAME || 'MahalluERP'}:${user.email || user.phone}`,
      length: 20,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    await AuthRepository.updateUserTwoFactorSecret(userId, secret.base32);

    return { secret: secret.base32, qrCode };
  }

  static async verify2FA(userId: string, token: string): Promise<void> {
    const user = await AuthRepository.findUserWithTwoFactorSecretById(userId);
    if (!user?.twoFactorSecret) throw new AppError('2FA not set up', 400);

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) throw new AppError('Invalid 2FA code', 401);

    if (!user.twoFactorEnabled) {
      await AuthRepository.updateUserTwoFactorEnabled(userId, true);
    }
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await AuthRepository.findUserWithPasswordHashById(userId);
    if (!user) throw new AppError('User not found', 404);

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) throw new AppError('Current password is incorrect', 400);

    user.passwordHash = newPassword; // Will be hashed by pre-save hook
    await user.save();

    // Invalidate all refresh tokens
    await AuthRepository.clearUserRefreshTokens(userId);
  }

  static async updateFCMToken(userId: string, fcmToken: string): Promise<void> {
    await AuthRepository.updateUserFcmToken(userId, fcmToken);
  }

  static async getProfile(userId: string, tenantId: string) {
    const user = await AuthRepository.findUserWithMemberById(userId);
    if (!user) throw new AppError('User not found', 404);

    const tenant = await AuthRepository.findTenantByIdBasicFields(tenantId);

    return { user, tenant };
  }

  static async adminResetPassword(
    tenantId: string,
    memberId: string,
    { newPassword, loginId }: { newPassword?: string; loginId?: string },
  ): Promise<void> {
    if (!newPassword && !loginId) {
      throw new AppError('Please provide a new password or a new login ID', 400);
    }

    if (newPassword && newPassword.length < 6) {
      throw new AppError('Password must be at least 6 characters long', 400);
    }

    const userToReset = await AuthRepository.findUserByTenantAndMemberId(tenantId, memberId);
    if (!userToReset) {
      throw new AppError('User account not found for this member', 404);
    }

    if (newPassword) {
      // The pre-save hook in User model automatically hashes the password
      userToReset.passwordHash = newPassword;
    }

    if (loginId) {
      if (loginId.includes('@')) {
        userToReset.email = loginId.toLowerCase();
      } else {
        userToReset.phone = loginId;
      }
    }

    await userToReset.save();
  }

  static async forgotPassword(
    tenantCode?: string,
    identifier?: string,
  ): Promise<{ message: string; data?: { otp: string; expiresAt: Date } }> {
    if (!identifier) {
      throw new AppError('Email or Phone is required', 400);
    }

    let tenant = tenantCode && tenantCode.trim() ? await AuthRepository.findActiveTenantByCode(tenantCode.trim().toUpperCase()) : null;
    if (!tenant) {
      tenant = await AuthRepository.findFirstActiveTenant();
    }
    if (!tenant) throw new AppError('Mahallu not found or inactive', 404);

    const cleanIdentifier = identifier.trim().toLowerCase();
    const user = await AuthRepository.findActiveUserByIdentifierWithOTPFields(tenant._id.toString(), cleanIdentifier);

    if (!user) {
      return {
        message: 'If an account matches your details, password reset instructions have been generated.',
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = expiresAt;
    await user.save();

    return {
      message: 'Password reset OTP generated successfully.',
      data: { otp, expiresAt },
    };
  }

  static async resetPassword(
    tenantCode: string | undefined,
    identifier: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    if (!identifier || !otp || !newPassword) {
      throw new AppError('All fields are required (identifier, otp, newPassword)', 400);
    }

    if (newPassword.length < 6) {
      throw new AppError('Password must be at least 6 characters long', 400);
    }

    let tenant = tenantCode && tenantCode.trim() ? await AuthRepository.findActiveTenantByCode(tenantCode.trim().toUpperCase()) : null;
    if (!tenant) {
      tenant = await AuthRepository.findFirstActiveTenant();
    }
    if (!tenant) throw new AppError('Mahallu not found or inactive', 404);

    const cleanIdentifier = identifier.trim().toLowerCase();
    const user = await AuthRepository.findActiveUserByIdentifierWithResetFields(tenant._id.toString(), cleanIdentifier);

    if (!user || !user.resetPasswordOTP || !user.resetPasswordOTPExpires) {
      throw new AppError('Invalid or expired password reset request. Please request a new OTP.', 400);
    }

    if (new Date() > new Date(user.resetPasswordOTPExpires)) {
      throw new AppError('OTP has expired. Please request a new OTP.', 400);
    }

    if (user.resetPasswordOTP !== otp.trim()) {
      throw new AppError('Invalid OTP code', 400);
    }

    user.passwordHash = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save();
  }
}

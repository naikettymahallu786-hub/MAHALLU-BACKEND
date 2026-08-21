import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier, password, tenantCode } = req.body;
      if (!identifier || !password) {
        throw new AppError('Identifier and password are required', 400);
      }

      const { tokens, user } = await AuthService.login(identifier, password, tenantCode);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: { tokens, user },
      });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) throw new AppError('Refresh token required', 400);

      const tokens = await AuthService.refreshToken(refreshToken);
      res.status(200).json({ success: true, message: 'Token refreshed', data: { tokens } });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const accessToken = req.headers.authorization?.split(' ')[1] || '';

      if (req.user) {
        await AuthService.logout(req.user.userId, refreshToken, accessToken);
      }

      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, tenant } = await AuthService.getProfile(req.user!.userId, req.user!.tenantId);

      res.status(200).json({
        success: true,
        message: 'User profile',
        data: { user, tenant },
      });
    } catch (error) {
      next(error);
    }
  }

  static async setup2FA(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.setup2FA(req.user!.userId);
      res.status(200).json({ success: true, message: '2FA setup initiated', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async verify2FA(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      await AuthService.verify2FA(req.user!.userId, token);
      res.status(200).json({ success: true, message: '2FA enabled successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      await AuthService.changePassword(req.user!.userId, currentPassword, newPassword);
      res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async updateFCMToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fcmToken } = req.body;
      await AuthService.updateFCMToken(req.user!.userId, fcmToken);
      res.status(200).json({ success: true, message: 'FCM token updated' });
    } catch (error) {
      next(error);
    }
  }

  static async adminResetPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { memberId } = req.params;
      const { newPassword, loginId } = req.body;

      await AuthService.adminResetPassword(req.user!.tenantId, memberId, { newPassword, loginId });

      res.status(200).json({ success: true, message: 'Security credentials updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantCode, identifier } = req.body;

      const result = await AuthService.forgotPassword(tenantCode, identifier);

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantCode, identifier, otp, newPassword } = req.body;

      await AuthService.resetPassword(tenantCode, identifier, otp, newPassword);

      res.status(200).json({
        success: true,
        message: 'Password reset successfully! You can now sign in with your new password.',
      });
    } catch (error) {
      next(error);
    }
  }
}

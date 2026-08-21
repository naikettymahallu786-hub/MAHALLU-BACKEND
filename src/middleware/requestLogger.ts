import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';
import { AuthRequest } from './auth';
import { logger } from '../config/logger';

export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  logger.debug(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
};

// Audit log middleware factory — wraps mutating routes
export const auditLog = (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT') => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Capture original json method to intercept response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode < 400 && req.user) {
        const rawEntityId = req.params.id || (body as Record<string, Record<string, string>>)?.data?._id;
        const isValidObjectId = rawEntityId && typeof rawEntityId === 'string' && /^[0-9a-fA-F]{24}$/.test(rawEntityId);

        AuditLog.create({
          tenantId: req.user.tenantId,
          userId: req.user.userId,
          action,
          entity,
          ...(isValidObjectId && { entityId: rawEntityId }),
          ip: req.ip,
          userAgent: req.get('user-agent'),
          changes: action === 'UPDATE' || action === 'DELETE' ? { body: req.body } : undefined,
        }).catch(err => logger.error('Audit log error:', err));
      }
      return originalJson(body);
    };
    next();
  };
};

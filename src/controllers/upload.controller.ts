import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';

// Non-functional stub in the original code (no multer wiring despite the
// message referencing it) — preserved as-is, not implemented here.
export class UploadController {
  static async upload(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ success: true, message: 'Upload endpoint - use multipart/form-data with multer middleware' });
    } catch (error) {
      next(error);
    }
  }
}

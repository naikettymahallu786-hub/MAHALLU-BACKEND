import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WhatsappService } from '../services/whatsapp.service';

export class WhatsappController {
  static verifyWebhook(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (WhatsappService.verifyWebhook(mode, token)) {
      res.status(200).send(challenge);
    } else {
      res.status(403).json({ success: false });
    }
  }

  // Handle incoming WhatsApp messages — stub in the original code
  // (logs and acknowledges only; no chatbot logic is implemented).
  static receiveWebhook(req: Request, res: Response): void {
    const { entry } = req.body;
    if (entry) {
      console.log('WhatsApp message received:', JSON.stringify(entry, null, 2));
    }
    res.status(200).send('OK');
  }

  static async send(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ success: true, message: 'WhatsApp message queued' });
    } catch (error) {
      next(error);
    }
  }
}

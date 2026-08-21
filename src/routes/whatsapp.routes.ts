import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { WhatsappController } from '../controllers/whatsapp.controller';

const r = Router();
// WhatsApp webhook verification (no auth)
r.get('/webhook', WhatsappController.verifyWebhook);
r.post('/webhook', WhatsappController.receiveWebhook);
r.post('/send', authenticate, WhatsappController.send);
export default r;

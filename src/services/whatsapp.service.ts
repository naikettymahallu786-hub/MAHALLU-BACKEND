export class WhatsappService {
  static verifyWebhook(mode: unknown, token: unknown): boolean {
    return mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN;
  }
}

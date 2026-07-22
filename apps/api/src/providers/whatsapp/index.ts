/**
 * WhatsApp / MSG91 provider module — plug-and-play, mirrors `providers/payment/`.
 *
 * One folder, one shared MSG91 request-body builder, two adapters:
 * - Msg91WhatsappOtpProvider        implements IOtpProvider (OTP delivery)
 * - WhatsappNotificationProvider    implements INotificationChannelProvider (transactional + promo)
 *
 * Everything else in the app should import from this barrel, not the individual files.
 */
export { Msg91WhatsappOtpProvider } from './msg91-whatsapp-otp.provider'
export { WhatsappNotificationProvider } from './whatsapp-notification.provider'
export { buildMsg91WhatsappBody, sendMsg91WhatsappTemplate } from './msg91-whatsapp.client'
export type { Msg91WhatsappRequestBody, Msg91SendResult } from './msg91-whatsapp.client'
export {
  MSG91_WA_API_URL,
  WHATSAPP_TEMPLATE_ENV_KEY,
  BROADCAST_TARGET_TYPE,
  BROADCAST_STATUS,
  WHATSAPP_PROMO_MAX_RECIPIENTS,
  WHATSAPP_PROMO_SEND_DELAY_MS,
} from './whatsapp.constants'

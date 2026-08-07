import { prisma } from '../lib/prisma'
import { env, isProduction } from './env'
import { logger } from '../utils/logger'
import { DEFAULT_SUPPORT_EMAIL } from '../utils/constants'
import { UserRepository } from '../repositories/user.repository'
import { RefreshTokenRepository } from '../repositories/refresh-token.repository'
import { DestinationRepository } from '../repositories/destination.repository'
import { TripRepository } from '../repositories/trip.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { TripEditHistoryRepository } from '../repositories/trip-edit-history.repository'
import { BookingRepository } from '../repositories/booking.repository'
import { TripRequestRepository } from '../repositories/trip-request.repository'
import { VerificationCodeRepository } from '../repositories/verification-code.repository'
import { AuthService } from '../services/auth.service'
import { OtpService } from '../services/otp.service'
import { DestinationService } from '../services/destination.service'
import { TripService } from '../services/trip.service'
import { UploadService } from '../services/upload.service'
import { HealthService } from '../services/health.service'
import { ConnectivityCheckService } from '../services/connectivity-check.service'
import type { ConnectivityCheckServiceConfig } from '../services/connectivity-check.service'
import { HealthController } from '../controllers/health.controller'
import { createHealthReadyRoutes } from '../routes/health.routes'
import { AuthController } from '../controllers/auth.controller'
import { OtpController } from '../controllers/otp.controller'
import { MockOtpProvider } from '../providers/mock-otp.provider'
import { Msg91OtpProvider } from '../providers/msg91-otp.provider'
import { Msg91WhatsappOtpProvider, WhatsappNotificationProvider, WHATSAPP_TEMPLATE_ENV_KEY } from '../providers/whatsapp'
import { ResendEmailProvider } from '../providers/resend-email.provider'
import { NodemailerEmailProvider } from '../providers/nodemailer-email.provider'
import { MockEmailProvider } from '../providers/mock-email.provider'
import { FirebaseAuthService } from '../services/firebase-auth.service'
import { FirebaseAuthController } from '../controllers/firebase-auth.controller'
import { createFirebaseAuthRoutes } from '../routes/firebase-auth.routes'
import { getFirebaseAuth } from './firebase'
import { DestinationController } from '../controllers/destination.controller'
import { TripController } from '../controllers/trip.controller'
import { UploadController } from '../controllers/upload.controller'
import { createAuthMiddleware } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import { createAuthRoutes } from '../routes/auth.routes'
import { createDestinationRoutes } from '../routes/destination.routes'
import { createTripRoutes } from '../routes/trip.routes'
import { createUploadRoutes } from '../routes/upload.routes'
import { BookingService } from '../services/booking.service'
import { PaymentService } from '../services/payment.service'
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import { WebhookEventRepository } from '../repositories/webhook-event.repository'
import { RazorpayGateway } from '../providers/payment/razorpay.gateway'
import { CashfreeGateway } from '../providers/payment/cashfree.gateway'
import { MockPaymentGateway } from '../providers/payment/mock-payment.gateway'
import type { IPaymentGateway } from '../providers/payment/payment-gateway.interface'
import type { PaymentProvider } from '../types/payment.types'
import { cashfreeConfig, isCashfreeConfigured } from './cashfree'
import { PAYMENT_PROVIDER } from '@shared/constants'
import { BookingController } from '../controllers/booking.controller'
import { WebhookController } from '../controllers/webhook.controller'
import { createBookingRoutes } from '../routes/booking.routes'
import { createWebhookRoutes } from '../routes/webhook.routes'
import { PaymentHistoryService } from '../services/payment-history.service'
import { PaymentHistoryController } from '../controllers/payment-history.controller'
import { createPaymentRoutes } from '../routes/payment.routes'
import { ReviewRepository } from '../repositories/review.repository'
import { WalletRepository } from '../repositories/wallet.repository'
import { ConversationRepository } from '../repositories/conversation.repository'
import { MessageRepository } from '../repositories/message.repository'
import { ReviewService } from '../services/review.service'
import { WalletService } from '../services/wallet.service'
import { ChatService } from '../services/chat.service'
import { ReviewController } from '../controllers/review.controller'
import { WalletController } from '../controllers/wallet.controller'
import { ChatController } from '../controllers/chat.controller'
import { createReviewRoutes } from '../routes/review.routes'
import { createWalletRoutes } from '../routes/wallet.routes'
import { createChatRoutes } from '../routes/chat.routes'
import { TripLifecycleService } from '../services/trip-lifecycle.service'
import { PayoutService } from '../services/payout.service'
import { OrganizerPayoutAttemptRepository } from '../repositories/organizer-payout-attempt.repository'
import { NotificationRepository } from '../repositories/notification.repository'
import { AdminService } from '../services/admin.service'
import { AdminController } from '../controllers/admin.controller'
import { createAdminRoutes } from '../routes/admin.routes'
import { razorpayClient } from './razorpay'
import Razorpay from 'razorpay'
import { RazorpayXClient } from '../providers/payout/razorpayx.client'
import { NotificationService } from '../services/notification.service'
import { InAppNotificationProvider } from '../providers/in-app-notification.provider'
import { EmailNotificationProvider } from '../providers/email-notification.provider'
import { SmsNotificationProvider } from '../providers/sms-notification.provider'
import { PushNotificationProvider } from '../providers/push-notification.provider'
import { NotificationController } from '../controllers/notification.controller'
import { createNotificationRoutes } from '../routes/notification.routes'
import { DocumentReviewRepository } from '../repositories/document-review.repository'
import { VehicleRepository } from '../repositories/vehicle.repository'
import { VehicleService } from '../services/vehicle.service'
import { VehicleController } from '../controllers/vehicle.controller'
import { createVehicleRoutes } from '../routes/vehicle.routes'
import { TripCategoryRepository } from '../repositories/trip-category.repository'
import { OrganizerInviteRepository } from '../repositories/organizer-invite.repository'
import { WhatsappBroadcastRepository } from '../repositories/whatsapp-broadcast.repository'
import { TripCategoryService } from '../services/trip-category.service'
import { WhatsappBroadcastService } from '../services/whatsapp-broadcast.service'
import { TripCategoryController } from '../controllers/trip-category.controller'
import { WhatsappBroadcastController } from '../controllers/whatsapp-broadcast.controller'
import { createPublicTripCategoryRoutes, createAdminTripCategoryRoutes, createOrganizerTripTypeRequestRoutes } from '../routes/trip-category.routes'
import { CacheService } from '../services/cache.service'
import { redis } from './redis'
import { LoginAttemptTracker } from '../utils/login-attempt-tracker'
import { SitemapService } from '../services/sitemap.service'
import { BookingVelocityStrategy } from '../services/trending/booking-velocity.strategy'
import { TrendingScoreService } from '../services/trending/trending-score.service'
import { ResellerRepository } from '../repositories/reseller.repository'
import { ResellerService } from '../services/reseller.service'
import { ResellerController } from '../controllers/reseller.controller'
import { createResellerRoutes } from '../routes/reseller.routes'
import { OrganizerLeadRepository } from '../repositories/organizer-lead.repository'
import { OrganizerLeadService } from '../services/organizer-lead.service'
import { OrganizerLeadController } from '../controllers/organizer-lead.controller'
import { createPublicOrganizerLeadRoutes, createAdminOrganizerLeadRoutes } from '../routes/organizer-lead.routes'

// JWT secrets are validated at startup by config/env.ts (min 32 chars)
const { JWT_SECRET } = env

// ── Repositories ─────────────────────────────────────
const userRepo = new UserRepository(prisma)
const refreshTokenRepo = new RefreshTokenRepository(prisma)
const destinationRepo = new DestinationRepository(prisma)
const tripRepo = new TripRepository(prisma)
const organizerProfileRepo = new OrganizerProfileRepository(prisma)
const tripEditHistoryRepo = new TripEditHistoryRepository(prisma)
const bookingRepo = new BookingRepository(prisma)
const tripRequestRepo = new TripRequestRepository(prisma)
const paymentTxRepo = new PaymentTransactionRepository(prisma)
const webhookEventRepo = new WebhookEventRepository(prisma)
const verifCodeRepo = new VerificationCodeRepository(prisma)
const reviewRepo = new ReviewRepository(prisma)
const walletRepo = new WalletRepository(prisma)
const conversationRepo = new ConversationRepository(prisma)
const messageRepo = new MessageRepository(prisma)
const notificationRepo = new NotificationRepository(prisma)
const vehicleRepo = new VehicleRepository(prisma)
const docReviewRepo = new DocumentReviewRepository(prisma)
const tripCategoryRepo = new TripCategoryRepository(prisma)
const organizerInviteRepo = new OrganizerInviteRepository(prisma)
const whatsappBroadcastRepo = new WhatsappBroadcastRepository(prisma)
const resellerRepo = new ResellerRepository(prisma)
const organizerPayoutAttemptRepo = new OrganizerPayoutAttemptRepository(prisma)
const organizerLeadRepo = new OrganizerLeadRepository(prisma)

// ── Cache ───────────────────────────────────────────
export const cacheService = new CacheService(redis, logger)

// ── Security ────────────────────────────────────────
const loginAttemptTracker = new LoginAttemptTracker(redis)

// ── Socket.IO (lazy) ────────────────────────────────
// Instance is set via setIoInstance() after the HTTP server starts; services
// that broadcast must read it through the getter, never capture it directly.
let ioInstance: import('socket.io').Server | null = null
export function setIoInstance(io: import('socket.io').Server) { ioInstance = io }
const getIo = () => ioInstance

// ── Services ─────────────────────────────────────────
const destinationService = new DestinationService(destinationRepo, tripRepo, logger, cacheService)
const uploadService = new UploadService()
// ── Payment gateway registry (Strategy + Factory pattern) ────
// Build a registry of all configured gateways. The active gateway is selected
// by env.PAYMENT_GATEWAY (default: 'razorpay').
// The registry also allows routing refunds/escrow-releases/webhooks to the
// gateway that originally created a transaction — critical for cutover correctness.
const gatewayRegistry = new Map<PaymentProvider, IPaymentGateway>()

if (razorpayClient) {
  gatewayRegistry.set(
    PAYMENT_PROVIDER.RAZORPAY,
    new RazorpayGateway(
      razorpayClient,
      env.RAZORPAY_KEY_SECRET || '',
      env.RAZORPAY_WEBHOOK_SECRET || '',
      env.RAZORPAY_KEY_ID || '',
      logger,
    ),
  )
}

if (isCashfreeConfigured() && cashfreeConfig) {
  gatewayRegistry.set(PAYMENT_PROVIDER.CASHFREE, new CashfreeGateway(cashfreeConfig, logger))
}

// RazorpayX Payouts — standalone client, explicitly NOT added to gatewayRegistry
// (not an IPaymentGateway; see providers/payout/razorpayx.client.ts). Uses a SEPARATE
// SDK instance built from RAZORPAYX_KEY_ID/SECRET — its own signup, its own key pair,
// distinct from the razorpayClient (PG) instance above. NOT YET LIVE — dormant until a
// RazorpayX account exists; see docs/codebase/Payments & Webhooks.md.
//
// LOW-2 fix: this only requires KEY_ID + ACCOUNT_NUMBER to construct the client at all
// (KEY_SECRET/WEBHOOK_SECRET fall back to '' below) — env.ts's superRefine gate (H3)
// already fails the boot in every environment when PAYOUT_STRATEGY=razorpayx_payouts
// (the default) and any of the four RAZORPAYX_* vars is missing, so a bare '' fallback
// should be unreachable in practice. Still warn here as defense-in-depth: a partial
// config (e.g. someone bypasses env.ts in a test harness, or a future PAYOUT_STRATEGY
// value stops requiring all four) must never silently produce a client with an empty
// secret instead of failing loudly.
if (env.RAZORPAYX_KEY_ID && env.RAZORPAYX_ACCOUNT_NUMBER && (!env.RAZORPAYX_KEY_SECRET || !env.RAZORPAYX_WEBHOOK_SECRET)) {
  logger.warn(
    { hasKeySecret: !!env.RAZORPAYX_KEY_SECRET, hasWebhookSecret: !!env.RAZORPAYX_WEBHOOK_SECRET },
    'RazorpayX Payouts partially configured (RAZORPAYX_KEY_ID + RAZORPAYX_ACCOUNT_NUMBER set) but RAZORPAYX_KEY_SECRET and/or RAZORPAYX_WEBHOOK_SECRET is missing — constructing the client with an empty secret, which will fail every real API call/webhook verification',
  )
}
export const razorpayxClient: RazorpayXClient | null = (env.RAZORPAYX_KEY_ID && env.RAZORPAYX_ACCOUNT_NUMBER)
  ? new RazorpayXClient(
      new Razorpay({ key_id: env.RAZORPAYX_KEY_ID, key_secret: env.RAZORPAYX_KEY_SECRET || '' }),
      env.RAZORPAYX_ACCOUNT_NUMBER,
      env.RAZORPAYX_WEBHOOK_SECRET || '',
      logger,
    )
  : null

// Constructed early (only needs walletRepo + logger) so it can be injected into
// paymentService/payoutService below without a circular dependency.
export const walletService = new WalletService(walletRepo, logger)

const activeProvider: PaymentProvider = env.PAYMENT_GATEWAY
export const activeGateway = gatewayRegistry.get(activeProvider)
  ?? (!isProduction
    ? (() => {
        logger.warn(`No gateway configured for provider="${activeProvider}" — using MockPaymentGateway. Payments will be simulated.`)
        return new MockPaymentGateway(logger)
      })()
    : (() => { throw new Error(`PAYMENT_GATEWAY=${activeProvider} selected but not configured. Check RAZORPAY_KEY_ID/CASHFREE_APP_ID env vars.`) })())

const paymentService = new PaymentService(
  activeGateway,
  gatewayRegistry,
  paymentTxRepo,
  webhookEventRepo,
  logger,
  razorpayxClient,
  walletService,
)

const paymentHistoryService = new PaymentHistoryService(paymentTxRepo, tripRepo, organizerProfileRepo, logger)
const reviewService = new ReviewService(reviewRepo, organizerProfileRepo, logger, cacheService)
export const chatService = new ChatService(conversationRepo, messageRepo, tripRepo, organizerProfileRepo, logger, getIo)
// tripLifecycleService is constructed after notificationService — see below
export const vehicleService = new VehicleService(vehicleRepo, tripRepo, organizerProfileRepo, logger)

const waOtpConfigured = !!(env.MSG91_AUTH_KEY && env.MSG91_WA_BUSINESS_NUMBER && env.MSG91_WA_OTP_TEMPLATE)
const preferWhatsappOtp = env.MSG91_WA_OTP_PREFER === 'true'

const smsOtpConfigured = !!(env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID)

// Surface silent misconfiguration at boot instead of letting it look like a runtime bug:
// operators frequently set the three MSG91_WA_* WhatsApp OTP vars and assume OTPs will
// go out over WhatsApp, forgetting MSG91_WA_OTP_PREFER also has to be "true" — without
// this log every OTP send just quietly uses SMS with no indication why.
if (waOtpConfigured && !preferWhatsappOtp) {
  logger.warn(
    { MSG91_WA_OTP_PREFER: env.MSG91_WA_OTP_PREFER ?? null },
    'WhatsApp OTP is fully configured (business number + template) but MSG91_WA_OTP_PREFER is not "true" — OTPs will be sent via SMS, not WhatsApp',
  )
} else if (!waOtpConfigured && preferWhatsappOtp) {
  logger.warn(
    'MSG91_WA_OTP_PREFER="true" but WhatsApp OTP is not fully configured (need MSG91_AUTH_KEY + MSG91_WA_BUSINESS_NUMBER + MSG91_WA_OTP_TEMPLATE) — falling back to SMS/mock',
  )
}

export const otpProvider = waOtpConfigured && preferWhatsappOtp
  ? new Msg91WhatsappOtpProvider(
      env.MSG91_AUTH_KEY!,
      env.MSG91_WA_BUSINESS_NUMBER!,
      env.MSG91_WA_OTP_TEMPLATE!,
      logger,
    )
  : smsOtpConfigured
    ? new Msg91OtpProvider(env.MSG91_AUTH_KEY!, env.MSG91_TEMPLATE_ID!, logger)
    : !isProduction
      ? new MockOtpProvider(logger)
      : (() => {
          throw new Error(
            'No OTP provider configured in production — set MSG91_AUTH_KEY + MSG91_TEMPLATE_ID (SMS) or MSG91_AUTH_KEY + MSG91_WA_BUSINESS_NUMBER + MSG91_WA_OTP_TEMPLATE (WhatsApp). Refusing to fall back to MockOtpProvider.',
          )
        })()

const smtpConfigured = !!(env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS))

// Warns only when a real email provider is active — a missing SUPPORT_EMAIL/RESEND_FROM
// is irrelevant noise when MockEmailProvider (no configured provider) is what's actually sending.
function resolveWithWarning(value: string | undefined, fallback: string, warningIfMissing: string): string {
  if (!value && smtpConfigured) {
    logger.warn(warningIfMissing)
  }
  return value || fallback
}

const supportEmailReplyTo = resolveWithWarning(
  env.SUPPORT_EMAIL,
  DEFAULT_SUPPORT_EMAIL,
  `SUPPORT_EMAIL not set — falling back to ${DEFAULT_SUPPORT_EMAIL} as the email reply-to address`,
)

export const emailProvider = env.RESEND_API_KEY
  ? new ResendEmailProvider(
      env.RESEND_API_KEY,
      resolveWithWarning(
        env.RESEND_FROM,
        `${env.APP_NAME} <onboarding@resend.dev>`,
        'RESEND_FROM not set — falling back to Resend\'s shared sandbox domain, which hurts deliverability',
      ),
      supportEmailReplyTo,
      logger,
    )
  : env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS
    ? new NodemailerEmailProvider(
        { host: env.SMTP_HOST, port: env.SMTP_PORT, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } },
        env.SMTP_FROM || `${env.APP_NAME} <${env.SMTP_USER}>`,
        supportEmailReplyTo,
        logger,
      )
    : new MockEmailProvider(logger)

export const authService = new AuthService(
  userRepo,
  refreshTokenRepo,
  organizerProfileRepo,
  walletRepo,
  JWT_SECRET,
  logger,
  env.GOOGLE_CLIENT_ID,
  loginAttemptTracker,
  docReviewRepo,
  organizerInviteRepo,
  smtpConfigured ? emailProvider : null,
  activeGateway,
  razorpayxClient,
)

// ── Notification Channel Providers ──────────────────
const inAppProvider = new InAppNotificationProvider(notificationRepo, getIo, logger)
const emailNotifProvider = new EmailNotificationProvider(emailProvider, logger)
const smsProvider = new SmsNotificationProvider(logger)
const pushProvider = new PushNotificationProvider(logger)

// Build WhatsApp template map — only types that have a configured template are included.
// Uses the validated env object via a typed cast; keys are dynamic so direct property
// access isn't possible, but Zod has already validated and coerced all values.
const whatsappTemplateMap: Partial<Record<string, string>> = {}
for (const [notifType, envKey] of Object.entries(WHATSAPP_TEMPLATE_ENV_KEY)) {
  const tplName = (env as unknown as Record<string, string | undefined>)[envKey]
  if (tplName) whatsappTemplateMap[notifType] = tplName
}

const waNotifConfigured = !!(env.MSG91_AUTH_KEY && env.MSG91_WA_BUSINESS_NUMBER)
const whatsappNotifProvider: WhatsappNotificationProvider | null = waNotifConfigured
  ? new WhatsappNotificationProvider(
      env.MSG91_AUTH_KEY!,
      env.MSG91_WA_BUSINESS_NUMBER!,
      whatsappTemplateMap,
      logger,
    )
  : null

export const notificationService = new NotificationService(
  notificationRepo, userRepo,
  [
    inAppProvider,
    emailNotifProvider,
    smsProvider,
    pushProvider,
    ...(whatsappNotifProvider ? [whatsappNotifProvider] : []),
  ],
  logger,
)

// Wire booking + notification into paymentService now that both are available.
// Cannot be constructor-injected because bookingService depends on paymentService,
// and notificationService is constructed after paymentService — late-bind avoids the cycle.
paymentService.setPostConstruct(bookingRepo, notificationService)

// Deposit/balance payout orchestration (Cashfree) + RazorpayX Payouts release —
// see services/payout.service.ts.
export const payoutService = new PayoutService(bookingRepo, paymentTxRepo, paymentService, logger, razorpayxClient, organizerProfileRepo, walletService, organizerPayoutAttemptRepo)

// Services that depend on notificationService (must be after it)
const tripLifecycleService = new TripLifecycleService(
  tripRepo, paymentTxRepo, paymentService, logger,
  notificationService, walletService, bookingRepo,
  payoutService, env.PAYOUT_STRATEGY,
)
export const tripCategoryService = new TripCategoryService(tripCategoryRepo, organizerProfileRepo, notificationService, logger, cacheService)
const otpService = new OtpService(verifCodeRepo, userRepo, authService, otpProvider, emailProvider, logger)
const bookingService = new BookingService(bookingRepo, tripRepo, tripRequestRepo, paymentTxRepo, paymentService, logger, notificationService, vehicleService, cacheService, userRepo, resellerRepo, otpService, walletService)
const resellerService = new ResellerService(resellerRepo, userRepo, organizerProfileRepo, tripRepo, logger)
const tripService = new TripService(tripRepo, destinationRepo, organizerProfileRepo, tripEditHistoryRepo, bookingRepo, tripRequestRepo, reviewRepo, logger, notificationService, tripCategoryService, cacheService)
const adminService = new AdminService(
  organizerProfileRepo, userRepo, bookingRepo, tripRepo,
  paymentTxRepo, messageRepo,
  walletRepo, walletService, logger, notificationService,
  docReviewRepo, reviewRepo, organizerInviteRepo,
  payoutService,
  organizerPayoutAttemptRepo,
)

// ── Middleware ────────────────────────────────────────
export const authMiddleware = createAuthMiddleware(authService)

// ── Controllers ──────────────────────────────────────
const authController = new AuthController(authService)
const otpController = new OtpController(otpService)
const destinationController = new DestinationController(destinationService)
const tripController = new TripController(tripService)
const uploadController = new UploadController(uploadService)
const bookingController = new BookingController(bookingService)
const paymentHistoryController = new PaymentHistoryController(paymentHistoryService)
const reviewController = new ReviewController(reviewService)
const walletController = new WalletController(walletService)
const chatController = new ChatController(chatService)
const notificationController = new NotificationController(notificationService)
const adminController = new AdminController(adminService, tripService)
const vehicleController = new VehicleController(vehicleService)
const tripCategoryController = new TripCategoryController(tripCategoryService)
const webhookController = new WebhookController(paymentService, bookingService)
const whatsappBroadcastService = new WhatsappBroadcastService(
  whatsappBroadcastRepo,
  userRepo,
  whatsappNotifProvider,
  logger,
)
const whatsappBroadcastController = new WhatsappBroadcastController(whatsappBroadcastService)
const resellerController = new ResellerController(resellerService)
const organizerLeadService = new OrganizerLeadService(organizerLeadRepo, logger)
const organizerLeadController = new OrganizerLeadController(organizerLeadService)

// ── Routes ───────────────────────────────────────────
export const authRoutes = createAuthRoutes(authController, otpController, authMiddleware, requireRole)

// Firebase auth routes — only created if Firebase Admin SDK is configured
const firebaseAuth = getFirebaseAuth()
export const firebaseAuthRoutes = firebaseAuth
  ? (() => {
      const firebaseAuthService = new FirebaseAuthService(firebaseAuth, userRepo, authService, logger)
      const firebaseAuthController = new FirebaseAuthController(firebaseAuthService)
      return createFirebaseAuthRoutes(firebaseAuthController)
    })()
  : null
export const destinationRoutes = createDestinationRoutes(destinationController, authMiddleware, requireRole)
export const tripRoutes = createTripRoutes(tripController, authMiddleware, requireRole)
export const uploadRoutes = createUploadRoutes(uploadController, authMiddleware, requireRole)
export const bookingRoutes = createBookingRoutes(bookingController, authMiddleware, requireRole)
export const paymentRoutes = createPaymentRoutes(paymentHistoryController, authMiddleware, requireRole)
export const reviewRoutes = createReviewRoutes(reviewController, authMiddleware, requireRole)
export const walletRoutes = createWalletRoutes(walletController, authMiddleware, requireRole)
export const chatRoutes = createChatRoutes(chatController, authMiddleware, requireRole)
export const notificationRoutes = createNotificationRoutes(notificationController, authMiddleware, requireRole)
export const adminRoutes = createAdminRoutes(adminController, authMiddleware, requireRole, whatsappBroadcastController)
export const vehicleRoutes = createVehicleRoutes(vehicleController, authMiddleware, requireRole)
export const publicTripCategoryRoutes = createPublicTripCategoryRoutes(tripCategoryController)
export const adminTripCategoryRoutes = createAdminTripCategoryRoutes(tripCategoryController, authMiddleware, requireRole)
export const organizerTripTypeRequestRoutes = createOrganizerTripTypeRequestRoutes(tripCategoryController, authMiddleware, requireRole)
export const resellerRoutes = createResellerRoutes(resellerController, authMiddleware, requireRole)
export const publicOrganizerLeadRoutes = createPublicOrganizerLeadRoutes(organizerLeadController)
export const adminOrganizerLeadRoutes = createAdminOrganizerLeadRoutes(organizerLeadController, authMiddleware, requireRole)

// ── Deep readiness probe (GET /api/v1/health/ready) — guarded, side-effect-free ──
// ConnectivityCheckService is built directly from the raw, already-configured
// credentials/config above (NOT via IPaymentGateway/IEmailProvider/IOtpProvider —
// those are business-logic interfaces and must stay free of health-check concerns).
// Each branch below mirrors the exact gating already used to construct the real
// gateway/provider objects, so the readiness probe's behavior is unchanged.
const connectivityCheckConfig: ConnectivityCheckServiceConfig = {
  cloudinary: (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)
    ? { cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, apiSecret: env.CLOUDINARY_API_SECRET }
    : null,
  paymentGateway: {
    provider: activeProvider,
    razorpay: razorpayClient
      ? { keyId: env.RAZORPAY_KEY_ID || '', keySecret: env.RAZORPAY_KEY_SECRET || '' }
      : null,
    cashfree: (isCashfreeConfigured() && cashfreeConfig) ? cashfreeConfig : null,
  },
  email: env.RESEND_API_KEY
    ? { kind: 'resend', apiKey: env.RESEND_API_KEY }
    : (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS)
      ? { kind: 'smtp' }
      : { kind: 'mock' },
  otp: ((waOtpConfigured && preferWhatsappOtp) || smsOtpConfigured)
    ? { kind: 'msg91', authKey: env.MSG91_AUTH_KEY! }
    : { kind: 'mock' },
}
const connectivityCheckService = new ConnectivityCheckService(connectivityCheckConfig, logger)
const healthService = new HealthService(connectivityCheckService, logger)
const healthController = new HealthController(healthService)
export const healthReadyRoutes = createHealthReadyRoutes(healthController)
export const webhookRoutes = (() => {
  if (!webhookController) return null
  const razorpaySecret = env.RAZORPAY_WEBHOOK_SECRET || ''
  const cashfreeSecret = env.CASHFREE_WEBHOOK_SECRET || ''
  const razorpayxSecret = env.RAZORPAYX_WEBHOOK_SECRET || ''
  if (!razorpaySecret && !cashfreeSecret && !razorpayxSecret) {
    logger.warn('No webhook secrets configured (RAZORPAY_WEBHOOK_SECRET / CASHFREE_WEBHOOK_SECRET / RAZORPAYX_WEBHOOK_SECRET) — webhook routes will NOT be mounted.')
    return null
  }
  return createWebhookRoutes(webhookController, razorpaySecret, cashfreeSecret, razorpayxSecret)
})()

// ── Sitemap Service ──────────────────────────────────
export const sitemapService = new SitemapService(tripRepo, destinationRepo, organizerProfileRepo)

// ── Trending Score Pipeline ───────────────────────────
const bookingVelocityStrategy = new BookingVelocityStrategy(bookingRepo)
export const trendingScoreService = new TrendingScoreService(bookingVelocityStrategy, tripRepo, logger)

// ── Cron Job Dependencies ────────────────────────────
// Scoped export for background jobs — keeps raw repos private to this module
export const cronDeps = {
  bookingRepo,
  tripRequestRepo,
  refreshTokenRepo,
  verifCodeRepo,
  webhookEventRepo,
  paymentTxRepo,
  paymentService,
  bookingService,
  tripLifecycleService,
  payoutService,
  vehicleService,
  walletService,
  notificationService,
  trendingScoreService,
} as const

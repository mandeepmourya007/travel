import { prisma } from '../lib/prisma'
import { env } from './env'
import { logger } from '../utils/logger'
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
import { AuthController } from '../controllers/auth.controller'
import { OtpController } from '../controllers/otp.controller'
import { MockOtpProvider } from '../providers/mock-otp.provider'
import { Msg91OtpProvider } from '../providers/msg91-otp.provider'
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
import { MockPaymentService } from '../services/mock-payment.service'
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import { WebhookEventRepository } from '../repositories/webhook-event.repository'
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
import { NotificationRepository } from '../repositories/notification.repository'
import { AdminService } from '../services/admin.service'
import { AdminController } from '../controllers/admin.controller'
import { createAdminRoutes } from '../routes/admin.routes'
import { razorpayClient } from './razorpay'
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
import { TripCategoryService } from '../services/trip-category.service'
import { TripCategoryController } from '../controllers/trip-category.controller'
import { createPublicTripCategoryRoutes, createAdminTripCategoryRoutes, createOrganizerTripTypeRequestRoutes } from '../routes/trip-category.routes'
import { CacheService } from '../services/cache.service'
import { redis } from './redis'
import { LoginAttemptTracker } from '../utils/login-attempt-tracker'
import { SitemapService } from '../services/sitemap.service'

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
const paymentService = razorpayClient
  ? new PaymentService(
      razorpayClient,
      paymentTxRepo,
      webhookEventRepo,
      env.RAZORPAY_KEY_SECRET || '',
      logger,
    )
  : env.NODE_ENV !== 'production'
    ? (() => {
        logger.warn('Using MockPaymentService — Razorpay not configured. Payments will be simulated.')
        return new MockPaymentService(paymentTxRepo, webhookEventRepo, logger)
      })()
    : (() => { throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production') })()

const paymentHistoryService = new PaymentHistoryService(paymentTxRepo, tripRepo, organizerProfileRepo, logger)
const reviewService = new ReviewService(reviewRepo, organizerProfileRepo, logger, cacheService)
export const walletService = new WalletService(walletRepo, logger)
export const chatService = new ChatService(conversationRepo, messageRepo, tripRepo, organizerProfileRepo, logger, getIo)
// tripLifecycleService is constructed after notificationService — see below
export const vehicleService = new VehicleService(vehicleRepo, tripRepo, organizerProfileRepo, logger)

const otpProvider = env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID
  ? new Msg91OtpProvider(env.MSG91_AUTH_KEY, env.MSG91_TEMPLATE_ID, logger)
  : new MockOtpProvider(logger)

logger.info(
  {
    SMTP_HOST: env.SMTP_HOST ?? '(unset)',
    SMTP_PORT: env.SMTP_PORT ?? '(unset)',
    SMTP_USER: env.SMTP_USER ?? '(unset)',
    SMTP_PASS: env.SMTP_PASS ? `${env.SMTP_PASS.slice(0, 3)}***` : '(unset)',
    SMTP_FROM: env.SMTP_FROM ?? '(unset)',
  },
  'SMTP config',
)

export const emailProvider = env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS
  ? new NodemailerEmailProvider(
      { host: env.SMTP_HOST, port: env.SMTP_PORT, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } },
      env.SMTP_FROM || `Safarnama <${env.SMTP_USER}>`,
      logger,
    )
  : new MockEmailProvider(logger)

const smtpConfigured = !!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS)

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
)

// ── Notification Channel Providers ──────────────────
const inAppProvider = new InAppNotificationProvider(notificationRepo, getIo, logger)
const emailNotifProvider = new EmailNotificationProvider(emailProvider, logger)
const smsProvider = new SmsNotificationProvider(logger)
const pushProvider = new PushNotificationProvider(logger)

export const notificationService = new NotificationService(
  notificationRepo, userRepo,
  [inAppProvider, emailNotifProvider, smsProvider, pushProvider],
  logger,
)

// Services that depend on notificationService (must be after it)
const tripLifecycleService = new TripLifecycleService(
  tripRepo, paymentTxRepo, paymentService, logger,
  notificationService, walletService, bookingRepo,
)
export const tripCategoryService = new TripCategoryService(tripCategoryRepo, organizerProfileRepo, notificationService, logger, cacheService)
const bookingService = new BookingService(bookingRepo, tripRepo, tripRequestRepo, paymentTxRepo, paymentService, logger, notificationService, vehicleService, cacheService)
const tripService = new TripService(tripRepo, destinationRepo, organizerProfileRepo, tripEditHistoryRepo, bookingRepo, tripRequestRepo, reviewRepo, logger, notificationService, tripCategoryService, cacheService)
const adminService = new AdminService(
  organizerProfileRepo, userRepo, bookingRepo, tripRepo,
  paymentTxRepo, messageRepo,
  walletRepo, walletService, logger, notificationService,
  docReviewRepo, organizerInviteRepo,
)

const otpService = new OtpService(verifCodeRepo, userRepo, authService, otpProvider, emailProvider, logger)

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
const adminController = new AdminController(adminService)
const vehicleController = new VehicleController(vehicleService)
const tripCategoryController = new TripCategoryController(tripCategoryService)
const webhookController = new WebhookController(paymentService, bookingService)

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
export const adminRoutes = createAdminRoutes(adminController, authMiddleware, requireRole)
export const vehicleRoutes = createVehicleRoutes(vehicleController, authMiddleware, requireRole)
export const publicTripCategoryRoutes = createPublicTripCategoryRoutes(tripCategoryController)
export const adminTripCategoryRoutes = createAdminTripCategoryRoutes(tripCategoryController, authMiddleware, requireRole)
export const organizerTripTypeRequestRoutes = createOrganizerTripTypeRequestRoutes(tripCategoryController, authMiddleware, requireRole)
export const webhookRoutes = (() => {
  if (!webhookController) return null
  const secret = env.RAZORPAY_WEBHOOK_SECRET || ''
  if (!secret) {
    logger.warn('RAZORPAY_WEBHOOK_SECRET is not set — webhook routes will NOT be mounted. Set it to accept Razorpay callbacks.')
    return null
  }
  return createWebhookRoutes(webhookController, secret)
})()

// ── Sitemap Service ──────────────────────────────────
export const sitemapService = new SitemapService(tripRepo, destinationRepo, organizerProfileRepo)

// ── Cron Job Dependencies ────────────────────────────
// Scoped export for background jobs — keeps raw repos private to this module
export const cronDeps = {
  bookingRepo,
  tripRequestRepo,
  refreshTokenRepo,
  verifCodeRepo,
  paymentService,
  tripLifecycleService,
  vehicleService,
  walletService,
  notificationService,
} as const

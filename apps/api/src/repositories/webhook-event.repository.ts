import type { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

export class WebhookEventRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Records an incoming webhook event with all generic fields.
   *
   * Used by: PaymentService.handleWebhook() — first step before processing
   *
   * Edge case: Throws on duplicate (source + externalEventId) — caller checks idempotency first
   */
  async create(data: {
    source: string
    externalEventId: string
    eventType: string
    referenceModel?: string | null
    referenceId?: string | null
    externalId?: string | null
    headers?: Prisma.InputJsonValue
    payload: Prisma.InputJsonValue
    response?: Prisma.InputJsonValue
    status?: string
    mode?: string
    failureReason?: string | null
  }) {
    return this.prisma.webhookEvent.create({ data })
  }

  /**
   * Idempotency check — finds existing webhook by source + provider event ID.
   *
   * Used by: PaymentService.handleWebhook() — reject duplicate events
   * Backed by: @@unique([source, externalEventId])
   *
   * @returns The existing event or null
   */
  async findBySourceAndEventId(source: string, externalEventId: string) {
    return this.prisma.webhookEvent.findUnique({
      where: { source_externalEventId: { source, externalEventId } },
    })
  }

  /**
   * Idempotent create: inserts the webhook event or, on duplicate
   * (source + externalEventId), increments the attempts counter.
   *
   * Replaces the find-then-create pattern, eliminating the TOCTOU race
   * where concurrent duplicate deliveries could both pass the find check and
   * then race on the create — causing an unhandled P2002.
   *
   * Returns the upserted row; callers check `attempts > 1` to detect duplicates.
   */
  async upsertBySourceAndEventId(data: {
    source: string
    externalEventId: string
    eventType: string
    referenceModel?: string | null
    referenceId?: string | null
    externalId?: string | null
    headers?: Prisma.InputJsonValue
    payload: Prisma.InputJsonValue
    response?: Prisma.InputJsonValue
    status?: string
    mode?: string
    failureReason?: string | null
  }) {
    return this.prisma.webhookEvent.upsert({
      where: { source_externalEventId: { source: data.source, externalEventId: data.externalEventId } },
      create: { ...data, attempts: 1 },
      update: { attempts: { increment: 1 } },
    })
  }

  /**
   * Finds all webhook events for an internal entity (polymorphic lookup).
   *
   * Used by: Admin dashboard — "show all webhooks for Booking X"
   * Backed by: @@index([referenceModel, referenceId])
   */
  async findByReference(referenceModel: string, referenceId: string) {
    return this.prisma.webhookEvent.findMany({
      where: { referenceModel, referenceId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Finds a webhook event by external entity ID (e.g., razorpay_payment_id).
   *
   * Used by: Reconciliation
   * Backed by: @@index([externalId])
   */
  async findByExternalId(externalId: string) {
    return this.prisma.webhookEvent.findFirst({
      where: { externalId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Transitions webhook processing status: RECEIVED→PROCESSING→COMPLETED|FAILED|SKIPPED.
   *
   * Used by: PaymentService.processWebhookEvent()
   */
  async updateStatus(
    id: string,
    status: string,
    extras?: {
      response?: Prisma.InputJsonValue
      processedAt?: Date
      failureReason?: string
    },
  ) {
    return this.prisma.webhookEvent.update({
      where: { id },
      data: { status, ...extras },
    })
  }

  /**
   * Increments attempt counter on duplicate webhook receipt (retry tracking).
   *
   * Used by: PaymentService.handleWebhook() — when idempotency check finds existing
   */
  async incrementAttempts(id: string) {
    return this.prisma.webhookEvent.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    })
  }

  /**
   * Finds FAILED webhook events for admin retry queue.
   *
   * Used by: Admin dashboard / manual retry
   *
   * @param source Optional filter by provider (e.g., 'RAZORPAY')
   * @param limit Max results (default 50)
   */
  async findFailedEvents(source?: string, limit = 50) {
    return this.prisma.webhookEvent.findMany({
      where: {
        status: 'FAILED',
        ...(source && { source }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}

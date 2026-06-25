import { DocumentReviewStatus } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

/** Mirrors Prisma DocumentReviewComment columns — avoids leaking Prisma types into the service layer */
export interface DocumentReviewCommentRow {
  id: string
  organizerId: string
  authorId: string
  authorRole: string
  docType: string | null
  comment: string
  attachmentUrl: string | null
  createdAt: Date
}

export class DocumentReviewRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async findByOrganizerId(organizerId: string) {
    return this.prisma.documentReview.findMany({
      where: { organizerId },
      orderBy: { docType: 'asc' },
    })
  }

  async upsert(
    organizerId: string,
    docType: string,
    data: { status?: DocumentReviewStatus; currentUrl?: string; reviewedAt?: Date; reviewedBy?: string },
  ) {
    return this.prisma.documentReview.upsert({
      where: { organizerId_docType: { organizerId, docType } },
      create: {
        organizerId,
        docType,
        status: data.status ?? DocumentReviewStatus.PENDING,
        currentUrl: data.currentUrl,
        reviewedAt: data.reviewedAt,
        reviewedBy: data.reviewedBy,
      },
      update: {
        status: data.status,
        currentUrl: data.currentUrl,
        reviewedAt: data.reviewedAt,
        reviewedBy: data.reviewedBy,
      },
    })
  }

  /**
   * Upserts multiple document review rows in parallel.
   * All upserted docs are set to PENDING (re-uploaded docs reset review status).
   * Use instead of calling upsert() in a loop (sequential N DB round-trips → concurrent).
   * Not atomic: if one upsert throws after others have committed, the remaining docs
   * keep their previous status. For document reviews this is acceptable — the user
   * can re-upload to reset the failed doc.
   */
  async upsertMany(
    organizerId: string,
    docs: Array<{ docType: string; currentUrl: string }>,
  ): Promise<void> {
    await Promise.all(
      docs.map(({ docType, currentUrl }) =>
        this.upsert(organizerId, docType, {
          currentUrl,
          status: DocumentReviewStatus.PENDING,
          reviewedAt: undefined,
          reviewedBy: undefined,
        }),
      ),
    )
  }

  async countApproved(organizerId: string): Promise<number> {
    return this.prisma.documentReview.count({
      where: { organizerId, status: DocumentReviewStatus.APPROVED },
    })
  }

  async findComments(organizerId: string, pagination: { skip: number; take: number }) {
    const where = { organizerId }

    const [data, total] = await Promise.all([
      this.prisma.documentReviewComment.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.documentReviewComment.count({ where }),
    ])

    return { data, total }
  }

  async addComment(data: {
    organizerId: string
    authorId: string
    authorRole: string
    docType?: string
    comment: string
    attachmentUrl?: string
  }) {
    return this.prisma.documentReviewComment.create({ data })
  }

  async updateAllDocStatuses(organizerId: string, status: DocumentReviewStatus) {
    return this.prisma.documentReview.updateMany({
      where: { organizerId },
      data: { status, reviewedAt: new Date() },
    })
  }
}

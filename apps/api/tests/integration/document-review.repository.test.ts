import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { DocumentReviewRepository } from '../../src/repositories/document-review.repository'

/**
 * Integration test — runs against a real Postgres.
 * Catches Prisma query shape bugs that unit-test mocks silently pass.
 *
 * Run with: INTEGRATION_DB_URL=postgresql://... npx vitest run tests/integration/
 * Or inside Docker: docker compose exec api npx vitest run tests/integration/
 */

const DB_URL = process.env.INTEGRATION_DB_URL
  ?? process.env.DIRECT_URL
  ?? 'postgresql://travel_user:travel_pass@localhost:5432/travel_dev?schema=public'

let prisma: PrismaClient
let repo: DocumentReviewRepository
let canConnect = false

// ── Test data IDs (created in beforeAll, cleaned in afterAll) ──
let testUserId: string
let testOrganizerId: string

beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: DB_URL })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repo = new DocumentReviewRepository(prisma as any)

  try {
    await prisma.$connect()
    canConnect = true
  } catch {
    console.warn(`⚠ Skipping integration tests — cannot connect to DB at ${DB_URL.replace(/:[^@]+@/, ':***@')}`)
    return
  }

  // Seed a User + OrganizerProfile for FK constraints
  const user = await prisma.user.create({
    data: {
      name: 'Integration Test User',
      email: `integ-test-${Date.now()}@test.com`,
      role: 'ORGANIZER',
    },
  })
  testUserId = user.id

  const org = await prisma.organizerProfile.create({
    data: {
      userId: user.id,
      businessName: 'Test Org',
      slug: `test-org-${Date.now()}`,
    },
  })
  testOrganizerId = org.id
})

afterAll(async () => {
  if (!canConnect) return
  // Clean up test data (reverse order for FK constraints)
  await prisma.documentReviewComment.deleteMany({ where: { organizerId: testOrganizerId } })
  await prisma.documentReview.deleteMany({ where: { organizerId: testOrganizerId } })
  await prisma.organizerProfile.deleteMany({ where: { id: testOrganizerId } })
  await prisma.user.deleteMany({ where: { id: testUserId } })
  await prisma.$disconnect()
})

beforeEach(async () => {
  if (!canConnect) return
  // Clean doc reviews before each test to keep tests independent
  await prisma.documentReviewComment.deleteMany({ where: { organizerId: testOrganizerId } })
  await prisma.documentReview.deleteMany({ where: { organizerId: testOrganizerId } })
})

// ── Tests ─────────────────────────────────────────────

describe('DocumentReviewRepository (integration)', () => {
  describe('upsert', () => {
    it('creates a new DocumentReview when none exists', async () => {
      if (!canConnect) return
      const result = await repo.upsert(testOrganizerId, 'aadhaarFront', {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: 'admin_1',
      })

      expect(result.organizerId).toBe(testOrganizerId)
      expect(result.docType).toBe('aadhaarFront')
      expect(result.status).toBe('APPROVED')
      expect(result.reviewedBy).toBe('admin_1')
    })

    it('updates an existing DocumentReview on second call', async () => {
      if (!canConnect) return
      // First call — creates
      await repo.upsert(testOrganizerId, 'aadhaarBack', {
        status: 'PENDING',
      })

      // Second call — updates to REJECTED
      const result = await repo.upsert(testOrganizerId, 'aadhaarBack', {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: 'admin_2',
      })

      expect(result.status).toBe('REJECTED')
      expect(result.reviewedBy).toBe('admin_2')

      // Verify only 1 row exists (not 2)
      const rows = await prisma.documentReview.findMany({
        where: { organizerId: testOrganizerId, docType: 'aadhaarBack' },
      })
      expect(rows).toHaveLength(1)
    })

    it('handles all 3 doc types independently', async () => {
      if (!canConnect) return
      await repo.upsert(testOrganizerId, 'aadhaarFront', { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: 'a1' })
      await repo.upsert(testOrganizerId, 'aadhaarBack', { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: 'a1' })
      await repo.upsert(testOrganizerId, 'panCard', { status: 'PENDING' })

      const all = await repo.findByOrganizerId(testOrganizerId)
      expect(all).toHaveLength(3)

      const statuses = all.map((r) => r.status).sort()
      expect(statuses).toEqual(['APPROVED', 'PENDING', 'REJECTED'])
    })
  })

  describe('countApproved', () => {
    it('counts only APPROVED documents', async () => {
      if (!canConnect) return
      await repo.upsert(testOrganizerId, 'aadhaarFront', { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: 'a1' })
      await repo.upsert(testOrganizerId, 'aadhaarBack', { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: 'a1' })
      await repo.upsert(testOrganizerId, 'panCard', { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: 'a1' })

      const count = await repo.countApproved(testOrganizerId)
      expect(count).toBe(2)
    })
  })

  describe('addComment + findComments', () => {
    it('creates a comment and retrieves it', async () => {
      if (!canConnect) return
      await repo.addComment({
        organizerId: testOrganizerId,
        authorId: 'admin_1',
        authorRole: 'ADMIN',
        docType: 'aadhaarFront',
        comment: 'Please re-upload a clearer image',
      })

      const { data, total } = await repo.findComments(testOrganizerId, { skip: 0, take: 10 })

      expect(total).toBe(1)
      expect(data[0].comment).toBe('Please re-upload a clearer image')
      expect(data[0].authorRole).toBe('ADMIN')
      expect(data[0].docType).toBe('aadhaarFront')
    })

    it('paginates comments correctly', async () => {
      if (!canConnect) return
      // Create 3 comments
      for (let i = 0; i < 3; i++) {
        await repo.addComment({
          organizerId: testOrganizerId,
          authorId: `user_${i}`,
          authorRole: i === 0 ? 'ADMIN' : 'ORGANIZER',
          comment: `Comment ${i}`,
        })
      }

      const page1 = await repo.findComments(testOrganizerId, { skip: 0, take: 2 })
      expect(page1.data).toHaveLength(2)
      expect(page1.total).toBe(3)

      const page2 = await repo.findComments(testOrganizerId, { skip: 2, take: 2 })
      expect(page2.data).toHaveLength(1)
    })
  })

  describe('updateAllDocStatuses', () => {
    it('bulk-updates all doc review statuses', async () => {
      if (!canConnect) return
      await repo.upsert(testOrganizerId, 'aadhaarFront', { status: 'PENDING' })
      await repo.upsert(testOrganizerId, 'aadhaarBack', { status: 'PENDING' })
      await repo.upsert(testOrganizerId, 'panCard', { status: 'PENDING' })

      await repo.updateAllDocStatuses(testOrganizerId, 'REJECTED')

      const all = await repo.findByOrganizerId(testOrganizerId)
      expect(all.every((r) => r.status === 'REJECTED')).toBe(true)
    })
  })
})

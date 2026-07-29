import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { OrganizerLeadService } from '../../../src/services/organizer-lead.service'
import { logger } from '../../../src/utils/logger'
import { ConflictError, NotFoundError } from '../../../src/errors/app-error'

const mockRepo = {
  create: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findAllPaginated: vi.fn(),
  updateStatus: vi.fn(),
}

let service: OrganizerLeadService

const now = new Date('2026-01-01T00:00:00Z')

const sampleRow = {
  id: 'lead-1',
  fullName: 'Amit Sharma',
  email: 'amit@example.com',
  phone: '+919876543210',
  businessName: 'Wanderlust Tours',
  city: 'Mumbai',
  notes: null,
  status: 'NEW' as const,
  adminNotes: null,
  createdAt: now,
  updatedAt: now,
}

beforeEach(() => {
  vi.clearAllMocks()
  service = new OrganizerLeadService(mockRepo as any, logger as any)
})

describe('OrganizerLeadService.submit', () => {
  it('normalizes email + trims fields and persists lead', async () => {
    mockRepo.findByEmail.mockResolvedValue(null)
    mockRepo.create.mockResolvedValue(sampleRow)

    const result = await service.submit({
      fullName: '  Amit Sharma  ',
      email: '  Amit@Example.COM ',
      phone: ' +919876543210 ',
      businessName: 'Wanderlust Tours',
      city: 'Mumbai',
    })

    expect(mockRepo.findByEmail).toHaveBeenCalledWith('amit@example.com')
    expect(mockRepo.create).toHaveBeenCalledWith({
      fullName: 'Amit Sharma',
      email: 'amit@example.com',
      phone: '+919876543210',
      businessName: 'Wanderlust Tours',
      city: 'Mumbai',
      notes: null,
    })
    expect(result.id).toBe('lead-1')
    expect(result.status).toBe('NEW')
    expect(result.createdAt).toBe(now.toISOString())
  })

  it('rejects duplicate email with ConflictError', async () => {
    mockRepo.findByEmail.mockResolvedValue(sampleRow)

    await expect(
      service.submit({
        fullName: 'Amit',
        email: 'amit@example.com',
        phone: '+919876543210',
      }),
    ).rejects.toBeInstanceOf(ConflictError)
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it('translates Prisma P2002 unique-violation race into ConflictError', async () => {
    // Fast-path check misses (returns null) but a concurrent request has already
    // inserted the row — Prisma throws P2002 on our create. Must surface the
    // same LEAD_ALREADY_SUBMITTED ConflictError, not a raw 500.
    mockRepo.findByEmail.mockResolvedValue(null)
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    })
    mockRepo.create.mockRejectedValue(p2002)

    await expect(
      service.submit({
        fullName: 'Amit',
        email: 'amit@example.com',
        phone: '+919876543210',
      }),
    ).rejects.toMatchObject({
      constructor: ConflictError,
      subCode: 'LEAD_ALREADY_SUBMITTED',
    })
  })

  it('rethrows non-P2002 Prisma errors as-is', async () => {
    mockRepo.findByEmail.mockResolvedValue(null)
    const otherErr = new Prisma.PrismaClientKnownRequestError('Connection lost', {
      code: 'P1001',
      clientVersion: 'test',
    })
    mockRepo.create.mockRejectedValue(otherErr)

    await expect(
      service.submit({
        fullName: 'Amit',
        email: 'amit@example.com',
        phone: '+919876543210',
      }),
    ).rejects.toBe(otherErr)
  })

  it('coerces empty optional strings to null', async () => {
    mockRepo.findByEmail.mockResolvedValue(null)
    mockRepo.create.mockResolvedValue({ ...sampleRow, businessName: null, city: null })

    await service.submit({
      fullName: 'Amit',
      email: 'amit@example.com',
      phone: '+919876543210',
      businessName: '',
      city: '',
      notes: '',
    })

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: null, city: null, notes: null }),
    )
  })
})

describe('OrganizerLeadService.listForAdmin', () => {
  it('returns paginated leads with computed totalPages', async () => {
    mockRepo.findAllPaginated.mockResolvedValue({ items: [sampleRow], total: 21 })

    const result = await service.listForAdmin({ page: 2, limit: 10 })

    expect(mockRepo.findAllPaginated).toHaveBeenCalledWith({
      status: undefined,
      search: undefined,
      page: 2,
      limit: 10,
    })
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 })
    expect(result.data[0].id).toBe('lead-1')
  })

  it('passes status filter to repository', async () => {
    mockRepo.findAllPaginated.mockResolvedValue({ items: [], total: 0 })

    await service.listForAdmin({ status: 'CONTACTED', search: 'amit' })

    expect(mockRepo.findAllPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CONTACTED', search: 'amit' }),
    )
  })
})

describe('OrganizerLeadService.updateStatus', () => {
  it('updates status and returns mapped item', async () => {
    mockRepo.findById.mockResolvedValue(sampleRow)
    mockRepo.updateStatus.mockResolvedValue({ ...sampleRow, status: 'CONTACTED', adminNotes: 'Called on Mon' })

    const result = await service.updateStatus('lead-1', {
      status: 'CONTACTED',
      adminNotes: 'Called on Mon',
    })

    expect(mockRepo.updateStatus).toHaveBeenCalledWith('lead-1', {
      status: 'CONTACTED',
      adminNotes: 'Called on Mon',
    })
    expect(result.status).toBe('CONTACTED')
    expect(result.adminNotes).toBe('Called on Mon')
  })

  it('throws NotFoundError when lead does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null)

    await expect(
      service.updateStatus('missing', { status: 'CONTACTED' }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(mockRepo.updateStatus).not.toHaveBeenCalled()
  })
})

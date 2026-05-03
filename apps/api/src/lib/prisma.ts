import { PrismaClient } from '@prisma/client'

const SOFT_DELETE_MODELS = [
  'User', 'OrganizerProfile', 'Destination', 'Trip', 'TripTransferPoint', 'Booking',
  'TravelerDetail', 'Review', 'Conversation', 'Message',
  'Notification', 'TripRequest',
] as const

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
})

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as (typeof SOFT_DELETE_MODELS)[number])) {
          const where = args.where as Record<string, unknown> | undefined
          if (where?.isDeleted === undefined) {
            args.where = { ...where, isDeleted: false }
          }
        }
        return query(args)
      },
      async findFirst({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as (typeof SOFT_DELETE_MODELS)[number])) {
          const where = args.where as Record<string, unknown> | undefined
          if (where?.isDeleted === undefined) {
            args.where = { ...where, isDeleted: false }
          }
        }
        return query(args)
      },
      async findUnique({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as (typeof SOFT_DELETE_MODELS)[number])) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((args.where as any)?.isDeleted === undefined) {
            args.where = { ...args.where, isDeleted: false } as any
          }
        }
        return query(args)
      },
      async delete({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as (typeof SOFT_DELETE_MODELS)[number])) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (basePrisma[model as any] as any).update({
            where: args.where,
            data: { isDeleted: true, isActive: false, deletedAt: new Date() },
          })
        }
        return query(args)
      },
      async deleteMany({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as (typeof SOFT_DELETE_MODELS)[number])) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (basePrisma[model as any] as any).updateMany({
            where: args.where,
            data: { isDeleted: true, isActive: false, deletedAt: new Date() },
          })
        }
        return query(args)
      },
    },
  },
})

export type ExtendedPrismaClient = typeof prisma
export type TransactionClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

// Singleton for Next.js hot-reload (prevents connection leaks in dev)
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrismaClient }
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

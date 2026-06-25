import { Prisma, PrismaClient } from '@prisma/client'
import { logger as pinoLogger } from '../utils/logger'
import * as Sentry from '@sentry/node'

const SLOW_QUERY_LOG = process.env.SLOW_QUERY_LOG === 'true'
const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 100

const SOFT_DELETE_MODELS = [
  'User', 'OrganizerProfile', 'Destination', 'Trip', 'TripTransferPoint', 'Booking',
  'TravelerDetail', 'Review', 'Conversation', 'Message',
  'Notification', 'TripRequest',
] as const

export const basePrisma = new PrismaClient({
  log: SLOW_QUERY_LOG
    ? [{ level: 'query', emit: 'event' }, { level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }]
    : [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }],
})

// Log slow DB queries — enabled via SLOW_QUERY_LOG=true env var
if (SLOW_QUERY_LOG) {
  basePrisma.$on('query', (e: Prisma.QueryEvent) => {
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      pinoLogger.warn({ duration: e.duration, query: e.query }, 'slow_db_query')
    }
  })
}

// Sentry span wrapper — compensates for $extends bypassing prismaIntegration()'s
// OTel prototype patches. Each DB operation gets a 'db.query' span so traces
// show query-level timing inside request handlers.
const sentryExtension = {
  query: {
    $allModels: {
      async $allOperations({
        model,
        operation,
        args,
        query,
      }: {
        model: string
        operation: string
        args: unknown
        query: (args: unknown) => Promise<unknown>
      }) {
        return Sentry.startSpan({ op: 'db.query', name: `${model}.${operation}` }, () => query(args))
      },
    },
  },
}

export const prisma = basePrisma.$extends(sentryExtension).$extends({
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

import { describe, it, expect } from 'vitest'
import { paginate, PAGINATION_DEFAULTS } from '../../../src/utils/constants'

describe('paginate()', () => {
  // ── Defaults ───────────────────────────────────────

  it('uses default page=1 and limit=20 when filters are empty', () => {
    const pg = paginate({})
    expect(pg.skip).toBe(0)
    expect(pg.take).toBe(PAGINATION_DEFAULTS.limit) // 20
  })

  it('uses default page when page is undefined', () => {
    const pg = paginate({ limit: 10 })
    expect(pg.skip).toBe(0) // (1-1)*10
  })

  it('uses default limit when limit is undefined', () => {
    const pg = paginate({ page: 3 })
    expect(pg.take).toBe(PAGINATION_DEFAULTS.limit) // 20
    expect(pg.skip).toBe(40) // (3-1)*20
  })

  // ── Skip calculation ───────────────────────────────

  it('computes correct skip for page 2 (limit 10)', () => {
    const pg = paginate({ page: 2, limit: 10 })
    expect(pg.skip).toBe(10)
    expect(pg.take).toBe(10)
  })

  it('computes correct skip for page 3 (limit 5)', () => {
    const pg = paginate({ page: 3, limit: 5 })
    expect(pg.skip).toBe(10)
    expect(pg.take).toBe(5)
  })

  it('skip is 0 on page 1 regardless of limit', () => {
    const pg = paginate({ page: 1, limit: 50 })
    expect(pg.skip).toBe(0)
  })

  // ── maxLimit cap ───────────────────────────────────

  it('caps take at maxLimit (50) when limit=100 is requested', () => {
    const pg = paginate({ limit: 100 })
    expect(pg.take).toBe(PAGINATION_DEFAULTS.maxLimit) // 50
  })

  it('caps take at maxLimit when limit=1000 is requested', () => {
    const pg = paginate({ limit: 1000 })
    expect(pg.take).toBe(50)
  })

  it('does NOT cap when limit is exactly maxLimit (50)', () => {
    const pg = paginate({ limit: 50 })
    expect(pg.take).toBe(50)
  })

  it('does NOT cap when limit is within bound (30)', () => {
    const pg = paginate({ limit: 30 })
    expect(pg.take).toBe(30)
  })

  // ── meta() ─────────────────────────────────────────

  it('meta() returns correct pagination object', () => {
    const pg = paginate({ page: 2, limit: 10 })
    expect(pg.meta(25)).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    })
  })

  it('meta() rounds totalPages up (ceil)', () => {
    const pg = paginate({ page: 1, limit: 7 })
    expect(pg.meta(15).totalPages).toBe(3) // ceil(15/7) = 3
  })

  it('meta() totalPages=1 when total equals limit exactly', () => {
    const pg = paginate({ page: 1, limit: 20 })
    expect(pg.meta(20).totalPages).toBe(1) // ceil(20/20) = 1
  })

  it('meta() totalPages=0 when total=0', () => {
    const pg = paginate({})
    expect(pg.meta(0).totalPages).toBe(0) // ceil(0/20) = 0
  })

  it('meta() reflects the capped limit when limit was over maxLimit', () => {
    const pg = paginate({ page: 1, limit: 100 })
    const m = pg.meta(60)
    expect(m.limit).toBe(50) // capped
    expect(m.totalPages).toBe(2) // ceil(60/50) = 2
  })
})

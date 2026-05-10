import { describe, it, expect } from 'vitest'
import { startTimer } from '../../../src/utils/perf-timer'

describe('perf-timer', () => {
  it('returns elapsed time as a number', () => {
    const timer = startTimer()
    const elapsed = timer.elapsed()
    expect(typeof elapsed).toBe('number')
  })

  it('returns a non-negative value', () => {
    const timer = startTimer()
    expect(timer.elapsed()).toBeGreaterThanOrEqual(0)
  })

  it('increases over time', async () => {
    const timer = startTimer()
    await new Promise((resolve) => setTimeout(resolve, 20))
    const elapsed = timer.elapsed()
    // At least 10ms should have passed (allowing for CI jitter)
    expect(elapsed).toBeGreaterThanOrEqual(10)
  })

  it('rounds to 2 decimal places', () => {
    const timer = startTimer()
    const elapsed = timer.elapsed()
    const decimalPart = elapsed.toString().split('.')[1]
    // Either no decimal part (integer) or at most 2 decimal places
    expect(!decimalPart || decimalPart.length <= 2).toBe(true)
  })

  it('allows multiple elapsed() calls (monotonically increasing)', async () => {
    const timer = startTimer()
    const first = timer.elapsed()
    await new Promise((resolve) => setTimeout(resolve, 10))
    const second = timer.elapsed()
    expect(second).toBeGreaterThanOrEqual(first)
  })
})

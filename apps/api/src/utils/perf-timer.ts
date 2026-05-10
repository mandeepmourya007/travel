/** High-resolution monotonic timer. Immune to system clock drift. */
export function startTimer() {
  const start = process.hrtime.bigint()
  return {
    /** Returns elapsed time in milliseconds (2 decimal places) */
    elapsed: () => Math.round(Number(process.hrtime.bigint() - start) / 1e4) / 100,
  }
}

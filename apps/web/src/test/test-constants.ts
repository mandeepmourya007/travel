/**
 * Base API URL for MSW handlers in tests.
 * Reads from env so tests work in both local dev (port 4000) and Docker (port 4001).
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

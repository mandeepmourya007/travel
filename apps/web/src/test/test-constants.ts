/**
 * Base API URL for MSW handlers in tests.
 * Reads from env so tests work in both local dev (port 4001) and Docker.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api/v1'

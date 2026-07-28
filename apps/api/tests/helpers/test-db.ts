/**
 * Shared connection-string resolution for integration tests (tests/integration/*).
 *
 * Every integration suite needs a real Postgres URL and falls back to the local
 * Docker Compose dev credentials when neither env var is set. These are dev-only,
 * already-public credentials (see docker-compose.yml) — not a secret.
 */

/** Local Docker Compose dev Postgres — matches docker-compose.yml's travel_dev service. */
export const DEFAULT_INTEGRATION_DB_URL =
  'postgresql://travel_user:travel_pass@localhost:5432/travel_dev?schema=public'

/**
 * Resolves the Postgres URL integration tests should connect to:
 * INTEGRATION_DB_URL > DIRECT_URL > the local Docker Compose dev default.
 */
export function getIntegrationDbUrl(): string {
  return process.env.INTEGRATION_DB_URL ?? process.env.DIRECT_URL ?? DEFAULT_INTEGRATION_DB_URL
}

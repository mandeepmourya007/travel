/**
 * @deprecated MockPaymentService is retired.
 *
 * Local dev without gateway credentials now uses MockPaymentGateway
 * (apps/api/src/providers/payment/mock-payment.gateway.ts) injected
 * via the gateway registry in config/dependencies.ts.
 *
 * This file is kept as a tombstone to prevent stale imports from
 * compiling silently. Remove it entirely once all import sites are cleaned up.
 */
export {}

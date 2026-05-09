import tokens from '@shared/theme/tokens.json'

/** Badge variant map for booking statuses — shared across admin booking pages */
export const BOOKING_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CONFIRMED: 'default',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  EXPIRED: 'outline',
  PENDING_PAYMENT: 'outline',
  REFUNDED: 'secondary',
}

/** Badge variant map for payment transaction statuses */
export const PAYMENT_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CAPTURED: 'default',
  FAILED: 'destructive',
  INITIATED: 'outline',
  REFUNDED: 'secondary',
}

/** Chart color map for booking statuses — uses design tokens */
export const BOOKING_STATUS_COLORS: Record<string, string> = {
  CONFIRMED: tokens.colors.success['500'],
  COMPLETED: tokens.colors.info['500'],
  CANCELLED: tokens.colors.error['500'],
  EXPIRED: tokens.colors.warning['500'],
  PENDING_PAYMENT: tokens.colors.highlight['500'],
  REFUNDED: tokens.colors.primary['300'],
}

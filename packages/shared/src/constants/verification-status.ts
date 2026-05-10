export const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

/** Object form for dot-access: VERIFICATION_STATUS.APPROVED — derived from array */
export const VERIFICATION_STATUS = Object.fromEntries(
  VERIFICATION_STATUSES.map((s) => [s, s]),
) as { readonly [K in VerificationStatus]: K }

export const APPROVE_REJECT_ACTIONS = ['APPROVED', 'REJECTED'] as const
export type ApproveRejectAction = (typeof APPROVE_REJECT_ACTIONS)[number]

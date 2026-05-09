export const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export const APPROVE_REJECT_ACTIONS = ['APPROVED', 'REJECTED'] as const
export type ApproveRejectAction = (typeof APPROVE_REJECT_ACTIONS)[number]

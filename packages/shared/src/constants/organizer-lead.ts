export const ORGANIZER_LEAD_STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED'] as const
export type OrganizerLeadStatus = (typeof ORGANIZER_LEAD_STATUSES)[number]

/** Object form for dot-access: ORGANIZER_LEAD_STATUS.NEW — derived from array */
export const ORGANIZER_LEAD_STATUS = Object.fromEntries(
  ORGANIZER_LEAD_STATUSES.map((s) => [s, s]),
) as { readonly [K in OrganizerLeadStatus]: K }

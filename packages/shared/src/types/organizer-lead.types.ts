import type { OrganizerLeadStatus } from '../constants/organizer-lead'

export interface CreateOrganizerLeadDto {
  fullName: string
  email: string
  phone: string
  businessName?: string
  city?: string
  notes?: string
}

export interface OrganizerLeadItem {
  id: string
  fullName: string
  email: string
  phone: string
  businessName: string | null
  city: string | null
  notes: string | null
  status: OrganizerLeadStatus
  adminNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateOrganizerLeadStatusDto {
  status: OrganizerLeadStatus
  adminNotes?: string
}

export interface OrganizerLeadFilters {
  status?: OrganizerLeadStatus
  search?: string
  page?: number
  limit?: number
}

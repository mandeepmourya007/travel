import type { OrganizerDocuments } from '../types/user.types'
import { REQUIRED_DOC_COUNT } from '../constants/upload'

export function getDocCount(docs: OrganizerDocuments | null | undefined): number {
  if (!docs) return 0
  return [docs.aadhaarFront, docs.aadhaarBack, docs.panCard].filter(Boolean).length
}

export function areDocsComplete(docs: OrganizerDocuments | null | undefined): boolean {
  return getDocCount(docs) === REQUIRED_DOC_COUNT
}

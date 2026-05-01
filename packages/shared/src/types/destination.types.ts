export interface Destination {
  id: string
  name: string
  slug: string
  state: string
  photoUrl?: string
  tripCount: number
  isPopular: boolean
}

export interface CreateDestinationDto {
  name: string
  slug?: string
  state: string
  photoUrl?: string
  isPopular?: boolean
}

export type UpdateDestinationDto = Partial<CreateDestinationDto>

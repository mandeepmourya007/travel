export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'REFUNDED'

export interface Booking {
  id: string
  tripId: string
  userId: string
  status: BookingStatus
  totalAmount: number
  numberOfTravelers: number
  createdAt: string
  trip: {
    title: string
    slug: string
    startDate: string
    endDate: string
    destination: { name: string }
  }
}

export interface CreateBookingDto {
  tripId: string
  numberOfTravelers: number
  travelers: TravelerInfo[]
}

export interface TravelerInfo {
  name: string
  phone: string
  age: number
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  emergencyContactName?: string
  emergencyContactPhone?: string
}

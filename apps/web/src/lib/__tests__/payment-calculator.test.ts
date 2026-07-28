import {
  getTravelerPaidAmount,
  getOrganizerTripFee,
  getOrganizerEarnings,
  getPlatformCommission,
  getResellerEarnings,
  getPaymentBreakdown,
} from '../payment-calculator'

describe('Payment Calculator', () => {
  describe('getTravelerPaidAmount', () => {
    it('returns the gross amount paid by traveler', () => {
      expect(getTravelerPaidAmount(6666)).toBe(6666)
      expect(getTravelerPaidAmount(10000)).toBe(10000)
      expect(getTravelerPaidAmount(0)).toBe(0)
    })
  })

  describe('getOrganizerTripFee', () => {
    it('calculates trip fee as traveler paid minus reseller amount', () => {
      expect(getOrganizerTripFee(6666, 0)).toBe(6666)
      expect(getOrganizerTripFee(6666, 67)).toBe(5999)
      expect(getOrganizerTripFee(10000, 100)).toBe(9900)
    })

    it('defaults to zero reseller amount', () => {
      expect(getOrganizerTripFee(6666)).toBe(6666)
    })
  })

  describe('getOrganizerEarnings', () => {
    it('calculates 90% of trip fee (10% commission on organizer fee)', () => {
      expect(getOrganizerEarnings(6666, 0)).toBe(5999)
      expect(getOrganizerEarnings(6666, 67)).toBe(5399)
      expect(getOrganizerEarnings(10000, 0)).toBe(9000)
    })

    it('rounds to nearest rupee', () => {
      expect(getOrganizerEarnings(1000, 0)).toBe(900)
      expect(getOrganizerEarnings(1001, 0)).toBe(901)
      expect(getOrganizerEarnings(1005, 0)).toBe(905)
    })

    it('handles zero amount', () => {
      expect(getOrganizerEarnings(0, 0)).toBe(0)
    })
  })

  describe('getPlatformCommission', () => {
    it('calculates 10% of organizer trip fee', () => {
      expect(getPlatformCommission(6666, 0)).toBe(667)
      expect(getPlatformCommission(6666, 67)).toBe(600)
      expect(getPlatformCommission(10000, 0)).toBe(1000)
    })

    it('is complementary to organizer earnings', () => {
      const gross = 6666
      const reseller = 67
      const organizer = getOrganizerEarnings(gross, reseller)
      const commission = getPlatformCommission(gross, reseller)
      const tripFee = getOrganizerTripFee(gross, reseller)
      expect(organizer + commission).toBe(tripFee)
    })
  })

  describe('getResellerEarnings', () => {
    it('returns the reseller amount', () => {
      expect(getResellerEarnings(0)).toBe(0)
      expect(getResellerEarnings(67)).toBe(67)
      expect(getResellerEarnings(100)).toBe(100)
    })
  })

  describe('getPaymentBreakdown', () => {
    it('returns complete payment breakdown without reseller', () => {
      const breakdown = getPaymentBreakdown(6666, 0)
      expect(breakdown).toEqual({
        travelerPaid: 6666,
        organizerTripFee: 6666,
        organizerEarnings: 5999,
        platformCommission: 667,
        resellerEarnings: 0,
      })
    })

    it('returns complete payment breakdown with reseller', () => {
      const breakdown = getPaymentBreakdown(6666, 67)
      expect(breakdown).toEqual({
        travelerPaid: 6666,
        organizerTripFee: 5999,
        organizerEarnings: 5399,
        platformCommission: 600,
        resellerEarnings: 67,
      })
    })

    it('sums correctly: traveler paid = trip fee + reseller', () => {
      const breakdown = getPaymentBreakdown(6666, 67)
      expect(breakdown.travelerPaid).toBe(
        breakdown.organizerTripFee + breakdown.resellerEarnings,
      )
    })

    it('sums correctly: trip fee = organizer earnings + commission', () => {
      const breakdown = getPaymentBreakdown(6666, 67)
      expect(breakdown.organizerTripFee).toBe(
        breakdown.organizerEarnings + breakdown.platformCommission,
      )
    })

    it('defaults to zero reseller amount', () => {
      const breakdown = getPaymentBreakdown(10000)
      expect(breakdown.resellerEarnings).toBe(0)
      expect(breakdown.organizerTripFee).toBe(10000)
    })
  })
})

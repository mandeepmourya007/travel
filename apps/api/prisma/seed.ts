import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...\n')

  // ── Clean existing data (reverse FK order) ──────────
  await prisma.message.deleteMany()
  await prisma.conversation.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.travelerDetail.deleteMany()
  await prisma.paymentTransaction.deleteMany()
  await prisma.review.deleteMany()
  await prisma.tripRequest.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.trip.deleteMany()
  await prisma.destination.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.verificationCode.deleteMany()
  await prisma.organizerProfile.deleteMany()
  await prisma.webhookEvent.deleteMany()
  await prisma.user.deleteMany()

  console.log('  ✓ Cleaned existing data')

  // ── Users ───────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Test@1234', 10)

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@travelapp.com',
      passwordHash,
      role: 'ADMIN',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AU',
    },
  })

  const organizer1User = await prisma.user.create({
    data: {
      name: 'Rahul Sharma',
      email: 'rahul@tripvibes.com',
      passwordHash,
      role: 'ORGANIZER',
      phone: '+919876543210',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=RS',
    },
  })

  const organizer2User = await prisma.user.create({
    data: {
      name: 'Priya Patel',
      email: 'priya@wanderlust.in',
      passwordHash,
      role: 'ORGANIZER',
      phone: '+919876543211',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=PP',
    },
  })

  const traveler1 = await prisma.user.create({
    data: {
      name: 'Amit Kulkarni',
      email: 'amit@gmail.com',
      passwordHash,
      role: 'TRAVELER',
      phone: '+919876543212',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AK',
    },
  })

  const traveler2 = await prisma.user.create({
    data: {
      name: 'Sneha Deshmukh',
      email: 'sneha@gmail.com',
      passwordHash,
      role: 'TRAVELER',
      phone: '+919876543213',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=SD',
    },
  })

  const traveler3 = await prisma.user.create({
    data: {
      name: 'Vikram Joshi',
      email: 'vikram@gmail.com',
      passwordHash,
      role: 'TRAVELER',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=VJ',
    },
  })

  console.log('  ✓ Created 6 users (1 admin, 2 organizers, 3 travelers)')

  // ── Organizer Profiles ──────────────────────────────
  const org1 = await prisma.organizerProfile.create({
    data: {
      userId: organizer1User.id,
      businessName: 'TripVibes Adventures',
      description: 'Premium group adventures from Pune. Weekend getaways, treks, and beach trips.',
      verificationStatus: 'APPROVED',
      rating: 4.6,
      totalReviews: 48,
      totalTripsCompleted: 35,
      bankAccountLinked: true,
      commissionRate: 10.0,
    },
  })

  const org2 = await prisma.organizerProfile.create({
    data: {
      userId: organizer2User.id,
      businessName: 'Wanderlust India',
      description: 'Cultural and offbeat travel experiences across Maharashtra and beyond.',
      verificationStatus: 'APPROVED',
      rating: 4.3,
      totalReviews: 22,
      totalTripsCompleted: 18,
      bankAccountLinked: true,
      commissionRate: 10.0,
    },
  })

  console.log('  ✓ Created 2 organizer profiles')

  // ── Destinations ────────────────────────────────────
  const goa = await prisma.destination.create({
    data: { name: 'Goa', slug: 'goa', state: 'Goa', isPopular: true, tripCount: 3, photoUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800' },
  })
  const lonavala = await prisma.destination.create({
    data: { name: 'Lonavala', slug: 'lonavala', state: 'Maharashtra', isPopular: true, tripCount: 2, photoUrl: 'https://images.unsplash.com/photo-1625505826533-5c80aca7d157?w=800' },
  })
  const ladakh = await prisma.destination.create({
    data: { name: 'Ladakh', slug: 'ladakh', state: 'Ladakh', isPopular: true, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800' },
  })
  const manali = await prisma.destination.create({
    data: { name: 'Manali', slug: 'manali', state: 'Himachal Pradesh', isPopular: true, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=800' },
  })
  const rishikesh = await prisma.destination.create({
    data: { name: 'Rishikesh', slug: 'rishikesh', state: 'Uttarakhand', isPopular: false, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=800' },
  })
  const alibaug = await prisma.destination.create({
    data: { name: 'Alibaug', slug: 'alibaug', state: 'Maharashtra', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800' },
  })
  const hampi = await prisma.destination.create({
    data: { name: 'Hampi', slug: 'hampi', state: 'Karnataka', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800' },
  })

  console.log('  ✓ Created 7 destinations')

  // ── Trips ───────────────────────────────────────────
  const now = new Date()
  const inDays = (d: number) => new Date(now.getTime() + d * 86400000)

  const trip1 = await prisma.trip.create({
    data: {
      organizerId: org1.id,
      destinationId: goa.id,
      title: 'Goa Beach Blast — 3N/4D',
      slug: 'goa-beach-blast-3n4d',
      tripType: 'BEACH',
      bookingMode: 'INSTANT',
      description: 'Ultimate Goa experience! North Goa beaches, water sports, nightlife, and delicious seafood. Perfect for friend groups looking for a fun-filled weekend escape from Pune.',
      itinerary: [
        { day: 1, title: 'Arrival & North Goa', description: 'Arrive at Pune pickup, drive to Goa. Evening at Baga beach.', activities: ['Beach walk', 'Sunset at Baga', 'Club night'] },
        { day: 2, title: 'Water Sports & Exploration', description: 'Full day of water sports at Calangute.', activities: ['Parasailing', 'Jet ski', 'Banana ride', 'Fort Aguada visit'] },
        { day: 3, title: 'South Goa & Chill', description: 'Visit Palolem beach and Old Goa churches.', activities: ['Palolem beach', 'Old Goa sightseeing', 'Spice plantation'] },
        { day: 4, title: 'Departure', description: 'Morning breakfast and departure to Pune.', activities: ['Breakfast', 'Shopping at Panjim', 'Drive back'] },
      ],
      startDate: inDays(14),
      endDate: inDays(18),
      pricePerPerson: 5999,
      earlyBirdPrice: 4999,
      earlyBirdDeadline: inDays(7),
      minGroupSize: 8,
      maxGroupSize: 20,
      currentBookings: 6,
      inclusions: ['AC bus from Pune', 'Hotel stay (3N)', 'Breakfast & dinner', 'Water sports (3 activities)', 'Sightseeing'],
      exclusions: ['Lunch', 'Personal expenses', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      pickupLocation: 'Pune — Shivaji Nagar Bus Stand',
      pickupTime: '6:00 AM',
      photos: ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'],
      status: 'ACTIVE',
    },
  })

  const trip2 = await prisma.trip.create({
    data: {
      organizerId: org1.id,
      destinationId: lonavala.id,
      title: 'Lonavala Weekend Monsoon Trek',
      slug: 'lonavala-monsoon-trek-weekend',
      tripType: 'TREKKING',
      bookingMode: 'INSTANT',
      description: 'Experience the magic of Lonavala in monsoon! Trek through lush green hills, visit waterfalls, and enjoy misty mountain views. A perfect one-day escape from Pune city.',
      itinerary: [
        { day: 1, title: 'Trek Day', description: 'Early morning drive from Pune, trek to Rajmachi Fort, waterfall visit, and return.', activities: ['Rajmachi Fort trek', 'Waterfall rappelling', 'Maggi point', 'Drive back'] },
      ],
      startDate: inDays(7),
      endDate: inDays(8),
      pricePerPerson: 1299,
      minGroupSize: 10,
      maxGroupSize: 25,
      currentBookings: 12,
      inclusions: ['Transport from Pune', 'Breakfast & lunch', 'Trek guide', 'First aid'],
      exclusions: ['Dinner', 'Personal expenses'],
      cancellationPolicy: 'FLEXIBLE',
      pickupLocation: 'Pune — Wakad Bridge',
      pickupTime: '5:30 AM',
      photos: ['https://images.unsplash.com/photo-1625505826533-5c80aca7d157?w=800'],
      status: 'ACTIVE',
    },
  })

  const trip3 = await prisma.trip.create({
    data: {
      organizerId: org2.id,
      destinationId: ladakh.id,
      title: 'Ladakh Road Trip — 7N/8D',
      slug: 'ladakh-road-trip-7n8d',
      tripType: 'ADVENTURE',
      bookingMode: 'REQUEST_BASED',
      description: 'The ultimate Ladakh adventure! Ride through Manali–Leh highway, visit Pangong Lake, Nubra Valley, and Khardung La. Small group, big memories.',
      itinerary: [
        { day: 1, title: 'Manali to Jispa', description: 'Start the journey from Manali.', activities: ['Drive to Jispa', 'Atal Tunnel', 'Night stay at Jispa'] },
        { day: 2, title: 'Jispa to Leh', description: 'Cross high passes.', activities: ['Baralacha La', 'Lachalung La', 'More Plains', 'Arrive Leh'] },
        { day: 3, title: 'Leh Acclimatization', description: 'Rest day in Leh.', activities: ['Leh Palace', 'Shanti Stupa', 'Local market'] },
        { day: 4, title: 'Pangong Lake', description: 'Drive to Pangong via Chang La.', activities: ['Chang La pass', 'Pangong Lake camping', 'Stargazing'] },
        { day: 5, title: 'Nubra Valley', description: 'Drive to Nubra via Khardung La.', activities: ['Khardung La', 'Diskit Monastery', 'Sand dunes camel ride'] },
        { day: 6, title: 'Nubra to Leh', description: 'Return to Leh.', activities: ['Drive back', 'Magnetic Hill', 'Sangam point'] },
        { day: 7, title: 'Leh Explore', description: 'Explore Leh surroundings.', activities: ['Hemis Monastery', 'Thiksey Monastery', 'Farewell dinner'] },
        { day: 8, title: 'Departure', description: 'Fly out from Leh.', activities: ['Airport drop'] },
      ],
      startDate: inDays(30),
      endDate: inDays(38),
      pricePerPerson: 18999,
      earlyBirdPrice: 16999,
      earlyBirdDeadline: inDays(20),
      minGroupSize: 6,
      maxGroupSize: 12,
      currentBookings: 4,
      inclusions: ['Accommodation (7N)', 'All meals', 'Bike/car rental', 'Permits', 'Guide', 'Oxygen cylinder'],
      exclusions: ['Flights', 'Personal shopping', 'Tips', 'Travel insurance'],
      cancellationPolicy: 'STRICT',
      photos: ['https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800'],
      status: 'ACTIVE',
    },
  })

  const trip4 = await prisma.trip.create({
    data: {
      organizerId: org1.id,
      destinationId: goa.id,
      title: 'Goa New Year Bash 2026',
      slug: 'goa-new-year-bash-2026',
      tripType: 'BEACH',
      bookingMode: 'INSTANT',
      description: 'Ring in the New Year on the beaches of Goa! Party, fireworks, beach camping, and an unforgettable countdown experience.',
      itinerary: [
        { day: 1, title: 'Arrival', description: 'Arrive and check in.', activities: ['Check-in', 'Beach walk'] },
        { day: 2, title: 'NYE Party', description: 'New Year Eve celebration.', activities: ['Beach party', 'DJ night', 'Fireworks', 'Countdown'] },
        { day: 3, title: 'Departure', description: 'Brunch and departure.', activities: ['Brunch', 'Departure'] },
      ],
      startDate: inDays(60),
      endDate: inDays(63),
      pricePerPerson: 7499,
      minGroupSize: 15,
      maxGroupSize: 40,
      currentBookings: 0,
      inclusions: ['Transport', 'Hotel (2N)', 'NYE party entry', 'Meals'],
      exclusions: ['Drinks', 'Personal expenses'],
      cancellationPolicy: 'MODERATE',
      pickupLocation: 'Pune — Swargate',
      pickupTime: '10:00 PM',
      photos: ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800'],
      status: 'DRAFT',
    },
  })

  const trip5 = await prisma.trip.create({
    data: {
      organizerId: org2.id,
      destinationId: manali.id,
      title: 'Manali Snow Adventure — 5N/6D',
      slug: 'manali-snow-adventure-5n6d',
      tripType: 'ADVENTURE',
      bookingMode: 'INSTANT',
      description: 'Snow-capped mountains, Solang Valley adventures, Old Manali vibes, and Rohtang Pass excursion. Perfect winter getaway!',
      itinerary: [
        { day: 1, title: 'Arrival', description: 'Arrive in Manali.', activities: ['Check-in', 'Mall Road walk'] },
        { day: 2, title: 'Solang Valley', description: 'Snow activities.', activities: ['Skiing', 'Snow tubing', 'Paragliding'] },
        { day: 3, title: 'Rohtang Pass', description: 'Day trip to Rohtang.', activities: ['Rohtang excursion', 'Snow play'] },
        { day: 4, title: 'Old Manali', description: 'Explore Old Manali.', activities: ['Cafes', 'Hadimba Temple', 'Vashisht hot springs'] },
        { day: 5, title: 'Kullu & Rafting', description: 'Rafting in Beas river.', activities: ['River rafting', 'Kullu shawl shopping'] },
        { day: 6, title: 'Departure', description: 'Departure.', activities: ['Breakfast', 'Departure'] },
      ],
      startDate: inDays(45),
      endDate: inDays(51),
      pricePerPerson: 12999,
      earlyBirdPrice: 10999,
      earlyBirdDeadline: inDays(30),
      minGroupSize: 8,
      maxGroupSize: 16,
      currentBookings: 3,
      inclusions: ['Volvo bus', 'Hotel (5N)', 'All meals', 'Rohtang permit', 'Snow activities'],
      exclusions: ['Paragliding', 'Shopping', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=800'],
      status: 'ACTIVE',
    },
  })

  const trip6 = await prisma.trip.create({
    data: {
      organizerId: org2.id,
      destinationId: rishikesh.id,
      title: 'Rishikesh Rafting & Camping Weekend',
      slug: 'rishikesh-rafting-camping',
      tripType: 'ADVENTURE',
      bookingMode: 'INSTANT',
      description: 'White water rafting on the Ganges, riverside camping under the stars, cliff jumping, and bonfire nights. Adrenaline guaranteed!',
      itinerary: [
        { day: 1, title: 'Arrival & Rafting', description: 'Arrive and go rafting.', activities: ['16km rafting', 'Cliff jumping', 'Riverside camping'] },
        { day: 2, title: 'Explore & Depart', description: 'Morning yoga and departure.', activities: ['Yoga session', 'Laxman Jhula', 'Departure'] },
      ],
      startDate: inDays(10),
      endDate: inDays(12),
      pricePerPerson: 3499,
      minGroupSize: 10,
      maxGroupSize: 20,
      currentBookings: 8,
      inclusions: ['Transport from Delhi', 'Camping (1N)', 'Rafting', 'Meals', 'Bonfire'],
      exclusions: ['Personal expenses', 'Tips'],
      cancellationPolicy: 'FLEXIBLE',
      pickupLocation: 'Delhi — Kashmere Gate ISBT',
      pickupTime: '11:00 PM',
      photos: ['https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=800'],
      status: 'ACTIVE',
    },
  })

  const trip7 = await prisma.trip.create({
    data: {
      organizerId: org1.id,
      destinationId: goa.id,
      title: 'Goa Couples Retreat — 2N/3D',
      slug: 'goa-couples-retreat-2n3d',
      tripType: 'BEACH',
      bookingMode: 'REQUEST_BASED',
      description: 'Romantic getaway to South Goa. Luxury stay, couples spa, candlelight dinner on the beach, and private boat cruise.',
      itinerary: [
        { day: 1, title: 'Arrival & Spa', description: 'Check-in and couples spa.', activities: ['Luxury check-in', 'Couples spa', 'Candlelight dinner'] },
        { day: 2, title: 'Beach & Cruise', description: 'Beach day and sunset cruise.', activities: ['Private beach', 'Sunset boat cruise', 'Stargazing'] },
        { day: 3, title: 'Departure', description: 'Brunch and departure.', activities: ['Poolside brunch', 'Departure'] },
      ],
      startDate: inDays(21),
      endDate: inDays(24),
      pricePerPerson: 9999,
      minGroupSize: 4,
      maxGroupSize: 10,
      currentBookings: 2,
      inclusions: ['Flight booking assistance', 'Luxury resort (2N)', 'All meals', 'Spa', 'Boat cruise'],
      exclusions: ['Flights', 'Drinks', 'Personal shopping'],
      cancellationPolicy: 'STRICT',
      photos: ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800'],
      status: 'ACTIVE',
    },
  })

  const trip8 = await prisma.trip.create({
    data: {
      organizerId: org1.id,
      destinationId: lonavala.id,
      title: 'Lonavala Corporate Team Outing',
      slug: 'lonavala-corporate-outing',
      tripType: 'WEEKEND',
      bookingMode: 'REQUEST_BASED',
      description: 'Team building activities, villa stay, BBQ night, and adventure activities at Lonavala. Perfect for corporate groups.',
      itinerary: [
        { day: 1, title: 'Arrive & Team Building', description: 'Check-in and activities.', activities: ['Villa check-in', 'Team building games', 'BBQ dinner'] },
        { day: 2, title: 'Adventure & Depart', description: 'Morning activities and departure.', activities: ['Zip lining', 'Pool party', 'Lunch', 'Departure'] },
      ],
      startDate: inDays(21),
      endDate: inDays(23),
      pricePerPerson: 3999,
      minGroupSize: 15,
      maxGroupSize: 30,
      currentBookings: 0,
      inclusions: ['Transport', 'Villa stay (1N)', 'All meals', 'Team activities', 'BBQ'],
      exclusions: ['Drinks', 'Personal expenses'],
      cancellationPolicy: 'MODERATE',
      pickupLocation: 'Pune — Hinjewadi Phase 1',
      pickupTime: '8:00 AM',
      photos: ['https://images.unsplash.com/photo-1625505826533-5c80aca7d157?w=800'],
      status: 'ACTIVE',
    },
  })

  console.log('  ✓ Created 8 trips (6 ACTIVE, 1 DRAFT, 1 REQUEST_BASED)')

  // ── Bookings ────────────────────────────────────────
  const booking1 = await prisma.booking.create({
    data: {
      bookingRef: 'TRV-2025-0001',
      tripId: trip1.id,
      userId: traveler1.id,
      numTravelers: 2,
      totalAmount: 11998,
      bookingStatus: 'CONFIRMED',
    },
  })

  const booking2 = await prisma.booking.create({
    data: {
      bookingRef: 'TRV-2025-0002',
      tripId: trip2.id,
      userId: traveler2.id,
      numTravelers: 1,
      totalAmount: 1299,
      bookingStatus: 'CONFIRMED',
    },
  })

  const booking3 = await prisma.booking.create({
    data: {
      bookingRef: 'TRV-2025-0003',
      tripId: trip3.id,
      userId: traveler3.id,
      numTravelers: 2,
      totalAmount: 37998,
      bookingStatus: 'CONFIRMED',
    },
  })

  const booking4 = await prisma.booking.create({
    data: {
      bookingRef: 'TRV-2025-0004',
      tripId: trip6.id,
      userId: traveler1.id,
      numTravelers: 3,
      totalAmount: 10497,
      bookingStatus: 'CONFIRMED',
    },
  })

  const booking5 = await prisma.booking.create({
    data: {
      bookingRef: 'TRV-2025-0005',
      tripId: trip1.id,
      userId: traveler3.id,
      numTravelers: 1,
      totalAmount: 4999,
      bookingStatus: 'PENDING_PAYMENT',
      expiresAt: inDays(2),
    },
  })

  console.log('  ✓ Created 5 bookings (4 confirmed, 1 pending)')

  // ── Traveler Details ────────────────────────────────
  await prisma.travelerDetail.createMany({
    data: [
      { bookingId: booking1.id, name: 'Amit Kulkarni', phone: '+919876543212', age: 28, gender: 'MALE', isPrimary: true },
      { bookingId: booking1.id, name: 'Riya Kulkarni', phone: '+919876543220', age: 26, gender: 'FEMALE' },
      { bookingId: booking2.id, name: 'Sneha Deshmukh', phone: '+919876543213', age: 25, gender: 'FEMALE', isPrimary: true },
      { bookingId: booking3.id, name: 'Vikram Joshi', phone: '+919876543214', age: 30, gender: 'MALE', isPrimary: true },
      { bookingId: booking3.id, name: 'Neha Joshi', age: 28, gender: 'FEMALE' },
      { bookingId: booking4.id, name: 'Amit Kulkarni', phone: '+919876543212', age: 28, gender: 'MALE', isPrimary: true },
      { bookingId: booking4.id, name: 'Rohit M', age: 27, gender: 'MALE' },
      { bookingId: booking4.id, name: 'Saurabh P', age: 29, gender: 'MALE' },
    ],
  })

  console.log('  ✓ Created 8 traveler details')

  // ── Payment Transactions ────────────────────────────
  await prisma.paymentTransaction.createMany({
    data: [
      { bookingId: booking1.id, type: 'PAYMENT', amount: 11998, status: 'CAPTURED', razorpayOrderId: 'order_fake_001', razorpayPaymentId: 'pay_fake_001' },
      { bookingId: booking2.id, type: 'PAYMENT', amount: 1299, status: 'CAPTURED', razorpayOrderId: 'order_fake_002', razorpayPaymentId: 'pay_fake_002' },
      { bookingId: booking3.id, type: 'PAYMENT', amount: 37998, status: 'CAPTURED', razorpayOrderId: 'order_fake_003', razorpayPaymentId: 'pay_fake_003' },
      { bookingId: booking4.id, type: 'PAYMENT', amount: 10497, status: 'CAPTURED', razorpayOrderId: 'order_fake_004', razorpayPaymentId: 'pay_fake_004' },
    ],
  })

  console.log('  ✓ Created 4 payment transactions')

  // ── Reviews ─────────────────────────────────────────
  await prisma.review.createMany({
    data: [
      {
        tripId: trip1.id,
        bookingId: booking1.id,
        userId: traveler1.id,
        overallRating: 5,
        organizationRating: 5,
        valueRating: 4,
        safetyRating: 5,
        comment: 'Amazing trip! The organizer was super helpful and everything was well planned. Goa beaches were stunning. Highly recommend TripVibes!',
      },
      {
        tripId: trip2.id,
        bookingId: booking2.id,
        userId: traveler2.id,
        overallRating: 4,
        organizationRating: 4,
        valueRating: 5,
        safetyRating: 4,
        comment: 'Great monsoon trek. The waterfall was breathtaking. Only downside was the early morning pickup, but totally worth it.',
      },
    ],
  })

  console.log('  ✓ Created 2 reviews')

  // ── Trip Requests ───────────────────────────────────
  await prisma.tripRequest.create({
    data: {
      tripId: trip3.id,
      userId: traveler2.id,
      numTravelers: 2,
      message: 'Hi! We are a couple from Pune and love adventure trips. Would love to join the Ladakh trip. Is there still space?',
      status: 'PENDING',
      approvalExpiresAt: inDays(5),
    },
  })

  await prisma.tripRequest.create({
    data: {
      tripId: trip7.id,
      userId: traveler1.id,
      numTravelers: 2,
      message: 'Looking for a romantic getaway with my partner. The couples retreat looks perfect!',
      status: 'APPROVED',
      respondedAt: new Date(),
      responseNote: 'Welcome aboard! Please complete payment within 48 hours.',
    },
  })

  console.log('  ✓ Created 2 trip requests')

  // ── Conversations & Messages ────────────────────────
  const conv1 = await prisma.conversation.create({
    data: {
      tripId: trip1.id,
      travelerId: traveler1.id,
      organizerProfileId: org1.id,
      lastMessageAt: new Date(),
    },
  })

  await prisma.message.createMany({
    data: [
      { conversationId: conv1.id, senderId: traveler1.id, content: 'Hi! What should we pack for the Goa trip?', readAt: new Date() },
      { conversationId: conv1.id, senderId: organizer1User.id, content: 'Hey Amit! Pack light clothes, sunscreen, swimwear, and a hat. We provide towels at the hotel. 😊', readAt: new Date() },
      { conversationId: conv1.id, senderId: traveler1.id, content: 'Thanks! Can we extend by 1 day?', readAt: null },
    ],
  })

  const conv2 = await prisma.conversation.create({
    data: {
      tripId: trip3.id,
      travelerId: traveler3.id,
      organizerProfileId: org2.id,
      lastMessageAt: new Date(),
    },
  })

  await prisma.message.createMany({
    data: [
      { conversationId: conv2.id, senderId: traveler3.id, content: 'Is the Ladakh trip suitable for beginners?', readAt: new Date() },
      { conversationId: conv2.id, senderId: organizer2User.id, content: 'Yes! We take care of acclimatization and the route is well-planned. No prior experience needed.', readAt: new Date() },
    ],
  })

  console.log('  ✓ Created 2 conversations with 5 messages')

  // ── Notifications ───────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: traveler1.id, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed!', body: 'Your booking for "Goa Beach Blast" is confirmed. Ref: TRV-2025-0001', sentAt: new Date(), readAt: new Date() },
      { userId: traveler2.id, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed!', body: 'Your booking for "Lonavala Monsoon Trek" is confirmed. Ref: TRV-2025-0002', sentAt: new Date() },
      { userId: traveler3.id, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed!', body: 'Your booking for "Ladakh Road Trip" is confirmed. Ref: TRV-2025-0003', sentAt: new Date() },
      { userId: traveler1.id, channel: 'IN_APP', type: 'TRIP_REMINDER', title: 'Trip in 2 weeks!', body: 'Your Goa Beach Blast trip starts in 14 days. Start packing! 🏖️', sentAt: new Date() },
      { userId: organizer1User.id, channel: 'IN_APP', type: 'REVIEW_REQUEST', title: 'New Review!', body: 'Amit Kulkarni left a 5-star review for "Goa Beach Blast". Check it out!', sentAt: new Date() },
    ],
  })

  console.log('  ✓ Created 5 notifications')

  console.log('\n✅ Seed complete!\n')
  console.log('  📊 Prisma Studio: npx prisma studio')
  console.log('  🌐 API Endpoints:')
  console.log('     GET http://localhost:4000/api/v1/destinations')
  console.log('     GET http://localhost:4000/api/v1/trips')
  console.log('     GET http://localhost:4000/api/v1/trips/slug/goa-beach-blast-3n4d')
  console.log('')
  console.log('  🔐 Test Accounts (password: Test@1234):')
  console.log('     admin@travelapp.com (ADMIN)')
  console.log('     rahul@tripvibes.com (ORGANIZER)')
  console.log('     priya@wanderlust.in (ORGANIZER)')
  console.log('     amit@gmail.com (TRAVELER)')
  console.log('     sneha@gmail.com (TRAVELER)')
  console.log('     vikram@gmail.com (TRAVELER)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

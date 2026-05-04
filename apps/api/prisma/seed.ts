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
  await prisma.tripTransferPoint.deleteMany()
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
      razorpayAccountId: 'acc_seed_org1_dev',
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
      razorpayAccountId: 'acc_seed_org2_dev',
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
        { day: 1, title: 'Arrival & North Goa', description: 'Arrive at Pune pickup, drive to Goa. Evening at Baga beach.', activities: [{ title: 'Beach walk', time: '4:00 PM' }, { title: 'Sunset at Baga', time: '6:30 PM' }, { title: 'Club night', time: '10:00 PM' }] },
        { day: 2, title: 'Water Sports & Exploration', description: 'Full day of water sports at Calangute.', activities: [{ title: 'Parasailing', time: '9:00 AM' }, { title: 'Jet ski', time: '11:00 AM' }, { title: 'Banana ride', time: '2:00 PM' }, { title: 'Fort Aguada visit', time: '4:00 PM' }] },
        { day: 3, title: 'South Goa & Chill', description: 'Visit Palolem beach and Old Goa churches.', activities: [{ title: 'Palolem beach', time: '9:00 AM' }, { title: 'Old Goa sightseeing', time: '2:00 PM' }, { title: 'Spice plantation', time: '4:30 PM' }] },
        { day: 4, title: 'Departure', description: 'Morning breakfast and departure to Pune.', activities: [{ title: 'Breakfast', time: '8:00 AM' }, { title: 'Shopping at Panjim', time: '10:00 AM' }, { title: 'Drive back', time: '1:00 PM' }] },
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
      photos: ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'],
      status: 'ACTIVE',
      transferPoints: { create: [{ type: 'PICKUP', label: 'Pune — Shivaji Nagar Bus Stand', time: '6:00 AM' }] },
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
        { day: 1, title: 'Trek Day', description: 'Early morning drive from Pune, trek to Rajmachi Fort, waterfall visit, and return.', activities: [{ title: 'Rajmachi Fort trek', time: '7:00 AM' }, { title: 'Waterfall rappelling', time: '11:00 AM' }, { title: 'Maggi point', time: '1:00 PM' }, { title: 'Drive back', time: '4:00 PM' }] },
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
      photos: ['https://images.unsplash.com/photo-1625505826533-5c80aca7d157?w=800'],
      status: 'ACTIVE',
      transferPoints: { create: [{ type: 'PICKUP', label: 'Pune — Wakad Bridge', time: '5:30 AM' }] },
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
        { day: 1, title: 'Manali to Jispa', description: 'Start the journey from Manali.', activities: [{ title: 'Drive to Jispa', time: '6:00 AM' }, { title: 'Atal Tunnel', time: '10:00 AM' }, { title: 'Night stay at Jispa', time: '5:00 PM' }] },
        { day: 2, title: 'Jispa to Leh', description: 'Cross high passes.', activities: [{ title: 'Baralacha La', time: '7:00 AM' }, { title: 'Lachalung La', time: '11:00 AM' }, { title: 'More Plains', time: '2:00 PM' }, { title: 'Arrive Leh', time: '6:00 PM' }] },
        { day: 3, title: 'Leh Acclimatization', description: 'Rest day in Leh.', activities: [{ title: 'Leh Palace', time: '10:00 AM' }, { title: 'Shanti Stupa', time: '3:00 PM' }, { title: 'Local market', time: '5:00 PM' }] },
        { day: 4, title: 'Pangong Lake', description: 'Drive to Pangong via Chang La.', activities: [{ title: 'Chang La pass', time: '8:00 AM' }, { title: 'Pangong Lake camping', time: '2:00 PM' }, { title: 'Stargazing', time: '9:00 PM' }] },
        { day: 5, title: 'Nubra Valley', description: 'Drive to Nubra via Khardung La.', activities: [{ title: 'Khardung La', time: '7:00 AM' }, { title: 'Diskit Monastery', time: '1:00 PM' }, { title: 'Sand dunes camel ride', time: '4:00 PM' }] },
        { day: 6, title: 'Nubra to Leh', description: 'Return to Leh.', activities: [{ title: 'Drive back', time: '8:00 AM' }, { title: 'Magnetic Hill', time: '2:00 PM' }, { title: 'Sangam point', time: '4:00 PM' }] },
        { day: 7, title: 'Leh Explore', description: 'Explore Leh surroundings.', activities: [{ title: 'Hemis Monastery', time: '9:00 AM' }, { title: 'Thiksey Monastery', time: '12:00 PM' }, { title: 'Farewell dinner', time: '7:00 PM' }] },
        { day: 8, title: 'Departure', description: 'Fly out from Leh.', activities: [{ title: 'Airport drop', time: '6:00 AM' }] },
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
        { day: 1, title: 'Arrival', description: 'Arrive and check in.', activities: [{ title: 'Check-in', time: '2:00 PM' }, { title: 'Beach walk', time: '5:00 PM' }] },
        { day: 2, title: 'NYE Party', description: 'New Year Eve celebration.', activities: [{ title: 'Beach party', time: '6:00 PM' }, { title: 'DJ night', time: '9:00 PM' }, { title: 'Fireworks', time: '11:55 PM' }, { title: 'Countdown', time: '12:00 AM' }] },
        { day: 3, title: 'Departure', description: 'Brunch and departure.', activities: [{ title: 'Brunch', time: '10:00 AM' }, { title: 'Departure', time: '1:00 PM' }] },
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
      photos: ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800'],
      status: 'DRAFT',
      transferPoints: { create: [{ type: 'PICKUP', label: 'Pune — Swargate', time: '10:00 PM' }] },
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
        { day: 1, title: 'Arrival', description: 'Arrive in Manali.', activities: [{ title: 'Check-in', time: '12:00 PM' }, { title: 'Mall Road walk', time: '4:00 PM' }] },
        { day: 2, title: 'Solang Valley', description: 'Snow activities.', activities: [{ title: 'Skiing', time: '9:00 AM' }, { title: 'Snow tubing', time: '12:00 PM' }, { title: 'Paragliding', time: '3:00 PM' }] },
        { day: 3, title: 'Rohtang Pass', description: 'Day trip to Rohtang.', activities: [{ title: 'Rohtang excursion', time: '7:00 AM' }, { title: 'Snow play', time: '11:00 AM' }] },
        { day: 4, title: 'Old Manali', description: 'Explore Old Manali.', activities: [{ title: 'Cafes', time: '10:00 AM' }, { title: 'Hadimba Temple', time: '2:00 PM' }, { title: 'Vashisht hot springs', time: '4:00 PM' }] },
        { day: 5, title: 'Kullu & Rafting', description: 'Rafting in Beas river.', activities: [{ title: 'River rafting', time: '9:00 AM' }, { title: 'Kullu shawl shopping', time: '2:00 PM' }] },
        { day: 6, title: 'Departure', description: 'Departure.', activities: [{ title: 'Breakfast', time: '8:00 AM' }, { title: 'Departure', time: '10:00 AM' }] },
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
        { day: 1, title: 'Arrival & Rafting', description: 'Arrive and go rafting.', activities: [{ title: '16km rafting', time: '10:00 AM' }, { title: 'Cliff jumping', time: '2:00 PM' }, { title: 'Riverside camping', time: '5:00 PM' }] },
        { day: 2, title: 'Explore & Depart', description: 'Morning yoga and departure.', activities: [{ title: 'Yoga session', time: '6:00 AM' }, { title: 'Laxman Jhula', time: '9:00 AM' }, { title: 'Departure', time: '12:00 PM' }] },
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
      photos: ['https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=800'],
      status: 'ACTIVE',
      transferPoints: { create: [{ type: 'PICKUP', label: 'Delhi — Kashmere Gate ISBT', time: '11:00 PM' }] },
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
        { day: 1, title: 'Arrival & Spa', description: 'Check-in and couples spa.', activities: [{ title: 'Luxury check-in', time: '1:00 PM' }, { title: 'Couples spa', time: '3:00 PM' }, { title: 'Candlelight dinner', time: '8:00 PM' }] },
        { day: 2, title: 'Beach & Cruise', description: 'Beach day and sunset cruise.', activities: [{ title: 'Private beach', time: '10:00 AM' }, { title: 'Sunset boat cruise', time: '5:00 PM' }, { title: 'Stargazing', time: '9:00 PM' }] },
        { day: 3, title: 'Departure', description: 'Brunch and departure.', activities: [{ title: 'Poolside brunch', time: '10:00 AM' }, { title: 'Departure', time: '1:00 PM' }] },
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
        { day: 1, title: 'Arrive & Team Building', description: 'Check-in and activities.', activities: [{ title: 'Villa check-in', time: '10:00 AM' }, { title: 'Team building games', time: '2:00 PM' }, { title: 'BBQ dinner', time: '7:00 PM' }] },
        { day: 2, title: 'Adventure & Depart', description: 'Morning activities and departure.', activities: [{ title: 'Zip lining', time: '9:00 AM' }, { title: 'Pool party', time: '11:00 AM' }, { title: 'Lunch', time: '1:00 PM' }, { title: 'Departure', time: '3:00 PM' }] },
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
      photos: ['https://images.unsplash.com/photo-1625505826533-5c80aca7d157?w=800'],
      status: 'ACTIVE',
      transferPoints: { create: [{ type: 'PICKUP', label: 'Pune — Hinjewadi Phase 1', time: '8:00 AM' }] },
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

  // ══════════════════════════════════════════════════════
  // ── Demo Organizer: full dashboard data ────────────────
  // ══════════════════════════════════════════════════════

  const demoOrgUser = await prisma.user.create({
    data: {
      name: 'Demo Organizer',
      email: 'demo.organizer@test.com',
      passwordHash,
      role: 'ORGANIZER',
      phone: '+919999000001',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=DO',
    },
  })

  const demoOrg = await prisma.organizerProfile.create({
    data: {
      userId: demoOrgUser.id,
      businessName: 'Demo Travel Co',
      description: 'Premium travel experiences curated from Pune.',
      verificationStatus: 'APPROVED',
      rating: 4.5,
      totalReviews: 12,
      totalTripsCompleted: 4,
      bankAccountLinked: true,
      commissionRate: 10.0,
      razorpayAccountId: 'acc_seed_demo_dev',
    },
  })

  // Additional travelers
  const trav4 = await prisma.user.create({
    data: { name: 'Rohan Mehta', email: 'rohan@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876500001', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=RM' },
  })
  const trav5 = await prisma.user.create({
    data: { name: 'Ananya Iyer', email: 'ananya@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876500002', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AI' },
  })
  const trav6 = await prisma.user.create({
    data: { name: 'Karan Singh', email: 'karan@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876500003', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=KS' },
  })
  const trav7 = await prisma.user.create({
    data: { name: 'Meera Jain', email: 'meera@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876500004', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=MJ' },
  })
  const trav8 = await prisma.user.create({
    data: { name: 'Arjun Nair', email: 'arjun@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876500005', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AN' },
  })
  const trav9 = await prisma.user.create({
    data: { name: 'Pooja Sharma', email: 'pooja@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876500006', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=PS' },
  })

  console.log('  ✓ Created demo organizer + 6 additional travelers')

  // ── Trip A: ACTIVE, REQUEST_BASED, accepted + pending requests ──
  const demoTripA = await prisma.trip.create({
    data: {
      organizerId: demoOrg.id,
      destinationId: ladakh.id,
      title: 'Ladakh Explorer — 6N/7D',
      slug: 'demo-ladakh-explorer-6n7d',
      tripType: 'ADVENTURE',
      bookingMode: 'REQUEST_BASED',
      description: 'Curated Ladakh adventure with hand-picked campsites. Pangong, Nubra, and Khardung La. Limited spots — request-only.',
      itinerary: [
        { day: 1, title: 'Delhi to Leh', description: 'Morning flight and rest.', activities: [{ title: 'Flight to Leh', time: '6:00 AM' }, { title: 'Acclimatization walk', time: '3:00 PM' }] },
        { day: 2, title: 'Leh Sightseeing', description: 'Explore Leh town.', activities: [{ title: 'Leh Palace', time: '9:00 AM' }, { title: 'Shanti Stupa', time: '2:00 PM' }, { title: 'Market walk', time: '5:00 PM' }] },
        { day: 3, title: 'Pangong Lake', description: 'Drive to Pangong.', activities: [{ title: 'Chang La pass', time: '8:00 AM' }, { title: 'Pangong camping', time: '2:00 PM' }] },
        { day: 4, title: 'Nubra Valley', description: 'Via Khardung La.', activities: [{ title: 'Khardung La', time: '7:00 AM' }, { title: 'Diskit Monastery', time: '1:00 PM' }, { title: 'Camel ride', time: '4:00 PM' }] },
        { day: 5, title: 'Turtuk Village', description: 'India\'s last village.', activities: [{ title: 'Drive to Turtuk', time: '8:00 AM' }, { title: 'Village exploration', time: '12:00 PM' }] },
        { day: 6, title: 'Return to Leh', description: 'Drive back.', activities: [{ title: 'Scenic drive', time: '9:00 AM' }, { title: 'Farewell dinner', time: '7:00 PM' }] },
        { day: 7, title: 'Departure', description: 'Fly out.', activities: [{ title: 'Airport drop', time: '5:00 AM' }] },
      ],
      startDate: inDays(20),
      endDate: inDays(27),
      pricePerPerson: 22000,
      earlyBirdPrice: 19500,
      earlyBirdDeadline: inDays(10),
      minGroupSize: 6,
      maxGroupSize: 12,
      currentBookings: 4,
      inclusions: ['Flights assistance', 'Hotel + camping (6N)', 'All meals', 'Permits', 'Bike rental', 'Guide'],
      exclusions: ['Flights', 'Travel insurance', 'Personal expenses'],
      cancellationPolicy: 'STRICT',
      photos: ['https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800'],
      status: 'ACTIVE',
      acceptingBookings: true,
      transferPoints: { create: [{ type: 'PICKUP', label: 'Leh Airport', time: '10:00 AM' }] },
    },
  })

  // Accepted bookings for Trip A
  const dBookingA1 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D001', tripId: demoTripA.id, userId: trav4.id, numTravelers: 2, totalAmount: 44000, bookingStatus: 'CONFIRMED' },
  })
  const dBookingA2 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D002', tripId: demoTripA.id, userId: trav5.id, numTravelers: 1, totalAmount: 19500, bookingStatus: 'CONFIRMED' },
  })
  const dBookingA3 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D003', tripId: demoTripA.id, userId: trav6.id, numTravelers: 1, totalAmount: 22000, bookingStatus: 'CONFIRMED' },
  })

  // Accepted trip requests for Trip A
  await prisma.tripRequest.create({
    data: { tripId: demoTripA.id, userId: trav4.id, numTravelers: 2, message: 'We are a couple from Mumbai. Love trekking!', status: 'APPROVED', respondedAt: new Date(), responseNote: 'Welcome! Payment link sent.', bookingId: dBookingA1.id },
  })
  await prisma.tripRequest.create({
    data: { tripId: demoTripA.id, userId: trav5.id, numTravelers: 1, message: 'Solo traveler, huge Ladakh fan!', status: 'APPROVED', respondedAt: new Date(), responseNote: 'Approved. See you there!', bookingId: dBookingA2.id },
  })
  await prisma.tripRequest.create({
    data: { tripId: demoTripA.id, userId: trav6.id, numTravelers: 1, message: 'Photographer looking for landscapes.', status: 'APPROVED', respondedAt: new Date(), responseNote: 'Perfect fit — welcome aboard.', bookingId: dBookingA3.id },
  })

  // Pending requests for Trip A
  await prisma.tripRequest.create({
    data: { tripId: demoTripA.id, userId: trav7.id, numTravelers: 2, message: 'My friend and I are interested. Any spots left?', status: 'PENDING', approvalExpiresAt: inDays(5) },
  })
  await prisma.tripRequest.create({
    data: { tripId: demoTripA.id, userId: trav8.id, numTravelers: 1, message: 'First-time Ladakh trip. Please approve!', status: 'PENDING', approvalExpiresAt: inDays(5) },
  })

  // Payments for Trip A
  await prisma.paymentTransaction.createMany({
    data: [
      { bookingId: dBookingA1.id, type: 'PAYMENT', amount: 44000, status: 'CAPTURED', razorpayOrderId: 'order_demo_a01', razorpayPaymentId: 'pay_demo_a01' },
      { bookingId: dBookingA2.id, type: 'PAYMENT', amount: 19500, status: 'CAPTURED', razorpayOrderId: 'order_demo_a02', razorpayPaymentId: 'pay_demo_a02' },
      { bookingId: dBookingA3.id, type: 'PAYMENT', amount: 22000, status: 'CAPTURED', razorpayOrderId: 'order_demo_a03', razorpayPaymentId: 'pay_demo_a03' },
    ],
  })

  // Traveler details for Trip A
  await prisma.travelerDetail.createMany({
    data: [
      { bookingId: dBookingA1.id, name: 'Rohan Mehta', phone: '+919876500001', age: 29, gender: 'MALE', isPrimary: true },
      { bookingId: dBookingA1.id, name: 'Sonal Mehta', age: 27, gender: 'FEMALE' },
      { bookingId: dBookingA2.id, name: 'Ananya Iyer', phone: '+919876500002', age: 26, gender: 'FEMALE', isPrimary: true },
      { bookingId: dBookingA3.id, name: 'Karan Singh', phone: '+919876500003', age: 31, gender: 'MALE', isPrimary: true },
    ],
  })

  console.log('  ✓ Demo Trip A: ACTIVE (REQUEST_BASED) — 3 approved, 2 pending requests')

  // ── Trip B: ACTIVE, INSTANT booking mode ──────────────
  const demoTripB = await prisma.trip.create({
    data: {
      organizerId: demoOrg.id,
      destinationId: goa.id,
      title: 'Goa Party Weekend — 2N/3D',
      slug: 'demo-goa-party-weekend',
      tripType: 'BEACH',
      bookingMode: 'INSTANT',
      description: 'Instant-book Goa weekend! North Goa parties, beach vibes, water sports. No approval needed.',
      itinerary: [
        { day: 1, title: 'Arrival & Beach', description: 'Drive from Pune.', activities: [{ title: 'Pickup from Pune', time: '6:00 AM' }, { title: 'Baga beach', time: '2:00 PM' }, { title: 'Tito\'s night', time: '10:00 PM' }] },
        { day: 2, title: 'Water Sports', description: 'Full adventure day.', activities: [{ title: 'Parasailing', time: '9:00 AM' }, { title: 'Scuba diving', time: '11:00 AM' }, { title: 'Anjuna flea market', time: '4:00 PM' }] },
        { day: 3, title: 'Departure', description: 'Relax and head back.', activities: [{ title: 'Pool & brunch', time: '9:00 AM' }, { title: 'Drive back to Pune', time: '1:00 PM' }] },
      ],
      startDate: inDays(10),
      endDate: inDays(13),
      pricePerPerson: 5500,
      earlyBirdPrice: 4800,
      earlyBirdDeadline: inDays(5),
      minGroupSize: 8,
      maxGroupSize: 24,
      currentBookings: 5,
      inclusions: ['AC bus from Pune', 'Hotel (2N)', 'Breakfast & dinner', 'Water sports (2)'],
      exclusions: ['Lunch', 'Drinks', 'Personal expenses'],
      cancellationPolicy: 'FLEXIBLE',
      photos: ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'],
      status: 'ACTIVE',
      acceptingBookings: true,
      transferPoints: { create: [{ type: 'PICKUP', label: 'Pune — Shivaji Nagar', time: '6:00 AM' }] },
    },
  })

  const dBookingB1 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D004', tripId: demoTripB.id, userId: trav7.id, numTravelers: 2, totalAmount: 11000, bookingStatus: 'CONFIRMED' },
  })
  const dBookingB2 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D005', tripId: demoTripB.id, userId: trav8.id, numTravelers: 1, totalAmount: 4800, bookingStatus: 'CONFIRMED' },
  })
  const dBookingB3 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D006', tripId: demoTripB.id, userId: trav9.id, numTravelers: 2, totalAmount: 11000, bookingStatus: 'CONFIRMED' },
  })

  await prisma.paymentTransaction.createMany({
    data: [
      { bookingId: dBookingB1.id, type: 'PAYMENT', amount: 11000, status: 'CAPTURED', razorpayOrderId: 'order_demo_b01', razorpayPaymentId: 'pay_demo_b01' },
      { bookingId: dBookingB2.id, type: 'PAYMENT', amount: 4800, status: 'CAPTURED', razorpayOrderId: 'order_demo_b02', razorpayPaymentId: 'pay_demo_b02' },
      { bookingId: dBookingB3.id, type: 'PAYMENT', amount: 11000, status: 'CAPTURED', razorpayOrderId: 'order_demo_b03', razorpayPaymentId: 'pay_demo_b03' },
    ],
  })

  await prisma.travelerDetail.createMany({
    data: [
      { bookingId: dBookingB1.id, name: 'Meera Jain', phone: '+919876500004', age: 24, gender: 'FEMALE', isPrimary: true },
      { bookingId: dBookingB1.id, name: 'Simran Jain', age: 23, gender: 'FEMALE' },
      { bookingId: dBookingB2.id, name: 'Arjun Nair', phone: '+919876500005', age: 28, gender: 'MALE', isPrimary: true },
      { bookingId: dBookingB3.id, name: 'Pooja Sharma', phone: '+919876500006', age: 27, gender: 'FEMALE', isPrimary: true },
      { bookingId: dBookingB3.id, name: 'Neeta Sharma', age: 25, gender: 'FEMALE' },
    ],
  })

  // Pending requests for Trip B (to test cross-trip pending requests page)
  await prisma.tripRequest.create({
    data: { tripId: demoTripB.id, userId: trav4.id, numTravelers: 3, message: 'Can we get 3 spots? Planning a boys trip to Goa!', status: 'PENDING', approvalExpiresAt: inDays(4) },
  })
  await prisma.tripRequest.create({
    data: { tripId: demoTripB.id, userId: trav6.id, numTravelers: 2, message: 'Interested in joining with a friend. Is there room?', status: 'PENDING', approvalExpiresAt: inDays(6) },
  })

  console.log('  ✓ Demo Trip B: ACTIVE (INSTANT) — 3 confirmed bookings, 5 travelers, 2 pending requests')

  // ── Trip C: COMPLETED — some joined, some cancelled ───
  const demoTripC = await prisma.trip.create({
    data: {
      organizerId: demoOrg.id,
      destinationId: lonavala.id,
      title: 'Lonavala Monsoon Hike (Completed)',
      slug: 'demo-lonavala-monsoon-hike',
      tripType: 'TREKKING',
      bookingMode: 'INSTANT',
      description: 'Monsoon trek through Lonavala — waterfalls, misty valleys, and chai breaks. This trip has been completed.',
      itinerary: [
        { day: 1, title: 'Trek & Return', description: 'Full day hike.', activities: [{ title: 'Pickup', time: '5:00 AM' }, { title: 'Trek start', time: '7:30 AM' }, { title: 'Waterfall', time: '11:00 AM' }, { title: 'Return', time: '5:00 PM' }] },
      ],
      startDate: new Date(now.getTime() - 30 * 86400000),
      endDate: new Date(now.getTime() - 29 * 86400000),
      pricePerPerson: 1500,
      minGroupSize: 10,
      maxGroupSize: 25,
      currentBookings: 8,
      inclusions: ['Transport', 'Breakfast & lunch', 'Guide', 'First aid'],
      exclusions: ['Dinner', 'Rain gear'],
      cancellationPolicy: 'FLEXIBLE',
      photos: ['https://images.unsplash.com/photo-1625505826533-5c80aca7d157?w=800'],
      status: 'COMPLETED',
      acceptingBookings: false,
      transferPoints: { create: [{ type: 'PICKUP', label: 'Pune — Wakad Bridge', time: '5:00 AM' }] },
    },
  })

  // 6 confirmed + 2 cancelled for Trip C
  const dBookingC1 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D007', tripId: demoTripC.id, userId: trav4.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC2 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D008', tripId: demoTripC.id, userId: trav5.id, numTravelers: 2, totalAmount: 3000, bookingStatus: 'COMPLETED' },
  })
  const dBookingC3 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D009', tripId: demoTripC.id, userId: trav6.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC4 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D010', tripId: demoTripC.id, userId: traveler1.id, numTravelers: 2, totalAmount: 3000, bookingStatus: 'COMPLETED' },
  })
  const dBookingC5 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D011', tripId: demoTripC.id, userId: traveler2.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC6 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D012', tripId: demoTripC.id, userId: trav9.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  // Cancelled bookings
  await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D013', tripId: demoTripC.id, userId: trav7.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'CANCELLED', cancellationReason: 'Schedule conflict', cancelledAt: new Date(now.getTime() - 35 * 86400000), cancelledById: trav7.id },
  })
  await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D014', tripId: demoTripC.id, userId: trav8.id, numTravelers: 2, totalAmount: 3000, bookingStatus: 'CANCELLED', cancellationReason: 'Weather concerns', cancelledAt: new Date(now.getTime() - 33 * 86400000), cancelledById: trav8.id },
  })

  await prisma.paymentTransaction.createMany({
    data: [
      { bookingId: dBookingC1.id, type: 'PAYMENT', amount: 1500, status: 'CAPTURED', razorpayOrderId: 'order_demo_c01', razorpayPaymentId: 'pay_demo_c01' },
      { bookingId: dBookingC2.id, type: 'PAYMENT', amount: 3000, status: 'CAPTURED', razorpayOrderId: 'order_demo_c02', razorpayPaymentId: 'pay_demo_c02' },
      { bookingId: dBookingC3.id, type: 'PAYMENT', amount: 1500, status: 'CAPTURED', razorpayOrderId: 'order_demo_c03', razorpayPaymentId: 'pay_demo_c03' },
      { bookingId: dBookingC4.id, type: 'PAYMENT', amount: 3000, status: 'CAPTURED', razorpayOrderId: 'order_demo_c04', razorpayPaymentId: 'pay_demo_c04' },
      { bookingId: dBookingC5.id, type: 'PAYMENT', amount: 1500, status: 'CAPTURED', razorpayOrderId: 'order_demo_c05', razorpayPaymentId: 'pay_demo_c05' },
      { bookingId: dBookingC6.id, type: 'PAYMENT', amount: 1500, status: 'CAPTURED', razorpayOrderId: 'order_demo_c06', razorpayPaymentId: 'pay_demo_c06' },
    ],
  })

  // Traveler details for Trip C
  await prisma.travelerDetail.createMany({
    data: [
      { bookingId: dBookingC1.id, name: 'Rohan Mehta', phone: '+919876500001', age: 29, gender: 'MALE', isPrimary: true, emergencyContactName: 'Sonal Mehta', emergencyContactPhone: '+919876500010' },
      { bookingId: dBookingC2.id, name: 'Ananya Iyer', phone: '+919876500002', age: 26, gender: 'FEMALE', isPrimary: true, emergencyContactName: 'Suresh Iyer', emergencyContactPhone: '+919876500011' },
      { bookingId: dBookingC2.id, name: 'Priya Iyer', age: 24, gender: 'FEMALE' },
      { bookingId: dBookingC3.id, name: 'Karan Singh', phone: '+919876500003', age: 31, gender: 'MALE', isPrimary: true },
      { bookingId: dBookingC4.id, name: 'Amit Kulkarni', phone: '+919876543212', age: 28, gender: 'MALE', isPrimary: true, emergencyContactName: 'Riya Kulkarni', emergencyContactPhone: '+919876543220' },
      { bookingId: dBookingC4.id, name: 'Riya Kulkarni', phone: '+919876543220', age: 26, gender: 'FEMALE' },
      { bookingId: dBookingC5.id, name: 'Sneha Deshmukh', phone: '+919876543213', age: 25, gender: 'FEMALE', isPrimary: true },
      { bookingId: dBookingC6.id, name: 'Pooja Sharma', phone: '+919876500006', age: 27, gender: 'FEMALE', isPrimary: true },
    ],
  })

  // Reviews for completed Trip C
  await prisma.review.createMany({
    data: [
      { tripId: demoTripC.id, bookingId: dBookingC1.id, userId: trav4.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, comment: 'Excellent trek! Great guide and perfect monsoon vibes.' },
      { tripId: demoTripC.id, bookingId: dBookingC2.id, userId: trav5.id, overallRating: 4, organizationRating: 4, valueRating: 5, safetyRating: 4, comment: 'Lovely experience. Waterfalls were stunning.' },
      { tripId: demoTripC.id, bookingId: dBookingC3.id, userId: trav6.id, overallRating: 5, organizationRating: 5, valueRating: 4, safetyRating: 5, comment: 'Would go again. Top-notch safety measures.' },
      { tripId: demoTripC.id, bookingId: dBookingC4.id, userId: traveler1.id, overallRating: 4, organizationRating: 4, valueRating: 4, safetyRating: 4, comment: 'Good value for money. Trek was a bit strenuous though.' },
    ],
  })

  console.log('  ✓ Demo Trip C: COMPLETED — 6 completed, 2 cancelled, 4 reviews')

  // ── Trip D: COMPLETED — request-based, some rejected ──
  const demoTripD = await prisma.trip.create({
    data: {
      organizerId: demoOrg.id,
      destinationId: manali.id,
      title: 'Manali Winter Retreat (Completed)',
      slug: 'demo-manali-winter-retreat',
      tripType: 'ADVENTURE',
      bookingMode: 'REQUEST_BASED',
      description: 'Exclusive winter retreat in Manali — snow treks, bonfires, and cozy stays. Completed last month.',
      itinerary: [
        { day: 1, title: 'Arrival', description: 'Reach Manali.', activities: [{ title: 'Volvo arrival', time: '8:00 AM' }, { title: 'Check-in', time: '10:00 AM' }, { title: 'Bonfire', time: '7:00 PM' }] },
        { day: 2, title: 'Snow Day', description: 'Solang Valley.', activities: [{ title: 'Skiing', time: '9:00 AM' }, { title: 'Snowboarding', time: '1:00 PM' }] },
        { day: 3, title: 'Explore', description: 'Old Manali.', activities: [{ title: 'Hadimba Temple', time: '10:00 AM' }, { title: 'Cafe hopping', time: '2:00 PM' }] },
        { day: 4, title: 'Departure', description: 'Head back.', activities: [{ title: 'Breakfast', time: '8:00 AM' }, { title: 'Volvo departure', time: '10:00 AM' }] },
      ],
      startDate: new Date(now.getTime() - 45 * 86400000),
      endDate: new Date(now.getTime() - 41 * 86400000),
      pricePerPerson: 8500,
      minGroupSize: 6,
      maxGroupSize: 14,
      currentBookings: 5,
      inclusions: ['Volvo bus', 'Hotel (3N)', 'All meals', 'Snow activities', 'Bonfire'],
      exclusions: ['Shopping', 'Paragliding', 'Insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=800'],
      status: 'COMPLETED',
      acceptingBookings: false,
      transferPoints: { create: [{ type: 'PICKUP', label: 'Pune — Swargate', time: '6:00 PM' }] },
    },
  })

  // Approved & completed bookings
  const dBookingD1 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D015', tripId: demoTripD.id, userId: trav4.id, numTravelers: 2, totalAmount: 17000, bookingStatus: 'COMPLETED' },
  })
  const dBookingD2 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D016', tripId: demoTripD.id, userId: trav5.id, numTravelers: 1, totalAmount: 8500, bookingStatus: 'COMPLETED' },
  })
  const dBookingD3 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D017', tripId: demoTripD.id, userId: traveler3.id, numTravelers: 2, totalAmount: 17000, bookingStatus: 'COMPLETED' },
  })

  // Approved requests → bookings
  await prisma.tripRequest.create({
    data: { tripId: demoTripD.id, userId: trav4.id, numTravelers: 2, message: 'Couple looking for winter escape.', status: 'CONVERTED', respondedAt: new Date(now.getTime() - 50 * 86400000), responseNote: 'Approved!', bookingId: dBookingD1.id },
  })
  await prisma.tripRequest.create({
    data: { tripId: demoTripD.id, userId: trav5.id, numTravelers: 1, message: 'Solo traveler here.', status: 'CONVERTED', respondedAt: new Date(now.getTime() - 50 * 86400000), responseNote: 'Welcome.', bookingId: dBookingD2.id },
  })
  await prisma.tripRequest.create({
    data: { tripId: demoTripD.id, userId: traveler3.id, numTravelers: 2, message: 'Me and my buddy want to join.', status: 'CONVERTED', respondedAt: new Date(now.getTime() - 49 * 86400000), responseNote: 'Confirmed.', bookingId: dBookingD3.id },
  })

  // Rejected requests
  await prisma.tripRequest.create({
    data: { tripId: demoTripD.id, userId: trav8.id, numTravelers: 3, message: 'Group of 3 friends, can we join?', status: 'REJECTED', respondedAt: new Date(now.getTime() - 48 * 86400000), responseNote: 'Sorry, not enough spots for 3.' },
  })
  await prisma.tripRequest.create({
    data: { tripId: demoTripD.id, userId: trav9.id, numTravelers: 1, message: 'Any last-minute spots?', status: 'REJECTED', respondedAt: new Date(now.getTime() - 46 * 86400000), responseNote: 'Trip is full. Check our next batch!' },
  })

  await prisma.paymentTransaction.createMany({
    data: [
      { bookingId: dBookingD1.id, type: 'PAYMENT', amount: 17000, status: 'CAPTURED', razorpayOrderId: 'order_demo_d01', razorpayPaymentId: 'pay_demo_d01' },
      { bookingId: dBookingD2.id, type: 'PAYMENT', amount: 8500, status: 'CAPTURED', razorpayOrderId: 'order_demo_d02', razorpayPaymentId: 'pay_demo_d02' },
      { bookingId: dBookingD3.id, type: 'PAYMENT', amount: 17000, status: 'CAPTURED', razorpayOrderId: 'order_demo_d03', razorpayPaymentId: 'pay_demo_d03' },
    ],
  })

  // Traveler details for Trip D
  await prisma.travelerDetail.createMany({
    data: [
      { bookingId: dBookingD1.id, name: 'Rohan Mehta', phone: '+919876500001', age: 29, gender: 'MALE', isPrimary: true, emergencyContactName: 'Sonal Mehta', emergencyContactPhone: '+919876500010' },
      { bookingId: dBookingD1.id, name: 'Sonal Mehta', age: 27, gender: 'FEMALE' },
      { bookingId: dBookingD2.id, name: 'Ananya Iyer', phone: '+919876500002', age: 26, gender: 'FEMALE', isPrimary: true },
      { bookingId: dBookingD3.id, name: 'Vikram Joshi', phone: '+919876543214', age: 30, gender: 'MALE', isPrimary: true, emergencyContactName: 'Neha Joshi', emergencyContactPhone: '+919876543221' },
      { bookingId: dBookingD3.id, name: 'Neha Joshi', phone: '+919876543221', age: 28, gender: 'FEMALE' },
    ],
  })

  // Reviews for Trip D
  await prisma.review.createMany({
    data: [
      { tripId: demoTripD.id, bookingId: dBookingD1.id, userId: trav4.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, comment: 'Best winter trip ever! Manali was magical.' },
      { tripId: demoTripD.id, bookingId: dBookingD2.id, userId: trav5.id, overallRating: 4, organizationRating: 5, valueRating: 4, safetyRating: 5, comment: 'Amazing arrangements. Solang was a blast!' },
      { tripId: demoTripD.id, bookingId: dBookingD3.id, userId: traveler3.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 4, comment: 'Well organized, great bonfire nights.' },
    ],
  })

  console.log('  ✓ Demo Trip D: COMPLETED (REQUEST_BASED) — 3 joined, 2 rejected, 3 reviews')

  // ── Trip E: ACTIVE, REQUEST_BASED — only pending requests ──
  const demoTripE = await prisma.trip.create({
    data: {
      organizerId: demoOrg.id,
      destinationId: rishikesh.id,
      title: 'Rishikesh Yoga & Rafting Retreat — 3N/4D',
      slug: 'demo-rishikesh-yoga-rafting',
      tripType: 'ADVENTURE',
      bookingMode: 'REQUEST_BASED',
      description: 'A unique blend of white-water rafting, yoga sessions, and riverside camping in Rishikesh. Small curated group.',
      itinerary: [
        { day: 1, title: 'Arrival & Yoga', description: 'Reach Rishikesh, evening yoga.', activities: [{ title: 'Check-in', time: '12:00 PM' }, { title: 'Yoga session', time: '5:00 PM' }, { title: 'Bonfire', time: '8:00 PM' }] },
        { day: 2, title: 'Rafting Day', description: '16km rafting on the Ganges.', activities: [{ title: '16km rafting', time: '9:00 AM' }, { title: 'Cliff jumping', time: '1:00 PM' }, { title: 'Camping', time: '5:00 PM' }] },
        { day: 3, title: 'Trek & Explore', description: 'Waterfall trek.', activities: [{ title: 'Neer Garh waterfall trek', time: '8:00 AM' }, { title: 'Ram Jhula', time: '2:00 PM' }, { title: 'Ganga Aarti', time: '6:30 PM' }] },
        { day: 4, title: 'Departure', description: 'Morning yoga and leave.', activities: [{ title: 'Sunrise yoga', time: '6:00 AM' }, { title: 'Breakfast', time: '8:00 AM' }, { title: 'Departure', time: '10:00 AM' }] },
      ],
      startDate: inDays(25),
      endDate: inDays(29),
      pricePerPerson: 6500,
      earlyBirdPrice: 5500,
      earlyBirdDeadline: inDays(15),
      minGroupSize: 8,
      maxGroupSize: 16,
      currentBookings: 0,
      inclusions: ['Transport from Delhi', 'Camping + hostel (3N)', 'All meals', 'Rafting', 'Yoga sessions', 'Trek guide'],
      exclusions: ['Personal expenses', 'Bungee jumping', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=800'],
      status: 'ACTIVE',
      acceptingBookings: true,
    },
  })

  // Pending requests for Trip E
  await prisma.tripRequest.create({
    data: { tripId: demoTripE.id, userId: trav9.id, numTravelers: 2, message: 'Looking for a yoga + adventure combo. This seems perfect for me and my sister!', status: 'PENDING', approvalExpiresAt: inDays(7) },
  })
  await prisma.tripRequest.create({
    data: { tripId: demoTripE.id, userId: traveler2.id, numTravelers: 1, message: 'Solo female traveler. Is this group safe and beginner-friendly for rafting?', status: 'PENDING', approvalExpiresAt: inDays(6) },
  })
  await prisma.tripRequest.create({
    data: { tripId: demoTripE.id, userId: traveler3.id, numTravelers: 4, message: 'Group of 4 college friends. We all want to try rafting for the first time!', status: 'PENDING', approvalExpiresAt: inDays(5) },
  })

  console.log('  ✓ Demo Trip E: ACTIVE (REQUEST_BASED) — 3 pending requests')

  // ══════════════════════════════════════════════════════
  // ── Bulk Payment Data — All Cases + Pagination ───────
  // ══════════════════════════════════════════════════════
  //
  // Covers every PaymentType × PaymentStatus combo:
  //   PAYMENT   → CAPTURED, AUTHORIZED, FAILED, INITIATED, REFUNDED
  //   REFUND    → CAPTURED, INITIATED
  //   ESCROW_RELEASE → CAPTURED
  //
  // Covers every BookingStatus:
  //   CONFIRMED, COMPLETED, CANCELLED, REFUNDED, PENDING_PAYMENT, EXPIRED
  // ──────────────────────────────────────────────────────

  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000)
  const pricePool = [1299, 2499, 3500, 4999, 5500, 6200, 7400, 8999, 10500, 11998, 12500, 13999, 15000, 16500, 17999, 18500, 19999, 21000, 22500, 24999, 26000, 27500]

  // Helper: create booking + one or more payment records
  async function seedPaymentCase(opts: {
    ref: string; tripId: string; userId: string; amount: number; travelers: number; dBack: number
    bookingStatus: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PENDING_PAYMENT' | 'EXPIRED'
    payments: Array<{ type: 'PAYMENT' | 'REFUND' | 'ESCROW_RELEASE'; status: 'INITIATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED'; failureReason?: string; offsetDays?: number }>
    cancelReason?: string
  }) {
    const booking = await prisma.booking.create({
      data: {
        bookingRef: opts.ref,
        tripId: opts.tripId,
        userId: opts.userId,
        numTravelers: opts.travelers,
        totalAmount: opts.amount,
        bookingStatus: opts.bookingStatus,
        ...(opts.bookingStatus === 'CANCELLED' && {
          cancellationReason: opts.cancelReason ?? 'Plans changed',
          cancelledAt: daysAgo(opts.dBack),
          cancelledById: opts.userId,
        }),
        ...(opts.bookingStatus === 'PENDING_PAYMENT' && { expiresAt: inDays(2) }),
        ...(opts.bookingStatus === 'EXPIRED' && { expiresAt: daysAgo(opts.dBack - 1) }),
      },
    })
    for (const [j, p] of opts.payments.entries()) {
      const offset = p.offsetDays ?? 0
      await prisma.paymentTransaction.create({
        data: {
          bookingId: booking.id,
          type: p.type,
          amount: opts.amount,
          status: p.status,
          razorpayOrderId: `order_${opts.ref.toLowerCase()}_${j}`,
          ...(p.status === 'CAPTURED' && p.type === 'PAYMENT' && { razorpayPaymentId: `pay_${opts.ref.toLowerCase()}_${j}` }),
          ...(p.status === 'AUTHORIZED' && { razorpayPaymentId: `pay_${opts.ref.toLowerCase()}_${j}` }),
          ...(p.status === 'REFUNDED' && p.type === 'PAYMENT' && { razorpayPaymentId: `pay_${opts.ref.toLowerCase()}_${j}` }),
          ...(p.type === 'REFUND' && p.status === 'CAPTURED' && { razorpayRefundId: `rfnd_${opts.ref.toLowerCase()}_${j}` }),
          ...(p.type === 'ESCROW_RELEASE' && { razorpayTransferId: `trf_${opts.ref.toLowerCase()}_${j}` }),
          ...(p.failureReason && { failureReason: p.failureReason }),
          createdAt: daysAgo(opts.dBack - offset),
        },
      })
    }
  }

  // ── amit@gmail.com — all cases for traveler view ──────
  const amitTrips = [trip2, trip3, trip5, trip7, trip8, demoTripA, demoTripB, demoTripD, demoTripE]
  let n = 0
  const amt = (i: number) => pricePool[i % pricePool.length]
  const aTrip = (i: number) => amitTrips[i % amitTrips.length].id

  // 10 × PAYMENT/CAPTURED — happy path (CONFIRMED bookings)
  for (let i = 0; i < 10; i++) {
    await seedPaymentCase({
      ref: `AMT-CAP-${String(++n).padStart(3, '0')}`, tripId: aTrip(i), userId: traveler1.id,
      amount: amt(i), travelers: (i % 3) + 1, dBack: 60 - i * 3,
      bookingStatus: 'CONFIRMED',
      payments: [{ type: 'PAYMENT', status: 'CAPTURED' }],
    })
  }

  // 2 × PAYMENT/CAPTURED — COMPLETED bookings (past trips)
  for (let i = 0; i < 2; i++) {
    await seedPaymentCase({
      ref: `AMT-CMP-${String(++n).padStart(3, '0')}`, tripId: aTrip(i + 10), userId: traveler1.id,
      amount: amt(i + 10), travelers: 2, dBack: 70 + i * 5,
      bookingStatus: 'COMPLETED',
      payments: [{ type: 'PAYMENT', status: 'CAPTURED' }],
    })
  }

  // 2 × PAYMENT/AUTHORIZED — authorized but not yet captured
  for (let i = 0; i < 2; i++) {
    await seedPaymentCase({
      ref: `AMT-AUTH-${String(++n).padStart(3, '0')}`, tripId: aTrip(i + 2), userId: traveler1.id,
      amount: amt(i + 12), travelers: 1, dBack: 3 + i,
      bookingStatus: 'CONFIRMED',
      payments: [{ type: 'PAYMENT', status: 'AUTHORIZED' }],
    })
  }

  // 2 × PAYMENT/FAILED — failed payments
  for (let i = 0; i < 2; i++) {
    await seedPaymentCase({
      ref: `AMT-FAIL-${String(++n).padStart(3, '0')}`, tripId: aTrip(i + 4), userId: traveler1.id,
      amount: amt(i + 14), travelers: 1, dBack: 10 + i * 5,
      bookingStatus: 'PENDING_PAYMENT',
      payments: [{ type: 'PAYMENT', status: 'FAILED', failureReason: i === 0 ? 'Insufficient funds' : 'Bank declined' }],
    })
  }

  // 2 × PAYMENT/INITIATED — just started, awaiting gateway
  for (let i = 0; i < 2; i++) {
    await seedPaymentCase({
      ref: `AMT-INIT-${String(++n).padStart(3, '0')}`, tripId: aTrip(i + 6), userId: traveler1.id,
      amount: amt(i + 16), travelers: 1, dBack: 1 + i,
      bookingStatus: 'PENDING_PAYMENT',
      payments: [{ type: 'PAYMENT', status: 'INITIATED' }],
    })
  }

  // 1 × PAYMENT/REFUNDED — original payment marked as refunded
  await seedPaymentCase({
    ref: `AMT-PRFN-${String(++n).padStart(3, '0')}`, tripId: aTrip(7), userId: traveler1.id,
    amount: amt(18), travelers: 2, dBack: 25,
    bookingStatus: 'REFUNDED',
    payments: [
      { type: 'PAYMENT', status: 'REFUNDED' },
      { type: 'REFUND', status: 'CAPTURED', offsetDays: 2 },
    ],
  })

  // 2 × CANCELLED booking — PAYMENT/CAPTURED + REFUND/CAPTURED
  for (let i = 0; i < 2; i++) {
    await seedPaymentCase({
      ref: `AMT-CANC-${String(++n).padStart(3, '0')}`, tripId: aTrip(i + 3), userId: traveler1.id,
      amount: amt(i + 19), travelers: 1, dBack: 30 + i * 5,
      bookingStatus: 'CANCELLED',
      cancelReason: i === 0 ? 'Schedule conflict' : 'Found better deal',
      payments: [
        { type: 'PAYMENT', status: 'CAPTURED' },
        { type: 'REFUND', status: 'CAPTURED', offsetDays: 3 },
      ],
    })
  }

  // 1 × CANCELLED booking — PAYMENT/CAPTURED + REFUND/INITIATED (refund pending)
  await seedPaymentCase({
    ref: `AMT-CRFP-${String(++n).padStart(3, '0')}`, tripId: aTrip(5), userId: traveler1.id,
    amount: amt(21), travelers: 1, dBack: 8,
    bookingStatus: 'CANCELLED',
    cancelReason: 'Health issue',
    payments: [
      { type: 'PAYMENT', status: 'CAPTURED' },
      { type: 'REFUND', status: 'INITIATED', offsetDays: 1 },
    ],
  })

  // 1 × EXPIRED booking — PAYMENT/INITIATED that timed out
  await seedPaymentCase({
    ref: `AMT-EXP-${String(++n).padStart(3, '0')}`, tripId: aTrip(8), userId: traveler1.id,
    amount: amt(5), travelers: 1, dBack: 15,
    bookingStatus: 'EXPIRED',
    payments: [{ type: 'PAYMENT', status: 'INITIATED' }],
  })

  // 1 × ESCROW_RELEASE/CAPTURED — organizer payout for completed trip
  await seedPaymentCase({
    ref: `AMT-ESC-${String(++n).padStart(3, '0')}`, tripId: aTrip(0), userId: traveler1.id,
    amount: amt(7), travelers: 2, dBack: 50,
    bookingStatus: 'COMPLETED',
    payments: [
      { type: 'PAYMENT', status: 'CAPTURED' },
      { type: 'ESCROW_RELEASE', status: 'CAPTURED', offsetDays: 14 },
    ],
  })

  console.log(`  ✓ ${n} extra bookings for amit@gmail.com (all payment cases)`)
  console.log('     PAYMENT: CAPTURED(12), AUTHORIZED(2), FAILED(2), INITIATED(3), REFUNDED(1)')
  console.log('     REFUND: CAPTURED(3), INITIATED(1)')
  console.log('     ESCROW_RELEASE: CAPTURED(1)')
  console.log('     BookingStatus: CONFIRMED, COMPLETED, CANCELLED, REFUNDED, PENDING_PAYMENT, EXPIRED')

  // ── Demo organizer Trip B — all cases for organizer view ──
  const orgTravelers = [trav4, trav5, trav6, trav7, trav8, trav9, traveler2, traveler3]
  let m = 0

  // 12 × PAYMENT/CAPTURED
  for (let i = 0; i < 12; i++) {
    await seedPaymentCase({
      ref: `ORG-CAP-${String(++m).padStart(3, '0')}`, tripId: demoTripB.id,
      userId: orgTravelers[i % orgTravelers.length].id,
      amount: amt(i + 5), travelers: (i % 2) + 1, dBack: 50 - i * 3,
      bookingStatus: 'CONFIRMED',
      payments: [{ type: 'PAYMENT', status: 'CAPTURED' }],
    })
  }

  // 2 × PAYMENT/AUTHORIZED
  for (let i = 0; i < 2; i++) {
    await seedPaymentCase({
      ref: `ORG-AUTH-${String(++m).padStart(3, '0')}`, tripId: demoTripB.id,
      userId: orgTravelers[(i + 4) % orgTravelers.length].id,
      amount: amt(i + 17), travelers: 1, dBack: 5 + i,
      bookingStatus: 'CONFIRMED',
      payments: [{ type: 'PAYMENT', status: 'AUTHORIZED' }],
    })
  }

  // 2 × PAYMENT/FAILED
  for (let i = 0; i < 2; i++) {
    await seedPaymentCase({
      ref: `ORG-FAIL-${String(++m).padStart(3, '0')}`, tripId: demoTripB.id,
      userId: orgTravelers[(i + 6) % orgTravelers.length].id,
      amount: amt(i + 19), travelers: 1, dBack: 12 + i * 4,
      bookingStatus: 'PENDING_PAYMENT',
      payments: [{ type: 'PAYMENT', status: 'FAILED', failureReason: i === 0 ? 'Card expired' : 'Network timeout' }],
    })
  }

  // 2 × CANCELLED + REFUND/CAPTURED
  for (let i = 0; i < 2; i++) {
    await seedPaymentCase({
      ref: `ORG-CANC-${String(++m).padStart(3, '0')}`, tripId: demoTripB.id,
      userId: orgTravelers[(i + 2) % orgTravelers.length].id,
      amount: amt(i + 8), travelers: 1, dBack: 35 + i * 5,
      bookingStatus: 'CANCELLED',
      cancelReason: 'Changed plans',
      payments: [
        { type: 'PAYMENT', status: 'CAPTURED' },
        { type: 'REFUND', status: 'CAPTURED', offsetDays: 2 },
      ],
    })
  }

  // 1 × ESCROW_RELEASE/CAPTURED
  await seedPaymentCase({
    ref: `ORG-ESC-${String(++m).padStart(3, '0')}`, tripId: demoTripB.id,
    userId: orgTravelers[0].id,
    amount: amt(15), travelers: 2, dBack: 45,
    bookingStatus: 'COMPLETED',
    payments: [
      { type: 'PAYMENT', status: 'CAPTURED' },
      { type: 'ESCROW_RELEASE', status: 'CAPTURED', offsetDays: 10 },
    ],
  })

  // 1 × PAYMENT/INITIATED
  await seedPaymentCase({
    ref: `ORG-INIT-${String(++m).padStart(3, '0')}`, tripId: demoTripB.id,
    userId: orgTravelers[3].id,
    amount: amt(2), travelers: 1, dBack: 1,
    bookingStatus: 'PENDING_PAYMENT',
    payments: [{ type: 'PAYMENT', status: 'INITIATED' }],
  })

  console.log(`  ✓ ${m} extra bookings for demo organizer Trip B (all payment cases)`)
  console.log('     PAYMENT: CAPTURED(14), AUTHORIZED(2), FAILED(2), INITIATED(1)')
  console.log('     REFUND: CAPTURED(2)')
  console.log('     ESCROW_RELEASE: CAPTURED(1)')

  // Revenue summary:
  // Trip A: ₹85,500 (44000 + 19500 + 22000)
  // Trip B: ₹26,800 (11000 + 4800 + 11000)
  // Trip C: ₹12,000 (1500*8 confirmed)
  // Trip D: ₹42,500 (17000 + 8500 + 17000)
  // Total: ₹166,800

  console.log('\n✅ Seed complete!\n')
  console.log('  📊 Revenue Summary (Demo Organizer):')
  console.log('     Trip A (Ladakh):  ₹85,500  — 4 travelers, 2 pending requests')
  console.log('     Trip B (Goa):     ₹26,800  — 5 travelers, instant book')
  console.log('     Trip C (Lonavala):₹12,000  — 8 completed, 2 cancelled')
  console.log('     Trip D (Manali):  ₹42,500  — 5 completed, 2 rejected requests')
  console.log('     Total Revenue:   ₹166,800')
  console.log('')
  console.log('  🔐 Test Accounts (password: Test@1234):')
  console.log('     admin@travelapp.com      (ADMIN)')
  console.log('     rahul@tripvibes.com      (ORGANIZER)')
  console.log('     priya@wanderlust.in      (ORGANIZER)')
  console.log('     demo.organizer@test.com  (ORGANIZER) ← Dashboard demo')
  console.log('     amit@gmail.com           (TRAVELER)')
  console.log('     sneha@gmail.com          (TRAVELER)')
  console.log('     vikram@gmail.com         (TRAVELER)')
  console.log('     rohan@gmail.com          (TRAVELER)')
  console.log('     ananya@gmail.com         (TRAVELER)')
  console.log('     karan@gmail.com          (TRAVELER)')
  console.log('     meera@gmail.com          (TRAVELER)')
  console.log('     arjun@gmail.com          (TRAVELER)')
  console.log('     pooja@gmail.com          (TRAVELER)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

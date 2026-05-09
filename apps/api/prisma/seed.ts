import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...\n')

  // ── Clean existing data (reverse FK order) ──────────
  await prisma.walletTransaction.deleteMany()
  await prisma.wallet.deleteMany()
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

  // Additional organizers for PENDING + REJECTED verification status
  const organizer3User = await prisma.user.create({
    data: {
      name: 'Siddharth Rao',
      email: 'sid@trekbuddy.in',
      passwordHash,
      role: 'ORGANIZER',
      phone: '+919876543214',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=SR',
    },
  })
  const organizer4User = await prisma.user.create({
    data: {
      name: 'Nisha Gupta',
      email: 'nisha@roadtrips.co',
      passwordHash,
      role: 'ORGANIZER',
      phone: '+919876543215',
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=NG',
    },
  })

  console.log('  ✓ Created 8 users (1 admin, 4 organizers, 3 travelers)')

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

  // PENDING organizer — just submitted, awaiting verification
  const org3 = await prisma.organizerProfile.create({
    data: {
      userId: organizer3User.id,
      businessName: 'TrekBuddy Co',
      description: 'Hiking and trekking adventures around the Western Ghats.',
      verificationStatus: 'PENDING',
      rating: 0,
      totalReviews: 0,
      totalTripsCompleted: 0,
      bankAccountLinked: false,
      commissionRate: 10.0,
    },
  })

  // REJECTED organizer — failed verification
  await prisma.organizerProfile.create({
    data: {
      userId: organizer4User.id,
      businessName: 'RoadTrips.co',
      description: 'Budget road trips across India.',
      verificationStatus: 'REJECTED',
      rating: 0,
      totalReviews: 0,
      totalTripsCompleted: 0,
      bankAccountLinked: false,
      commissionRate: 10.0,
    },
  })

  console.log('  ✓ Created 4 organizer profiles (2 APPROVED, 1 PENDING, 1 REJECTED)')

  // ── Destinations ────────────────────────────────────
  const goa = await prisma.destination.create({
    data: { name: 'Goa', slug: 'goa', state: 'Goa', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800' },
  })
  const lonavala = await prisma.destination.create({
    data: { name: 'Lonavala', slug: 'lonavala', state: 'Maharashtra', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1625505826533-5c80aca7d157?w=800' },
  })
  const ladakh = await prisma.destination.create({
    data: { name: 'Ladakh', slug: 'ladakh', state: 'Ladakh', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800' },
  })
  const manali = await prisma.destination.create({
    data: { name: 'Manali', slug: 'manali', state: 'Himachal Pradesh', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=800' },
  })
  const rishikesh = await prisma.destination.create({
    data: { name: 'Rishikesh', slug: 'rishikesh', state: 'Uttarakhand', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=800' },
  })
  const alibaug = await prisma.destination.create({
    data: { name: 'Alibaug', slug: 'alibaug', state: 'Maharashtra', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800' },
  })
  const hampi = await prisma.destination.create({
    data: { name: 'Hampi', slug: 'hampi', state: 'Karnataka', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800' },
  })
  const jaipur = await prisma.destination.create({
    data: { name: 'Jaipur', slug: 'jaipur', state: 'Rajasthan', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800' },
  })
  const mumbai = await prisma.destination.create({
    data: { name: 'Mumbai to Goa', slug: 'mumbai-goa-highway', state: 'Maharashtra', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800' },
  })

  console.log('  ✓ Created 9 destinations')

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

  // ── Trip 9: CULTURAL trip type ───────────────────────
  const trip9 = await prisma.trip.create({
    data: {
      organizerId: org2.id,
      destinationId: jaipur.id,
      title: 'Jaipur Heritage Walk — 2N/3D',
      slug: 'jaipur-heritage-walk-2n3d',
      tripType: 'CULTURAL',
      bookingMode: 'INSTANT',
      description: 'Explore the Pink City! Visit Amber Fort, Hawa Mahal, City Palace, and experience authentic Rajasthani culture, food, and crafts.',
      itinerary: [
        { day: 1, title: 'Arrival & City Tour', description: 'Explore Jaipur city.', activities: [{ title: 'Hawa Mahal', time: '10:00 AM' }, { title: 'City Palace', time: '2:00 PM' }, { title: 'Rajasthani thali dinner', time: '7:30 PM' }] },
        { day: 2, title: 'Forts & Crafts', description: 'Amber Fort and local artisans.', activities: [{ title: 'Amber Fort', time: '8:00 AM' }, { title: 'Block printing workshop', time: '2:00 PM' }, { title: 'Nahargarh sunset', time: '5:30 PM' }] },
        { day: 3, title: 'Departure', description: 'Markets and departure.', activities: [{ title: 'Johari Bazaar shopping', time: '9:00 AM' }, { title: 'Departure', time: '1:00 PM' }] },
      ],
      startDate: inDays(18),
      endDate: inDays(21),
      pricePerPerson: 4599,
      minGroupSize: 8,
      maxGroupSize: 20,
      currentBookings: 5,
      inclusions: ['Train from Pune', 'Hotel (2N)', 'Breakfast & dinner', 'Fort entry tickets', 'Heritage guide'],
      exclusions: ['Lunch', 'Shopping', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800'],
      status: 'ACTIVE',
      transferPoints: {
        create: [
          { type: 'PICKUP', label: 'Pune Junction Railway Station', time: '6:00 PM', sortOrder: 0 },
          { type: 'DROP', label: 'Pune Junction Railway Station', time: '8:00 PM', sortOrder: 1 },
        ],
      },
    },
  })

  // ── Trip 10: ROAD_TRIP trip type ───────────────────────
  const trip10 = await prisma.trip.create({
    data: {
      organizerId: org1.id,
      destinationId: mumbai.id,
      title: 'Mumbai–Goa Coastal Road Trip — 3N/4D',
      slug: 'mumbai-goa-coastal-road-trip',
      tripType: 'ROAD_TRIP',
      bookingMode: 'INSTANT',
      description: 'Epic coastal road trip from Mumbai to Goa via the Konkan coast! Stop at hidden beaches, forts, and seafood shacks along the way.',
      itinerary: [
        { day: 1, title: 'Mumbai to Alibaug', description: 'Start the road trip.', activities: [{ title: 'Mumbai pickup', time: '6:00 AM' }, { title: 'Alibaug beach stop', time: '10:00 AM' }, { title: 'Murud-Janjira Fort', time: '2:00 PM' }] },
        { day: 2, title: 'Alibaug to Ganpatipule', description: 'Coastal drive south.', activities: [{ title: 'Drive along coast', time: '8:00 AM' }, { title: 'Ganpatipule temple', time: '1:00 PM' }, { title: 'Beach camping', time: '5:00 PM' }] },
        { day: 3, title: 'Ganpatipule to Goa', description: 'Final stretch to Goa.', activities: [{ title: 'Scenic drive', time: '8:00 AM' }, { title: 'Palolem beach', time: '3:00 PM' }, { title: 'Beach party', time: '9:00 PM' }] },
        { day: 4, title: 'Goa & Departure', description: 'Explore Goa, fly back.', activities: [{ title: 'North Goa', time: '9:00 AM' }, { title: 'Airport drop', time: '4:00 PM' }] },
      ],
      startDate: inDays(25),
      endDate: inDays(29),
      pricePerPerson: 8499,
      earlyBirdPrice: 7499,
      earlyBirdDeadline: inDays(15),
      minGroupSize: 4,
      maxGroupSize: 8,
      currentBookings: 3,
      inclusions: ['SUV rental', 'Fuel', 'Hotel + camping (3N)', 'Breakfast & dinner', 'Fort tickets'],
      exclusions: ['Flights', 'Lunch', 'Personal expenses'],
      cancellationPolicy: 'STRICT',
      photos: ['https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'],
      status: 'ACTIVE',
      transferPoints: {
        create: [
          { type: 'PICKUP', label: 'Mumbai — Dadar TT', time: '6:00 AM', sortOrder: 0 },
          { type: 'DROP', label: 'Goa — Dabolim Airport', time: '4:00 PM', sortOrder: 1 },
        ],
      },
    },
  })

  // ── Trip 11: FULL status (sold out) ───────────────────
  await prisma.trip.create({
    data: {
      organizerId: org1.id,
      destinationId: alibaug.id,
      title: 'Alibaug Beach Day — SOLD OUT',
      slug: 'alibaug-beach-day-sold-out',
      tripType: 'WEEKEND',
      bookingMode: 'INSTANT',
      description: 'Quick beach getaway to Alibaug from Pune. This trip is SOLD OUT!',
      itinerary: [
        { day: 1, title: 'Beach Day', description: 'Full day at Alibaug.', activities: [{ title: 'Ferry to Alibaug', time: '8:00 AM' }, { title: 'Kolaba Fort', time: '11:00 AM' }, { title: 'Beach games', time: '2:00 PM' }, { title: 'Ferry back', time: '6:00 PM' }] },
      ],
      startDate: inDays(5),
      endDate: inDays(6),
      pricePerPerson: 999,
      minGroupSize: 15,
      maxGroupSize: 15,
      currentBookings: 15,
      inclusions: ['Ferry tickets', 'Lunch', 'Beach activities'],
      exclusions: ['Snacks', 'Personal expenses'],
      cancellationPolicy: 'FLEXIBLE',
      photos: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'],
      status: 'FULL',
      acceptingBookings: false,
      transferPoints: {
        create: [
          { type: 'PICKUP', label: 'Mumbai — Gateway of India', time: '7:00 AM', sortOrder: 0 },
          { type: 'DROP', label: 'Mumbai — Gateway of India', time: '8:00 PM', sortOrder: 1 },
        ],
      },
    },
  })

  // ── Trip 12: CANCELLED status ─────────────────────────
  await prisma.trip.create({
    data: {
      organizerId: org2.id,
      destinationId: hampi.id,
      title: 'Hampi Heritage Tour — CANCELLED',
      slug: 'hampi-heritage-tour-cancelled',
      tripType: 'CULTURAL',
      bookingMode: 'REQUEST_BASED',
      description: 'Explore the ancient ruins of Hampi. Unfortunately, this trip has been cancelled due to insufficient bookings.',
      itinerary: [
        { day: 1, title: 'Arrival', description: 'Reach Hampi.', activities: [{ title: 'Check-in', time: '10:00 AM' }, { title: 'Virupaksha Temple', time: '3:00 PM' }] },
        { day: 2, title: 'Ruins Tour', description: 'Full day exploration.', activities: [{ title: 'Vittala Temple', time: '8:00 AM' }, { title: 'Elephant Stables', time: '12:00 PM' }, { title: 'Sunset at Hemakuta', time: '5:30 PM' }] },
        { day: 3, title: 'Departure', description: 'Head back.', activities: [{ title: 'Breakfast', time: '8:00 AM' }, { title: 'Departure', time: '10:00 AM' }] },
      ],
      startDate: inDays(35),
      endDate: inDays(38),
      pricePerPerson: 5499,
      minGroupSize: 10,
      maxGroupSize: 20,
      currentBookings: 2,
      inclusions: ['Transport from Pune', 'Hotel (2N)', 'All meals', 'Guide', 'Entry tickets'],
      exclusions: ['Shopping', 'Tips'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800'],
      status: 'CANCELLED',
      acceptingBookings: false,
    },
  })

  console.log('  ✓ Created 12 trips (8 ACTIVE, 1 DRAFT, 1 FULL, 1 CANCELLED, 1 COMPLETED)')

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
      { bookingId: booking4.id, name: 'Rohit M', age: 27, gender: 'OTHER' },
      { bookingId: booking4.id, name: 'Saurabh P', age: 29, gender: 'PREFER_NOT_TO_SAY' },
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
  await prisma.review.create({
    data: {
      tripId: trip1.id,
      bookingId: booking1.id,
      userId: traveler1.id,
      overallRating: 5,
      organizationRating: 5,
      valueRating: 4,
      safetyRating: 5,
      accuracyRating: 5,
      comment: 'Amazing trip! The organizer was super helpful and everything was well planned. Goa beaches were stunning. Highly recommend TripVibes!',
      photos: ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600'],
      organizerReply: 'Thank you Amit! So glad you and Riya had a great time. The monsoon Goa vibes are unbeatable. See you next season! 🏖️',
      organizerReplyAt: new Date(now.getTime() - 2 * 86400000),
      createdAt: new Date(now.getTime() - 5 * 86400000),
    },
  })
  await prisma.review.create({
    data: {
      tripId: trip2.id,
      bookingId: booking2.id,
      userId: traveler2.id,
      overallRating: 4,
      organizationRating: 4,
      valueRating: 5,
      safetyRating: 4,
      accuracyRating: 4,
      comment: 'Great monsoon trek. The waterfall was breathtaking. Only downside was the early morning pickup, but totally worth it.',
      photos: ['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600', 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=600', 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600'],
      organizerReply: 'Thanks Sneha! The early pickup is to beat the crowd at the waterfall — worth it, right? 😄 Hope to see you on our next trek!',
      organizerReplyAt: new Date(now.getTime() - 3 * 86400000),
      createdAt: new Date(now.getTime() - 6 * 86400000),
    },
  })

  console.log('  ✓ Created 2 reviews (with photos + organizer replies)')

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

  // ── Notifications (all channels × all types) ─────────
  await prisma.notification.createMany({
    data: [
      // IN_APP channel
      { userId: traveler1.id, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed!', body: 'Your booking for "Goa Beach Blast" is confirmed. Ref: TRV-2025-0001', sentAt: new Date(), readAt: new Date() },
      { userId: traveler2.id, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed!', body: 'Your booking for "Lonavala Monsoon Trek" is confirmed. Ref: TRV-2025-0002', sentAt: new Date() },
      { userId: traveler3.id, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed!', body: 'Your booking for "Ladakh Road Trip" is confirmed. Ref: TRV-2025-0003', sentAt: new Date() },
      { userId: traveler1.id, channel: 'IN_APP', type: 'TRIP_REMINDER', title: 'Trip in 2 weeks!', body: 'Your Goa Beach Blast trip starts in 14 days. Start packing!', sentAt: new Date() },
      { userId: organizer1User.id, channel: 'IN_APP', type: 'REVIEW_REQUEST', title: 'New Review!', body: 'Amit Kulkarni left a 5-star review for "Goa Beach Blast". Check it out!', sentAt: new Date() },
      { userId: traveler1.id, channel: 'IN_APP', type: 'BOOKING_CANCELLED', title: 'Booking Cancelled', body: 'Your booking TRV-2025-0005 has been cancelled.', sentAt: new Date() },
      { userId: traveler1.id, channel: 'IN_APP', type: 'PAYMENT_RECEIVED', title: 'Payment Received', body: 'We received your payment of ₹11,998 for Goa Beach Blast.', sentAt: new Date(), readAt: new Date() },
      { userId: traveler2.id, channel: 'IN_APP', type: 'PAYMENT_FAILED', title: 'Payment Failed', body: 'Your payment for Ladakh trip failed. Please retry.', sentAt: new Date() },
      { userId: traveler1.id, channel: 'IN_APP', type: 'REFUND_PROCESSED', title: 'Refund Processed', body: 'Your refund of ₹1,500 has been credited to your wallet.', sentAt: new Date() },
      { userId: traveler3.id, channel: 'IN_APP', type: 'CHAT_MESSAGE', title: 'New Message', body: 'You have a new message from Wanderlust India.', sentAt: new Date() },
      { userId: organizer1User.id, channel: 'IN_APP', type: 'TRIP_REQUEST_RECEIVED', title: 'New Trip Request', body: 'Amit Kulkarni has requested to join "Goa Couples Retreat".', sentAt: new Date() },
      { userId: traveler1.id, channel: 'IN_APP', type: 'TRIP_REQUEST_APPROVED', title: 'Request Approved!', body: 'Your request to join "Goa Couples Retreat" has been approved!', sentAt: new Date(), readAt: new Date() },
      { userId: traveler2.id, channel: 'IN_APP', type: 'TRIP_REQUEST_REJECTED', title: 'Request Declined', body: 'Your request to join "Manali Winter Retreat" was declined.', sentAt: new Date() },
      { userId: organizer2User.id, channel: 'IN_APP', type: 'ORGANIZER_APPROVED', title: 'Profile Approved!', body: 'Your organizer profile has been approved. Start creating trips!', sentAt: new Date(), readAt: new Date() },
      { userId: organizer3User.id, channel: 'IN_APP', type: 'ORGANIZER_REJECTED', title: 'Profile Rejected', body: 'Your organizer profile needs additional documents.', sentAt: new Date() },
      { userId: admin.id, channel: 'IN_APP', type: 'SYSTEM_ALERT', title: 'System Alert', body: 'Webhook processing queue has 5 pending events.', sentAt: new Date() },

      // EMAIL channel
      { userId: traveler1.id, channel: 'EMAIL', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmation Email', body: 'Your booking for "Goa Beach Blast" is confirmed. Check your email for details.', sentAt: new Date() },
      { userId: traveler2.id, channel: 'EMAIL', type: 'REFUND_PROCESSED', title: 'Refund Confirmation', body: 'Your refund has been processed. It will reflect in 5-7 business days.', sentAt: new Date() },
      { userId: organizer1User.id, channel: 'EMAIL', type: 'PAYMENT_RECEIVED', title: 'Payment Alert', body: 'You received a payment of ₹11,998 for Goa Beach Blast.', sentAt: new Date() },

      // SMS channel
      { userId: traveler1.id, channel: 'SMS', type: 'TRIP_REMINDER', title: 'Trip Reminder SMS', body: 'Reminder: Your Goa Beach Blast trip starts tomorrow at 6:00 AM!', sentAt: new Date() },
      { userId: traveler3.id, channel: 'SMS', type: 'BOOKING_CONFIRMED', title: 'Booking SMS', body: 'Booking confirmed! Ref: TRV-2025-0003. Details on app.', sentAt: new Date() },

      // PUSH channel
      { userId: traveler1.id, channel: 'PUSH', type: 'CHAT_MESSAGE', title: 'New Message', body: 'Rahul from TripVibes replied to your question.', sentAt: new Date() },
      { userId: traveler2.id, channel: 'PUSH', type: 'TRIP_REMINDER', title: 'Trip Tomorrow!', body: 'Pack your bags! Lonavala trek starts tomorrow.', sentAt: new Date() },

      // Failed notification
      { userId: traveler3.id, channel: 'EMAIL', type: 'PAYMENT_FAILED', title: 'Payment Alert', body: 'Your payment failed.', sentAt: null, failureReason: 'Email delivery bounced' },
    ],
  })

  console.log('  ✓ Created 24 notifications (all 4 channels × all 14 types)')

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

  // ── Additional completed bookings for Trip C (to support 15+ reviews) ──
  const dBookingC7 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D030', tripId: demoTripC.id, userId: trav4.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC8 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D031', tripId: demoTripC.id, userId: trav5.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC9 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D032', tripId: demoTripC.id, userId: trav6.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC10 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D033', tripId: demoTripC.id, userId: trav7.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC11 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D034', tripId: demoTripC.id, userId: trav8.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC12 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D035', tripId: demoTripC.id, userId: trav9.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC13 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D036', tripId: demoTripC.id, userId: traveler1.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC14 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D037', tripId: demoTripC.id, userId: traveler2.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })
  const dBookingC15 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D038', tripId: demoTripC.id, userId: traveler3.id, numTravelers: 1, totalAmount: 1500, bookingStatus: 'COMPLETED' },
  })

  // Seed photos — real Unsplash travel/nature thumbnails
  const reviewPhotos = [
    ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600'],
    ['https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600'],
    ['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600', 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600', 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600'],
    ['https://images.unsplash.com/photo-1465188162913-8fb5709d6d57?w=600', 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=600'],
    ['https://images.unsplash.com/photo-1500534314263-c43bff5ab8e4?w=600'],
    ['https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600', 'https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=600', 'https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=600', 'https://images.unsplash.com/photo-1517760444937-f6397edcbbcd?w=600'],
    ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600'],
    [],
    ['https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600', 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=600'],
    [],
    ['https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=600'],
    ['https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600', 'https://images.unsplash.com/photo-1464278533981-50106e6176b1?w=600', 'https://images.unsplash.com/photo-1490682143684-14369e18dce8?w=600'],
    [],
    ['https://images.unsplash.com/photo-1510797215324-95aa89f43c33?w=600'],
    ['https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=600', 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=600'],
  ]

  // Reviews for completed Trip C — 15 reviews for pagination testing
  const tripCReviews = [
    { bookingId: dBookingC1.id, userId: trav4.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, accuracyRating: 5, comment: 'Excellent trek! Great guide and perfect monsoon vibes. The waterfall was breathtaking and the group was super friendly.', daysAgoCreated: 28 },
    { bookingId: dBookingC2.id, userId: trav5.id, overallRating: 4, organizationRating: 4, valueRating: 5, safetyRating: 4, accuracyRating: 4, comment: 'Lovely experience. Waterfalls were stunning. Only issue was the early 5 AM pickup, but totally worth it for the views.', daysAgoCreated: 27 },
    { bookingId: dBookingC3.id, userId: trav6.id, overallRating: 5, organizationRating: 5, valueRating: 4, safetyRating: 5, accuracyRating: 5, comment: 'Would go again in a heartbeat. Top-notch safety measures and the guide knew every trail like the back of his hand.', daysAgoCreated: 26 },
    { bookingId: dBookingC4.id, userId: traveler1.id, overallRating: 4, organizationRating: 4, valueRating: 4, safetyRating: 4, accuracyRating: 3, comment: 'Good value for money. Trek was a bit strenuous but the chai breaks made up for it. Beautiful misty valleys!', daysAgoCreated: 25 },
    { bookingId: dBookingC5.id, userId: traveler2.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, accuracyRating: 5, comment: 'As a solo female traveler, I felt completely safe. The organizer handled everything perfectly. Monsoon trekking is now my favourite activity!', daysAgoCreated: 24 },
    { bookingId: dBookingC6.id, userId: trav9.id, overallRating: 3, organizationRating: 3, valueRating: 4, safetyRating: 3, accuracyRating: 3, comment: 'Decent trip overall. The rain made parts of the trail slippery and the group was larger than expected. Food was good though.', daysAgoCreated: 23 },
    { bookingId: dBookingC7.id, userId: trav4.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, accuracyRating: 4, comment: 'Second time doing this trek and it was even better! Different route this time with an amazing hidden waterfall.', daysAgoCreated: 22 },
    { bookingId: dBookingC8.id, userId: trav5.id, overallRating: 4, organizationRating: 5, valueRating: 4, safetyRating: 4, accuracyRating: 4, comment: 'Well organized from start to finish. The transport was comfortable and the guide was knowledgeable. Would recommend for beginners.', daysAgoCreated: 21 },
    { bookingId: dBookingC9.id, userId: trav6.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, accuracyRating: 5, comment: 'Photography paradise! Got some of my best landscape shots here. The misty mountain views were unreal.', daysAgoCreated: 20 },
    { bookingId: dBookingC10.id, userId: trav7.id, overallRating: 2, organizationRating: 2, valueRating: 3, safetyRating: 3, accuracyRating: 2, comment: 'Trip description said easy trek but it was quite challenging. Also, lunch was basic dal-rice, expected better for the price.', daysAgoCreated: 19 },
    { bookingId: dBookingC11.id, userId: trav8.id, overallRating: 4, organizationRating: 4, valueRating: 5, safetyRating: 4, accuracyRating: 4, comment: 'Great monsoon trek experience. The waterfall rappelling was the highlight! Just bring good rain gear — you will need it.', daysAgoCreated: 18 },
    { bookingId: dBookingC12.id, userId: trav9.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, accuracyRating: 5, comment: 'Absolutely magical! The clouds parting to reveal the valley below was a moment I will never forget. Best ₹1,500 I have spent.', daysAgoCreated: 17 },
    { bookingId: dBookingC13.id, userId: traveler1.id, overallRating: 4, organizationRating: 3, valueRating: 4, safetyRating: 5, accuracyRating: 4, comment: 'Safety was excellent — first aid kit, trained guide, proper trail marking. Organization could be slightly better with timing.', daysAgoCreated: 16 },
    { bookingId: dBookingC14.id, userId: traveler2.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, accuracyRating: 5, comment: 'Brought my parents on this trek and they loved it! The pace was perfect and the guide adjusted for older trekkers. Highly recommend!', daysAgoCreated: 15 },
    { bookingId: dBookingC15.id, userId: traveler3.id, overallRating: 3, organizationRating: 4, valueRating: 3, safetyRating: 4, accuracyRating: 3, comment: 'Good trek but a bit overpriced for a day trip. The waterfall was crowded when we reached. Morning batch might be better.', daysAgoCreated: 14 },
  ]

  for (let i = 0; i < tripCReviews.length; i++) {
    const r = tripCReviews[i]
    await prisma.review.create({
      data: {
        tripId: demoTripC.id,
        bookingId: r.bookingId,
        userId: r.userId,
        overallRating: r.overallRating,
        organizationRating: r.organizationRating,
        valueRating: r.valueRating,
        safetyRating: r.safetyRating,
        accuracyRating: r.accuracyRating,
        comment: r.comment,
        photos: reviewPhotos[i],
        // Some reviews are edited
        ...(i === 3 && { editedAt: new Date(now.getTime() - (r.daysAgoCreated - 2) * 86400000) }),
        ...(i === 9 && { editedAt: new Date(now.getTime() - (r.daysAgoCreated - 1) * 86400000) }),
        // Some have organizer replies
        ...(i === 0 && { organizerReply: 'Thank you so much, Rohan! We are glad you enjoyed the monsoon trek. See you on the next one! 🙌', organizerReplyAt: new Date(now.getTime() - 27 * 86400000) }),
        ...(i === 4 && { organizerReply: 'Thanks Sneha! Safety is our top priority, especially for solo travelers. Happy you felt comfortable!', organizerReplyAt: new Date(now.getTime() - 23 * 86400000) }),
        ...(i === 5 && { organizerReply: 'We appreciate your honest feedback, Pooja. We have reduced the group size for upcoming batches. Hope to see you again!', organizerReplyAt: new Date(now.getTime() - 22 * 86400000) }),
        ...(i === 8 && { organizerReply: 'Your photos are incredible, Karan! Would love to feature them on our page (with credit). DM us! 📸', organizerReplyAt: new Date(now.getTime() - 19 * 86400000) }),
        ...(i === 9 && { organizerReply: 'Sorry about the difficulty mismatch, Meera. We have updated the listing to "Moderate" difficulty. The lunch menu has also been upgraded.', organizerReplyAt: new Date(now.getTime() - 18 * 86400000) }),
        ...(i === 13 && { organizerReply: 'That is so heartwarming! We love when families trek together. Your parents were amazing on the trail! 🥾', organizerReplyAt: new Date(now.getTime() - 14 * 86400000) }),
        createdAt: new Date(now.getTime() - r.daysAgoCreated * 86400000),
      },
    })
  }

  console.log('  ✓ Demo Trip C: COMPLETED — 15 completed bookings, 2 cancelled, 15 reviews (with photos + replies)')

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

  // ── Additional completed bookings for Trip D (to support 12+ reviews) ──
  const dBookingD4 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D040', tripId: demoTripD.id, userId: trav6.id, numTravelers: 1, totalAmount: 8500, bookingStatus: 'COMPLETED' },
  })
  const dBookingD5 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D041', tripId: demoTripD.id, userId: trav7.id, numTravelers: 2, totalAmount: 17000, bookingStatus: 'COMPLETED' },
  })
  const dBookingD6 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D042', tripId: demoTripD.id, userId: trav8.id, numTravelers: 1, totalAmount: 8500, bookingStatus: 'COMPLETED' },
  })
  const dBookingD7 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D043', tripId: demoTripD.id, userId: trav9.id, numTravelers: 1, totalAmount: 8500, bookingStatus: 'COMPLETED' },
  })
  const dBookingD8 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D044', tripId: demoTripD.id, userId: traveler1.id, numTravelers: 2, totalAmount: 17000, bookingStatus: 'COMPLETED' },
  })
  const dBookingD9 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D045', tripId: demoTripD.id, userId: traveler2.id, numTravelers: 1, totalAmount: 8500, bookingStatus: 'COMPLETED' },
  })
  const dBookingD10 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D046', tripId: demoTripD.id, userId: trav4.id, numTravelers: 1, totalAmount: 8500, bookingStatus: 'COMPLETED' },
  })
  const dBookingD11 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D047', tripId: demoTripD.id, userId: trav5.id, numTravelers: 1, totalAmount: 8500, bookingStatus: 'COMPLETED' },
  })
  const dBookingD12 = await prisma.booking.create({
    data: { bookingRef: 'TRV-2025-D048', tripId: demoTripD.id, userId: trav6.id, numTravelers: 1, totalAmount: 8500, bookingStatus: 'COMPLETED' },
  })

  // Manali winter review photos
  const manaliPhotos = [
    ['https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=600', 'https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=600', 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600'],
    ['https://images.unsplash.com/photo-1545652985-5edd365b12eb?w=600'],
    ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600', 'https://images.unsplash.com/photo-1542359649-6066040e1f1f?w=600'],
    ['https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=600', 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600'],
    [],
    ['https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600', 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=600', 'https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=600'],
    ['https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600'],
    [],
    ['https://images.unsplash.com/photo-1464278533981-50106e6176b1?w=600', 'https://images.unsplash.com/photo-1490682143684-14369e18dce8?w=600'],
    ['https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=600'],
    ['https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=600', 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=600', 'https://images.unsplash.com/photo-1510797215324-95aa89f43c33?w=600'],
    ['https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=600'],
  ]

  // Reviews for Trip D — 12 reviews for pagination testing
  const tripDReviews = [
    { bookingId: dBookingD1.id, userId: trav4.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, accuracyRating: 5, comment: 'Best winter trip ever! Manali was magical. The snow at Solang Valley was pristine and the bonfire nights were unforgettable.', daysAgoCreated: 42 },
    { bookingId: dBookingD2.id, userId: trav5.id, overallRating: 4, organizationRating: 5, valueRating: 4, safetyRating: 5, accuracyRating: 4, comment: 'Amazing arrangements. Solang was a blast! Only wish we had one more day for Old Manali cafes.', daysAgoCreated: 41 },
    { bookingId: dBookingD3.id, userId: traveler3.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 4, accuracyRating: 5, comment: 'Well organized, great bonfire nights. The hot chocolate at the campsite was the cherry on top. Already planning to join the next one!', daysAgoCreated: 40 },
    { bookingId: dBookingD4.id, userId: trav6.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, accuracyRating: 5, comment: 'Incredible photography opportunities! The snow-capped peaks at sunrise were breathtaking. Got my best portfolio shots here.', daysAgoCreated: 39 },
    { bookingId: dBookingD5.id, userId: trav7.id, overallRating: 3, organizationRating: 3, valueRating: 3, safetyRating: 4, accuracyRating: 2, comment: 'The Volvo bus was not as comfortable as promised — old seats and no blankets. Manali itself was nice but the hotel was far from Mall Road.', daysAgoCreated: 38 },
    { bookingId: dBookingD6.id, userId: trav8.id, overallRating: 5, organizationRating: 5, valueRating: 4, safetyRating: 5, accuracyRating: 5, comment: 'First time seeing snow and it was everything I dreamed of! The skiing instructor was patient and the whole team was supportive.', daysAgoCreated: 37 },
    { bookingId: dBookingD7.id, userId: trav9.id, overallRating: 4, organizationRating: 4, valueRating: 5, safetyRating: 4, accuracyRating: 4, comment: 'Great value for ₹8,500! All meals, transport, and activities included. The bonfire with live guitar was the highlight of the trip.', daysAgoCreated: 36 },
    { bookingId: dBookingD8.id, userId: traveler1.id, overallRating: 4, organizationRating: 4, valueRating: 4, safetyRating: 5, accuracyRating: 4, comment: 'Took my wife on this trip and we both loved it. The snowboarding session was thrilling! Just pack extra warm clothes — it gets freezing at night.', daysAgoCreated: 35 },
    { bookingId: dBookingD9.id, userId: traveler2.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, accuracyRating: 5, comment: 'Solo female traveler here — felt 100% safe the entire trip. The group was amazing and the organizer was always available on call. Perfect winter escape!', daysAgoCreated: 34 },
    { bookingId: dBookingD10.id, userId: trav4.id, overallRating: 5, organizationRating: 5, valueRating: 5, safetyRating: 5, accuracyRating: 5, comment: 'Came back for the second batch and it was just as good! This time we had fresh snowfall — the whole valley turned white overnight. Magical!', daysAgoCreated: 33 },
    { bookingId: dBookingD11.id, userId: trav5.id, overallRating: 2, organizationRating: 2, valueRating: 3, safetyRating: 3, accuracyRating: 2, comment: 'Disappointing second experience. Group size was 14 which felt crowded. The hotel room heater was broken and took a day to fix. Not as premium as advertised.', daysAgoCreated: 32 },
    { bookingId: dBookingD12.id, userId: trav6.id, overallRating: 4, organizationRating: 5, valueRating: 4, safetyRating: 5, accuracyRating: 4, comment: 'The Hadimba Temple visit in the snow was ethereal. Great food at the hotel — especially the garlic naan and rajma. Would definitely come again in December!', daysAgoCreated: 31 },
  ]

  for (let i = 0; i < tripDReviews.length; i++) {
    const r = tripDReviews[i]
    await prisma.review.create({
      data: {
        tripId: demoTripD.id,
        bookingId: r.bookingId,
        userId: r.userId,
        overallRating: r.overallRating,
        organizationRating: r.organizationRating,
        valueRating: r.valueRating,
        safetyRating: r.safetyRating,
        accuracyRating: r.accuracyRating,
        comment: r.comment,
        photos: manaliPhotos[i],
        // Edited reviews
        ...(i === 4 && { editedAt: new Date(now.getTime() - 37 * 86400000) }),
        ...(i === 10 && { editedAt: new Date(now.getTime() - 31 * 86400000) }),
        // Organizer replies
        ...(i === 0 && { organizerReply: 'So glad you loved it, Rohan! The Manali snow season was perfect this year. Hope to see you on our next winter batch!', organizerReplyAt: new Date(now.getTime() - 40 * 86400000) }),
        ...(i === 2 && { organizerReply: 'Thanks Vikram! That hot chocolate recipe is our secret weapon 😄. Next batch dates dropping soon!', organizerReplyAt: new Date(now.getTime() - 39 * 86400000) }),
        ...(i === 4 && { organizerReply: 'We sincerely apologize for the bus and hotel issues, Meera. We have switched to a newer Volvo fleet and a hotel closer to Mall Road for future batches. Hope you give us another chance!', organizerReplyAt: new Date(now.getTime() - 37 * 86400000) }),
        ...(i === 5 && { organizerReply: 'Your first snow experience makes us so happy, Arjun! Our skiing instructor Raju sends his regards 😊', organizerReplyAt: new Date(now.getTime() - 36 * 86400000) }),
        ...(i === 8 && { organizerReply: 'Safety first, always! Sneha, you were such a wonderful addition to the group. Come join our Spiti trip next! ❄️', organizerReplyAt: new Date(now.getTime() - 33 * 86400000) }),
        ...(i === 10 && { organizerReply: 'We are sorry about the heater issue, Ananya. That hotel has since fixed all room heaters. We have also capped the group size at 12 going forward. Your feedback helps us improve!', organizerReplyAt: new Date(now.getTime() - 31 * 86400000) }),
        createdAt: new Date(now.getTime() - r.daysAgoCreated * 86400000),
      },
    })
  }

  console.log('  ✓ Demo Trip D: COMPLETED (REQUEST_BASED) — 12 joined, 2 rejected, 12 reviews (with photos + replies)')

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

  // ══════════════════════════════════════════════════════
  // ── Wallets & Wallet Transactions ──────────────────────
  // ══════════════════════════════════════════════════════

  // Create wallets for all users (eager creation on signup)
  const allUsers = [admin, organizer1User, organizer2User, organizer3User, organizer4User, traveler1, traveler2, traveler3, demoOrgUser, trav4, trav5, trav6, trav7, trav8, trav9]

  for (const user of allUsers) {
    await prisma.wallet.create({
      data: { userId: user.id, balance: 0 },
    })
  }

  // ── Traveler1 (amit@gmail.com): Refund + Cashback → has balance ──
  const amitWallet = await prisma.wallet.findUnique({ where: { userId: traveler1.id } })
  if (amitWallet) {
    await prisma.walletTransaction.create({
      data: {
        walletId: amitWallet.id,
        amount: 1500,
        type: 'REFUND',
        referenceModel: 'Booking',
        referenceId: booking1.id,
        description: 'Refund for Goa Beach Blast partial cancellation',
        balanceBefore: 0,
        balanceAfter: 1500,
      },
    })
    await prisma.walletTransaction.create({
      data: {
        walletId: amitWallet.id,
        amount: 200,
        type: 'CASHBACK',
        referenceModel: 'Booking',
        referenceId: booking4.id,
        description: 'Cashback for Rishikesh Rafting booking',
        balanceBefore: 1500,
        balanceAfter: 1700,
      },
    })
    await prisma.walletTransaction.create({
      data: {
        walletId: amitWallet.id,
        amount: 500,
        type: 'PROMOTIONAL_CREDIT',
        referenceModel: 'User',
        referenceId: traveler1.id,
        description: 'Welcome bonus credit',
        balanceBefore: 1700,
        balanceAfter: 2200,
      },
    })
    await prisma.walletTransaction.create({
      data: {
        walletId: amitWallet.id,
        amount: 800,
        type: 'BOOKING_DEDUCTION',
        referenceModel: 'Booking',
        referenceId: booking1.id,
        description: 'Wallet used for Goa Beach Blast rebooking',
        balanceBefore: 2200,
        balanceAfter: 1400,
      },
    })
    await prisma.wallet.update({ where: { id: amitWallet.id }, data: { balance: 1400 } })
  }

  // ── Traveler2 (sneha@gmail.com): Admin credit ──
  const snehaWallet = await prisma.wallet.findUnique({ where: { userId: traveler2.id } })
  if (snehaWallet) {
    await prisma.walletTransaction.create({
      data: {
        walletId: snehaWallet.id,
        amount: 300,
        type: 'ADMIN_CREDIT',
        referenceModel: 'User',
        referenceId: traveler2.id,
        description: 'Compensation for delayed trip start',
        balanceBefore: 0,
        balanceAfter: 300,
      },
    })
    await prisma.wallet.update({ where: { id: snehaWallet.id }, data: { balance: 300 } })
  }

  // ── Trav4 (rohan@gmail.com): Refund from cancelled Trip C booking ──
  const rohanWallet = await prisma.wallet.findUnique({ where: { userId: trav4.id } })
  if (rohanWallet) {
    await prisma.walletTransaction.create({
      data: {
        walletId: rohanWallet.id,
        amount: 750,
        type: 'REFUND',
        referenceModel: 'Booking',
        referenceId: dBookingC1.id,
        description: 'Partial refund for Lonavala trek',
        balanceBefore: 0,
        balanceAfter: 750,
      },
    })
    await prisma.walletTransaction.create({
      data: {
        walletId: rohanWallet.id,
        amount: 100,
        type: 'CASHBACK',
        referenceModel: 'Booking',
        referenceId: dBookingA1.id,
        description: 'Cashback for Ladakh Explorer booking',
        balanceBefore: 750,
        balanceAfter: 850,
      },
    })
    await prisma.wallet.update({ where: { id: rohanWallet.id }, data: { balance: 850 } })
  }

  // ── Trav9 (pooja@gmail.com): Promotional credit + EXPIRY ──
  const poojaWallet = await prisma.wallet.findUnique({ where: { userId: trav9.id } })
  if (poojaWallet) {
    await prisma.walletTransaction.create({
      data: {
        walletId: poojaWallet.id,
        amount: 500,
        type: 'PROMOTIONAL_CREDIT',
        referenceModel: 'User',
        referenceId: trav9.id,
        description: 'Referral bonus credit',
        balanceBefore: 0,
        balanceAfter: 500,
      },
    })
    await prisma.walletTransaction.create({
      data: {
        walletId: poojaWallet.id,
        amount: 250,
        type: 'EXPIRY',
        referenceModel: 'WalletTransaction',
        referenceId: 'expired_promo_batch_001',
        description: 'Promotional credit expired after 90 days',
        balanceBefore: 500,
        balanceAfter: 250,
      },
    })
    await prisma.wallet.update({ where: { id: poojaWallet.id }, data: { balance: 250 } })
  }

  // ── Trav7 (meera@gmail.com): ADMIN_DEBIT ──
  const meeraWallet = await prisma.wallet.findUnique({ where: { userId: trav7.id } })
  if (meeraWallet) {
    await prisma.walletTransaction.create({
      data: {
        walletId: meeraWallet.id,
        amount: 1000,
        type: 'ADMIN_CREDIT',
        referenceModel: 'User',
        referenceId: trav7.id,
        description: 'Admin credited for trip disruption compensation',
        balanceBefore: 0,
        balanceAfter: 1000,
      },
    })
    await prisma.walletTransaction.create({
      data: {
        walletId: meeraWallet.id,
        amount: 400,
        type: 'ADMIN_DEBIT',
        referenceModel: 'User',
        referenceId: trav7.id,
        description: 'Admin corrected over-credited amount',
        balanceBefore: 1000,
        balanceAfter: 600,
      },
    })
    await prisma.wallet.update({ where: { id: meeraWallet.id }, data: { balance: 600 } })
  }

  console.log('  ✓ Created 15 wallets + 12 wallet transactions (all 7 types)')
  console.log('     amit@gmail.com:  ₹1,400 (REFUND + CASHBACK + PROMOTIONAL_CREDIT + BOOKING_DEDUCTION)')
  console.log('     sneha@gmail.com: ₹300   (ADMIN_CREDIT)')
  console.log('     rohan@gmail.com: ₹850   (REFUND + CASHBACK)')
  console.log('     pooja@gmail.com: ₹250   (PROMOTIONAL_CREDIT + EXPIRY)')
  console.log('     meera@gmail.com: ₹600   (ADMIN_CREDIT + ADMIN_DEBIT)')

  // ── Recalculate destination tripCount from actual ACTIVE/FULL trips ──
  await prisma.$executeRaw`
    UPDATE "Destination" d
    SET "tripCount" = (
      SELECT COUNT(*)::int
      FROM "Trip" t
      WHERE t."destinationId" = d.id
        AND t."isDeleted" = false
        AND t.status IN ('ACTIVE', 'FULL')
    )
  `
  console.log('  ✓ Recalculated destination tripCount from actual ACTIVE/FULL trips')

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
  console.log('     rahul@tripvibes.com      (ORGANIZER — APPROVED)')
  console.log('     priya@wanderlust.in      (ORGANIZER — APPROVED)')
  console.log('     sid@trekbuddy.in         (ORGANIZER — PENDING)')
  console.log('     nisha@roadtrips.co       (ORGANIZER — REJECTED)')
  console.log('     demo.organizer@test.com  (ORGANIZER — Dashboard demo)')
  console.log('     amit@gmail.com           (TRAVELER — wallet ₹1,400)')
  console.log('     sneha@gmail.com          (TRAVELER — wallet ₹300)')
  console.log('     vikram@gmail.com         (TRAVELER)')
  console.log('     rohan@gmail.com          (TRAVELER — wallet ₹850)')
  console.log('     ananya@gmail.com         (TRAVELER)')
  console.log('     karan@gmail.com          (TRAVELER)')
  console.log('     meera@gmail.com          (TRAVELER — wallet ₹600)')
  console.log('     arjun@gmail.com          (TRAVELER)')
  console.log('     pooja@gmail.com          (TRAVELER — wallet ₹250)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

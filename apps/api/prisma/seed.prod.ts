import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// Fixed date helper — not relative to "now"
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

async function main() {
  console.log('🌱 Seeding PRODUCTION database...\n')

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
  await prisma.tripEditHistory.deleteMany()
  await prisma.trip.deleteMany()
  await prisma.destination.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.verificationCode.deleteMany()
  await prisma.organizerProfile.deleteMany()
  await prisma.webhookEvent.deleteMany()
  await prisma.user.deleteMany()
  console.log('  ✓ Cleaned existing data')

  const passwordHash = await bcrypt.hash('Test@1234', 12)

  // ══════════════════════════════════════════════════════
  // ── USERS ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════

  const admin = await prisma.user.create({
    data: { name: 'Mandeep Mourya', email: 'admin@safarnama.in', passwordHash, role: 'ADMIN', emailVerified: true, phoneVerified: true, phone: '+919876000001', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=MM' },
  })

  const org1User = await prisma.user.create({
    data: { name: 'Rajesh Khanna', email: 'rajesh@thrillophilia.in', passwordHash, role: 'ORGANIZER', phone: '+919820145678', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=RK' },
  })
  const org2User = await prisma.user.create({
    data: { name: 'Deepa Nair', email: 'deepa@wanderon.in', passwordHash, role: 'ORGANIZER', phone: '+919845098765', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=DN' },
  })
  const org3User = await prisma.user.create({
    data: { name: 'Arjun Mehta', email: 'arjun@tripoto.in', passwordHash, role: 'ORGANIZER', phone: '+919871023456', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AM' },
  })
  const org4User = await prisma.user.create({
    data: { name: 'Priya Sharma', email: 'priya@zostel.com', passwordHash, role: 'ORGANIZER', phone: '+919890123400', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=PS' },
  })
  const org5User = await prisma.user.create({
    data: { name: 'Vikram Desai', email: 'vikram@sahyadriadventures.com', passwordHash, role: 'ORGANIZER', phone: '+919823456700', emailVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=VD' },
  })
  const org6User = await prisma.user.create({
    data: { name: 'Neha Gupta', email: 'neha@budgettrails.in', passwordHash, role: 'ORGANIZER', phone: '+919812345600', emailVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=NG' },
  })

  // 12 Travelers
  const t1 = await prisma.user.create({ data: { name: 'Amit Kulkarni', email: 'amit.kulkarni@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543210', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AK' } })
  const t2 = await prisma.user.create({ data: { name: 'Sneha Deshmukh', email: 'sneha.deshmukh@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543211', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=SD' } })
  const t3 = await prisma.user.create({ data: { name: 'Rohan Joshi', email: 'rohan.joshi@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543212', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=RJ' } })
  const t4 = await prisma.user.create({ data: { name: 'Kavita Reddy', email: 'kavita.reddy@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543213', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=KR' } })
  const t5 = await prisma.user.create({ data: { name: 'Saurabh Patil', email: 'saurabh.patil@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543214', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=SP' } })
  const t6 = await prisma.user.create({ data: { name: 'Ananya Iyer', email: 'ananya.iyer@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543215', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AI' } })
  const t7 = await prisma.user.create({ data: { name: 'Karan Singh', email: 'karan.singh@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543216', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=KS' } })
  const t8 = await prisma.user.create({ data: { name: 'Meera Bhat', email: 'meera.bhat@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543217', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=MB' } })
  const t9 = await prisma.user.create({ data: { name: 'Nikhil Verma', email: 'nikhil.verma@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543218', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=NV' } })
  const t10 = await prisma.user.create({ data: { name: 'Pooja Agarwal', email: 'pooja.agarwal@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543219', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=PA' } })
  const t11 = await prisma.user.create({ data: { name: 'Rahul Tiwari', email: 'rahul.tiwari@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543220', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=RT' } })
  const t12 = await prisma.user.create({ data: { name: 'Divya Menon', email: 'divya.menon@gmail.com', passwordHash, role: 'TRAVELER', phone: '+919876543221', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=DM' } })
  console.log('  ✓ Created 19 users (1 admin, 6 organizers, 12 travelers)')

  // ══════════════════════════════════════════════════════
  // ── ORGANIZER PROFILES ────────────────────────────────
  // ══════════════════════════════════════════════════════

  const org1 = await prisma.organizerProfile.create({ data: { userId: org1User.id, businessName: 'Thrillophilia Adventures', description: 'India\'s leading adventure travel company. Group trips across India — Himalayan treks to Goa beach getaways. 8+ years, 15000+ happy travelers. IATO certified.', verificationStatus: 'APPROVED', rating: 4.7, totalReviews: 86, totalTripsCompleted: 62, bankAccountLinked: true, commissionRate: 10.0, razorpayAccountId: 'acc_prod_thrillophilia' } })
  const org2 = await prisma.organizerProfile.create({ data: { userId: org2User.id, businessName: 'WanderOn Experiences', description: 'Community-driven group trips for young professionals and solo travelers. Based in Bangalore, operating pan-India. 5+ years of curated experiences.', verificationStatus: 'APPROVED', rating: 4.5, totalReviews: 54, totalTripsCompleted: 38, bankAccountLinked: true, commissionRate: 10.0, razorpayAccountId: 'acc_prod_wanderon' } })
  const org3 = await prisma.organizerProfile.create({ data: { userId: org3User.id, businessName: 'Tripoto Travel Co.', description: 'Heritage walks in Rajasthan to backpacking in Northeast India — curated group trips with local experts. 5+ years, 8000+ travelers.', verificationStatus: 'APPROVED', rating: 4.4, totalReviews: 42, totalTripsCompleted: 28, bankAccountLinked: true, commissionRate: 10.0, razorpayAccountId: 'acc_prod_tripoto' } })
  const org4 = await prisma.organizerProfile.create({ data: { userId: org4User.id, businessName: 'Zostel Experiences', description: 'India\'s largest hostel chain now offers curated group adventures. Budget-friendly trips for backpackers and solo travelers.', verificationStatus: 'APPROVED', rating: 4.3, totalReviews: 38, totalTripsCompleted: 24, bankAccountLinked: true, commissionRate: 10.0, razorpayAccountId: 'acc_prod_zostel' } })
  await prisma.organizerProfile.create({ data: { userId: org5User.id, businessName: 'Sahyadri Adventures Club', description: 'Western Ghats trekking and camping specialists from Pune.', verificationStatus: 'PENDING', rating: 0, totalReviews: 0, totalTripsCompleted: 0, bankAccountLinked: false, commissionRate: 10.0 } })
  await prisma.organizerProfile.create({ data: { userId: org6User.id, businessName: 'Budget Trails India', description: 'Affordable travel packages across India for students.', verificationStatus: 'REJECTED', rating: 0, totalReviews: 0, totalTripsCompleted: 0, bankAccountLinked: false, commissionRate: 10.0 } })
  console.log('  ✓ Created 6 organizer profiles (4 APPROVED, 1 PENDING, 1 REJECTED)')

  // ══════════════════════════════════════════════════════
  // ── DESTINATIONS ──────────────────────────────────────
  // ══════════════════════════════════════════════════════

  const goa = await prisma.destination.create({ data: { name: 'Goa', slug: 'goa', state: 'Goa', isPopular: true, tripCount: 2, photoUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800' } })
  const manali = await prisma.destination.create({ data: { name: 'Manali', slug: 'manali', state: 'Himachal Pradesh', isPopular: true, tripCount: 2, photoUrl: 'https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=800' } })
  const ladakh = await prisma.destination.create({ data: { name: 'Ladakh', slug: 'ladakh', state: 'Ladakh', isPopular: true, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800' } })
  const rishikesh = await prisma.destination.create({ data: { name: 'Rishikesh', slug: 'rishikesh', state: 'Uttarakhand', isPopular: true, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=800' } })
  const jaipur = await prisma.destination.create({ data: { name: 'Jaipur', slug: 'jaipur', state: 'Rajasthan', isPopular: true, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800' } })
  const kasol = await prisma.destination.create({ data: { name: 'Kasol', slug: 'kasol', state: 'Himachal Pradesh', isPopular: true, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800' } })
  const udaipur = await prisma.destination.create({ data: { name: 'Udaipur', slug: 'udaipur', state: 'Rajasthan', isPopular: true, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800' } })
  const meghalaya = await prisma.destination.create({ data: { name: 'Meghalaya', slug: 'meghalaya', state: 'Meghalaya', isPopular: false, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=800' } })
  const hampi = await prisma.destination.create({ data: { name: 'Hampi', slug: 'hampi', state: 'Karnataka', isPopular: false, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800' } })
  const lonavala = await prisma.destination.create({ data: { name: 'Lonavala', slug: 'lonavala', state: 'Maharashtra', isPopular: true, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1625505826533-5c80aca7d157?w=800' } })
  const spiti = await prisma.destination.create({ data: { name: 'Spiti Valley', slug: 'spiti-valley', state: 'Himachal Pradesh', isPopular: false, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800' } })
  const coorg = await prisma.destination.create({ data: { name: 'Coorg', slug: 'coorg', state: 'Karnataka', isPopular: false, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800' } })
  const varanasi = await prisma.destination.create({ data: { name: 'Varanasi', slug: 'varanasi', state: 'Uttar Pradesh', isPopular: false, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800' } })
  const andaman = await prisma.destination.create({ data: { name: 'Andaman Islands', slug: 'andaman', state: 'Andaman & Nicobar', isPopular: false, tripCount: 1, photoUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800' } })
  console.log('  ✓ Created 14 destinations')

  // ══════════════════════════════════════════════════════
  // ── COMPLETED TRIPS (before April 2026) ───────────────
  // ══════════════════════════════════════════════════════

  const completedTrips = await seedCompletedTrips({ org1, org2, org3, org4, goa, manali, ladakh, rishikesh, jaipur, hampi, lonavala, meghalaya })

  // ══════════════════════════════════════════════════════
  // ── UPCOMING TRIPS (June 2026+, ₹9K-15K) ─────────────
  // ══════════════════════════════════════════════════════

  const upcomingTrips = await seedUpcomingTrips({ org1, org2, org3, org4, kasol, spiti, udaipur, coorg, varanasi, andaman })

  // ══════════════════════════════════════════════════════
  // ── BOOKINGS, PAYMENTS, REVIEWS ───────────────────────
  // ══════════════════════════════════════════════════════

  await seedBookingsAndReviews({ completedTrips, upcomingTrips, travelers: [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12], org1User, org2User, org3User, org4User, org5User, org6User, org1, org2, org3, org4, admin })

  console.log('\n✅ Seed complete!\n')
  console.log('  🔐 All accounts use password: Test@1234')
  console.log('  📧 Admin:      admin@safarnama.in')
  console.log('  📧 Organizers:  rajesh@thrillophilia.in, deepa@wanderon.in, arjun@tripoto.in, priya@zostel.com')
  console.log('  📧 Pending:     vikram@sahyadriadventures.com')
  console.log('  📧 Rejected:    neha@budgettrails.in')
  console.log('  📧 Travelers:   amit.kulkarni@gmail.com, sneha.deshmukh@gmail.com, rohan.joshi@gmail.com ...')
}

// ══════════════════════════════════════════════════════════
// ── COMPLETED TRIPS FUNCTION ────────────────────────────
// ══════════════════════════════════════════════════════════

async function seedCompletedTrips(deps: Record<string, { id: string }>) {
  const { org1, org2, org3, org4, goa, manali, ladakh, rishikesh, jaipur, hampi, lonavala, meghalaya } = deps

  const tripC1 = await prisma.trip.create({
    data: {
      organizerId: org1.id, destinationId: goa.id,
      title: 'Goa Beach Carnival — 3N/4D Fun Escape', slug: 'goa-beach-carnival-jan-2026',
      tripType: 'BEACH', bookingMode: 'INSTANT',
      description: 'Kick off 2026 with the ultimate Goa experience! North Goa beaches, thrilling water sports, vibrant nightlife, and the freshest seafood. Stay at a beachfront resort in Calangute and explore hidden gems beyond the usual tourist trail. Perfect for friend groups and solo travelers looking to start the year right.',
      itinerary: [
        { day: 1, title: 'Arrival & North Goa Vibes', description: 'Check-in at beachfront resort. Evening at Baga Beach.', activities: [{ title: 'Airport/Station pickup', time: '11:00 AM' }, { title: 'Resort check-in & lunch', time: '1:00 PM' }, { title: 'Baga Beach walk & sunset', time: '4:30 PM' }, { title: 'Tito\'s Lane nightlife', time: '9:30 PM' }] },
        { day: 2, title: 'Water Sports & Fort Aguada', description: 'Full day of aquatic adventures followed by iconic Fort Aguada sunset.', activities: [{ title: 'Parasailing & jet ski', time: '9:00 AM' }, { title: 'Banana boat ride', time: '11:00 AM' }, { title: 'Seafood lunch at Britto\'s', time: '1:00 PM' }, { title: 'Fort Aguada exploration', time: '4:00 PM' }] },
        { day: 3, title: 'South Goa & Old Goa Heritage', description: 'Serene beaches of South Goa and Portuguese churches.', activities: [{ title: 'Palolem Beach morning', time: '8:00 AM' }, { title: 'Butterfly Beach boat trip', time: '11:00 AM' }, { title: 'Old Goa churches visit', time: '2:30 PM' }, { title: 'Spice plantation tour with dinner', time: '5:00 PM' }] },
        { day: 4, title: 'Market Shopping & Departure', description: 'Shopping at Panjim markets and departure.', activities: [{ title: 'Breakfast at resort', time: '8:30 AM' }, { title: 'Panjim market shopping', time: '10:00 AM' }, { title: 'Drop to airport/station', time: '1:00 PM' }] },
      ],
      startDate: d(2026, 1, 10), endDate: d(2026, 1, 14),
      pricePerPerson: 6499, earlyBirdPrice: 5499, earlyBirdDeadline: d(2025, 12, 28),
      minGroupSize: 10, maxGroupSize: 24, currentBookings: 18,
      inclusions: ['AC Volvo bus from Pune', 'Beachfront resort (3N)', 'Breakfast & dinner daily', 'Water sports package', 'Fort Aguada & Old Goa sightseeing', 'Spice plantation entry', 'All local transfers'],
      exclusions: ['Lunch', 'Alcoholic beverages', 'Personal expenses', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
      transferPoints: { create: [
        { type: 'PICKUP', label: 'Pune — Shivaji Nagar Bus Stand', address: 'Shivaji Nagar Bus Depot, Pune 411005', time: '8:00 PM', sortOrder: 0 },
        { type: 'PICKUP', label: 'Pune — Wakad Bridge', address: 'Near Wakad Bridge, Hinjewadi Road', time: '8:45 PM', sortOrder: 1 },
      ] },
    },
  })

  const tripC2 = await prisma.trip.create({
    data: {
      organizerId: org2.id, destinationId: manali.id,
      title: 'Manali Snow Adventure — 4N/5D Winter Special', slug: 'manali-snow-adventure-feb-2026',
      tripType: 'ADVENTURE', bookingMode: 'INSTANT',
      description: 'Experience Manali in peak winter! Fresh snowfall at Solang Valley, skiing, snowboarding, and cozy bonfire nights in Old Manali. Stay at a charming wooden cottage with mountain views. Perfect for first-time snow lovers and adventure seekers.',
      itinerary: [
        { day: 1, title: 'Arrival in Manali', description: 'Overnight Volvo arrives. Check-in and relax.', activities: [{ title: 'Arrival & check-in', time: '10:00 AM' }, { title: 'Mall Road evening walk', time: '4:00 PM' }, { title: 'Bonfire with hot chocolate', time: '8:00 PM' }] },
        { day: 2, title: 'Solang Valley Snow Day', description: 'Full day of snow activities.', activities: [{ title: 'Drive to Solang Valley', time: '8:30 AM' }, { title: 'Skiing session', time: '10:00 AM' }, { title: 'Snow tubing & snowball fights', time: '12:00 PM' }, { title: 'Maggi & chai at snow point', time: '1:30 PM' }] },
        { day: 3, title: 'Atal Tunnel & Sissu', description: 'Day trip through Atal Tunnel.', activities: [{ title: 'Drive to Atal Tunnel', time: '8:00 AM' }, { title: 'Sissu waterfall & Chandra river', time: '11:00 AM' }, { title: 'Free evening in Old Manali cafes', time: '6:00 PM' }] },
        { day: 4, title: 'Old Manali & Temples', description: 'Cultural side of Manali.', activities: [{ title: 'Hadimba Devi Temple', time: '9:00 AM' }, { title: 'Cafe hopping (Lazy Dog, Johnson\'s)', time: '1:00 PM' }, { title: 'Vashisht Hot Springs', time: '4:00 PM' }, { title: 'Farewell dinner', time: '7:30 PM' }] },
        { day: 5, title: 'Departure', description: 'Breakfast and departure.', activities: [{ title: 'Breakfast & checkout', time: '8:00 AM' }, { title: 'Board Volvo to Delhi', time: '4:00 PM' }] },
      ],
      startDate: d(2026, 2, 5), endDate: d(2026, 2, 10),
      pricePerPerson: 8999, earlyBirdPrice: 7999, earlyBirdDeadline: d(2026, 1, 25),
      minGroupSize: 8, maxGroupSize: 18, currentBookings: 14,
      inclusions: ['Delhi-Manali-Delhi Volvo', 'Cottage stay (4N)', 'All meals', 'Skiing at Solang', 'Atal Tunnel day trip', 'Bonfire', 'Local transport'],
      exclusions: ['Gondola ride', 'Paragliding', 'Shopping', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
      transferPoints: { create: [
        { type: 'PICKUP', label: 'Delhi — Kashmere Gate ISBT', address: 'ISBT Kashmere Gate', time: '6:00 PM', sortOrder: 0 },
      ] },
    },
  })

  const tripC3 = await prisma.trip.create({
    data: {
      organizerId: org1.id, destinationId: rishikesh.id,
      title: 'Rishikesh White Water Rafting & Camping Weekend', slug: 'rishikesh-rafting-camping-feb-2026',
      tripType: 'ADVENTURE', bookingMode: 'INSTANT',
      description: '16 km of Grade III-IV rapids on the Ganges! Riverside camping under the stars, cliff jumping, and a magical Ganga Aarti. This 2-day itinerary packs maximum adventure into a weekend. Perfect for groups from Delhi/NCR.',
      itinerary: [
        { day: 1, title: 'Rafting & Riverside Camping', description: 'Arrive, raft, camp.', activities: [{ title: 'Arrive Shivpuri base', time: '10:00 AM' }, { title: '16 km rafting', time: '11:00 AM' }, { title: 'Cliff jumping', time: '2:00 PM' }, { title: 'Riverside tent setup', time: '4:00 PM' }, { title: 'Bonfire with live guitar', time: '8:00 PM' }] },
        { day: 2, title: 'Yoga, Explore & Depart', description: 'Sunrise yoga and explore Rishikesh.', activities: [{ title: 'Sunrise yoga', time: '6:00 AM' }, { title: 'Lakshman Jhula walk', time: '9:30 AM' }, { title: 'Chotiwala lunch', time: '12:30 PM' }, { title: 'Departure', time: '2:00 PM' }] },
      ],
      startDate: d(2026, 2, 21), endDate: d(2026, 2, 23),
      pricePerPerson: 3499,
      minGroupSize: 10, maxGroupSize: 24, currentBookings: 20,
      inclusions: ['Delhi-Rishikesh-Delhi AC bus', '16 km rafting', 'Riverside camping (1N)', 'All meals', 'Bonfire', 'Yoga session', 'Safety gear'],
      exclusions: ['Bungee jumping', 'Personal expenses'],
      cancellationPolicy: 'FLEXIBLE',
      photos: ['https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
      transferPoints: { create: [
        { type: 'PICKUP', label: 'Delhi — Kashmere Gate ISBT', time: '5:30 AM', sortOrder: 0 },
      ] },
    },
  })

  const tripC4 = await prisma.trip.create({
    data: {
      organizerId: org3.id, destinationId: jaipur.id,
      title: 'Jaipur Royal Heritage Experience — 2N/3D', slug: 'jaipur-heritage-experience-mar-2026',
      tripType: 'CULTURAL', bookingMode: 'INSTANT',
      description: 'Step into the Pink City! Amber Fort, Hawa Mahal, City Palace, and Nahargarh Fort with authentic Rajasthani cuisine, block printing workshops, and Johari Bazaar. Stay at a heritage haveli and dine like maharajas.',
      itinerary: [
        { day: 1, title: 'Arrival & City Wonders', description: 'Jaipur city monuments.', activities: [{ title: 'Haveli check-in', time: '10:00 AM' }, { title: 'Hawa Mahal & Jantar Mantar', time: '12:00 PM' }, { title: 'City Palace tour', time: '2:30 PM' }, { title: 'Rajasthani thali at Chokhi Dhani', time: '7:30 PM' }] },
        { day: 2, title: 'Forts, Crafts & Sunset', description: 'Amber Fort and artisan crafts.', activities: [{ title: 'Amber Fort', time: '8:00 AM' }, { title: 'Block printing workshop', time: '1:00 PM' }, { title: 'Nahargarh Fort sunset', time: '5:30 PM' }] },
        { day: 3, title: 'Markets & Departure', description: 'Famous bazaars and departure.', activities: [{ title: 'Johari Bazaar', time: '9:00 AM' }, { title: 'Lassi at Lassiwala', time: '12:30 PM' }, { title: 'Drop to station', time: '2:00 PM' }] },
      ],
      startDate: d(2026, 3, 7), endDate: d(2026, 3, 10),
      pricePerPerson: 5999, earlyBirdPrice: 4999, earlyBirdDeadline: d(2026, 2, 25),
      minGroupSize: 8, maxGroupSize: 20, currentBookings: 16,
      inclusions: ['Heritage haveli (2N)', 'Breakfast & dinner', 'Amber Fort entry & jeep', 'All monument tickets', 'Block printing workshop', 'Chokhi Dhani dinner', 'AC tempo traveller'],
      exclusions: ['Train/flight tickets', 'Lunch', 'Shopping', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
      transferPoints: { create: [
        { type: 'PICKUP', label: 'Jaipur Junction Railway Station', time: '9:30 AM', sortOrder: 0 },
        { type: 'DROP', label: 'Jaipur Junction Railway Station', time: '3:00 PM', sortOrder: 1 },
      ] },
    },
  })

  const tripC5 = await prisma.trip.create({
    data: {
      organizerId: org2.id, destinationId: ladakh.id,
      title: 'Ladakh Bike Expedition — Manali to Leh 8N/9D', slug: 'ladakh-bike-expedition-aug-2025',
      tripType: 'ROAD_TRIP', bookingMode: 'REQUEST_BASED',
      description: 'The ride of a lifetime! Manali to Leh on Royal Enfields through the highest motorable passes. Cross Rohtang, Baralacha La, Tanglang La, and Khardung La. Camp at Pangong Lake under a billion stars. Small group, experienced riders, backup vehicle.',
      itinerary: [
        { day: 1, title: 'Manali — Bike Allocation', description: 'Arrive, get bike, safety briefing.', activities: [{ title: 'Hotel check-in', time: '10:00 AM' }, { title: 'Bike allocation & test ride', time: '2:00 PM' }, { title: 'Safety briefing', time: '4:00 PM' }] },
        { day: 2, title: 'Manali to Jispa (145 km)', description: 'Through Atal Tunnel.', activities: [{ title: 'Ride start', time: '7:00 AM' }, { title: 'Atal Tunnel', time: '9:00 AM' }, { title: 'Arrive Jispa', time: '4:00 PM' }] },
        { day: 3, title: 'Jispa to Sarchu (85 km)', description: 'Cross Baralacha La.', activities: [{ title: 'Early ride', time: '6:30 AM' }, { title: 'Baralacha La summit', time: '10:00 AM' }, { title: 'Sarchu camp', time: '3:00 PM' }] },
        { day: 4, title: 'Sarchu to Leh (260 km)', description: 'Gata Loops, Lachalung La, More Plains.', activities: [{ title: 'Pre-dawn start', time: '5:00 AM' }, { title: 'Tanglang La', time: '1:00 PM' }, { title: 'Arrive Leh', time: '6:00 PM' }] },
        { day: 5, title: 'Leh Rest Day', description: 'Acclimatization.', activities: [{ title: 'Leh Palace', time: '11:00 AM' }, { title: 'Shanti Stupa', time: '2:00 PM' }, { title: 'Market walk', time: '4:00 PM' }] },
        { day: 6, title: 'Leh to Pangong (160 km)', description: 'Via Chang La.', activities: [{ title: 'Chang La pass', time: '7:00 AM' }, { title: 'Pangong Lake camping', time: '1:00 PM' }, { title: 'Stargazing', time: '9:00 PM' }] },
        { day: 7, title: 'Pangong to Nubra (280 km)', description: 'Shyok route.', activities: [{ title: 'Ride via Shyok', time: '8:00 AM' }, { title: 'Hunder sand dunes camel ride', time: '5:30 PM' }] },
        { day: 8, title: 'Nubra to Leh via Khardung La', description: 'Legendary pass.', activities: [{ title: 'Diskit Monastery', time: '7:00 AM' }, { title: 'Khardung La', time: '12:00 PM' }, { title: 'Farewell dinner', time: '7:00 PM' }] },
        { day: 9, title: 'Departure', description: 'Fly out from Leh.', activities: [{ title: 'Airport drop', time: '9:00 AM' }] },
      ],
      startDate: d(2025, 8, 15), endDate: d(2025, 8, 24),
      pricePerPerson: 24999, earlyBirdPrice: 21999, earlyBirdDeadline: d(2025, 7, 30),
      minGroupSize: 6, maxGroupSize: 12, currentBookings: 10,
      inclusions: ['Royal Enfield rental', 'Fuel', 'Accommodation (8N)', 'All meals', 'Backup vehicle', 'Permits', 'First aid & oxygen', 'Ride captain'],
      exclusions: ['Flights', 'Riding gear', 'Alcohol', 'Travel insurance'],
      cancellationPolicy: 'STRICT',
      photos: ['https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
    },
  })

  const tripC6 = await prisma.trip.create({
    data: {
      organizerId: org3.id, destinationId: hampi.id,
      title: 'Hampi Ruins & Culture Walk — 2N/3D', slug: 'hampi-ruins-culture-walk-jan-2026',
      tripType: 'CULTURAL', bookingMode: 'INSTANT',
      description: 'Walk through 14th-century Vijayanagara Empire ruins, a UNESCO World Heritage Site. Boulder landscapes, ancient temples, and hippie island vibes. History, photography, and laid-back backpacker culture.',
      itinerary: [
        { day: 1, title: 'Arrival & Royal Enclosure', description: 'Explore the Royal Enclosure.', activities: [{ title: 'Virupaksha Temple', time: '11:00 AM' }, { title: 'Hampi Bazaar', time: '12:30 PM' }, { title: 'Elephant Stables', time: '2:30 PM' }, { title: 'Hemakuta Hill sunset', time: '5:30 PM' }] },
        { day: 2, title: 'Temples & Hippie Island', description: 'Iconic temples and the other side.', activities: [{ title: 'Vittala Temple & Stone Chariot', time: '7:00 AM' }, { title: 'Coracle ride', time: '10:00 AM' }, { title: 'Hippie Island cafes', time: '12:00 PM' }, { title: 'Matanga Hill sunset', time: '5:00 PM' }] },
        { day: 3, title: 'Anegundi & Departure', description: 'Morning explore and depart.', activities: [{ title: 'Monkey Temple', time: '7:30 AM' }, { title: 'Brunch', time: '11:00 AM' }, { title: 'Transfer to Hospet', time: '1:00 PM' }] },
      ],
      startDate: d(2026, 1, 24), endDate: d(2026, 1, 27),
      pricePerPerson: 4999,
      minGroupSize: 8, maxGroupSize: 16, currentBookings: 12,
      inclusions: ['Hospet station pickup/drop', 'Guesthouse (2N)', 'Breakfast & dinner', 'Coracle ride', 'Monument tickets', 'Local guide'],
      exclusions: ['Train tickets to Hospet', 'Lunch', 'Personal expenses'],
      cancellationPolicy: 'FLEXIBLE',
      photos: ['https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
    },
  })

  const tripC7 = await prisma.trip.create({
    data: {
      organizerId: org4.id, destinationId: lonavala.id,
      title: 'Rajmachi Fort Monsoon Trek — 1N/2D', slug: 'rajmachi-fort-monsoon-trek-sep-2025',
      tripType: 'TREKKING', bookingMode: 'INSTANT',
      description: 'Trek through lush Western Ghats to historic Rajmachi Fort during peak monsoon. Cascading waterfalls, misty valleys, night camping near the fort with Maharashtrian food. The quintessential Sahyadri monsoon experience.',
      itinerary: [
        { day: 1, title: 'Trek to Rajmachi Fort', description: 'Morning drive, trek through monsoon trails.', activities: [{ title: 'Pune pickup', time: '5:30 AM' }, { title: 'Trek start from Kondivade', time: '8:00 AM' }, { title: 'Waterfall stops', time: '10:00 AM' }, { title: 'Arrive Rajmachi village', time: '12:30 PM' }, { title: 'Fort exploration', time: '3:00 PM' }, { title: 'Bonfire & dinner', time: '7:30 PM' }] },
        { day: 2, title: 'Sunrise & Return', description: 'Sunrise and trek back.', activities: [{ title: 'Sunrise from fort', time: '5:30 AM' }, { title: 'Breakfast', time: '7:00 AM' }, { title: 'Trek descent', time: '8:30 AM' }, { title: 'Drive back to Pune', time: '12:00 PM' }] },
      ],
      startDate: d(2025, 9, 13), endDate: d(2025, 9, 15),
      pricePerPerson: 1899,
      minGroupSize: 12, maxGroupSize: 30, currentBookings: 26,
      inclusions: ['Pune pickup/drop', 'Trek guide', 'Camping (1N)', 'All meals', 'First aid', 'Bonfire'],
      exclusions: ['Rain gear', 'Personal snacks', 'Travel insurance'],
      cancellationPolicy: 'FLEXIBLE',
      photos: ['https://images.unsplash.com/photo-1625505826533-5c80aca7d157?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
      transferPoints: { create: [
        { type: 'PICKUP', label: 'Pune — Wakad Bridge', time: '5:30 AM', sortOrder: 0 },
        { type: 'PICKUP', label: 'Pune — Chandni Chowk', time: '6:00 AM', sortOrder: 1 },
      ] },
    },
  })

  const tripC8 = await prisma.trip.create({
    data: {
      organizerId: org2.id, destinationId: meghalaya.id,
      title: 'Meghalaya — Caves, Waterfalls & Living Root Bridges 5N/6D', slug: 'meghalaya-living-root-bridges-mar-2026',
      tripType: 'ADVENTURE', bookingMode: 'REQUEST_BASED',
      description: 'India\'s own Scotland! Double-decker living root bridges, crystal-clear rivers, limestone caves, and Asia\'s cleanest village Mawlynnong. For those who want to go beyond the usual tourist trail.',
      itinerary: [
        { day: 1, title: 'Arrival in Shillong', description: 'Arrive in the Scotland of the East.', activities: [{ title: 'Airport pickup', time: '11:00 AM' }, { title: 'Don Bosco Museum', time: '2:00 PM' }, { title: 'Police Bazaar walk', time: '5:00 PM' }] },
        { day: 2, title: 'Cherrapunji Waterfalls & Caves', description: 'Wettest place on Earth.', activities: [{ title: 'Nohkalikai Falls', time: '10:00 AM' }, { title: 'Mawsmai Cave', time: '12:00 PM' }, { title: 'Seven Sisters Falls', time: '2:00 PM' }] },
        { day: 3, title: 'Double Decker Living Root Bridge', description: 'Trek to the natural wonder.', activities: [{ title: '3500 steps descent', time: '7:00 AM' }, { title: 'Root Bridge & natural pool', time: '10:30 AM' }, { title: 'Rainbow Falls', time: '12:00 PM' }] },
        { day: 4, title: 'Dawki & Mawlynnong', description: 'Crystal clear Umngot River.', activities: [{ title: 'Boating on Umngot', time: '10:00 AM' }, { title: 'India-Bangladesh border', time: '12:00 PM' }, { title: 'Mawlynnong village', time: '2:00 PM' }] },
        { day: 5, title: 'Laitlum Canyon', description: 'Stunning canyon views.', activities: [{ title: 'Laitlum Canyon trek', time: '5:30 AM' }, { title: 'Shillong Peak', time: '10:00 AM' }, { title: 'Farewell dinner', time: '7:30 PM' }] },
        { day: 6, title: 'Departure', description: 'Airport drop.', activities: [{ title: 'Airport drop', time: '10:00 AM' }] },
      ],
      startDate: d(2026, 3, 14), endDate: d(2026, 3, 20),
      pricePerPerson: 14999, earlyBirdPrice: 12999, earlyBirdDeadline: d(2026, 2, 28),
      minGroupSize: 6, maxGroupSize: 14, currentBookings: 10,
      inclusions: ['Shillong airport pickup/drop', 'Accommodation (5N)', 'All meals', 'Dawki boating', 'All sightseeing by Innova', 'Trek guide', 'All entry tickets'],
      exclusions: ['Flights', 'Personal shopping', 'Travel insurance', 'Porter charges'],
      cancellationPolicy: 'STRICT',
      photos: ['https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
    },
  })

  console.log('  ✓ Created 8 completed trips (before April 2026)')
  return { tripC1, tripC2, tripC3, tripC4, tripC5, tripC6, tripC7, tripC8 }
}

// ══════════════════════════════════════════════════════════
// ── UPCOMING TRIPS FUNCTION ─────────────────────────────
// ══════════════════════════════════════════════════════════

async function seedUpcomingTrips(deps: Record<string, { id: string }>) {
  const { org1, org2, org3, org4, kasol, spiti, udaipur, coorg, varanasi, andaman } = deps

  const tripU1 = await prisma.trip.create({
    data: {
      organizerId: org1.id, destinationId: kasol.id,
      title: 'Kasol & Kheerganga Trek — 3N/4D Backpacker Special', slug: 'kasol-kheerganga-trek-jun-2026',
      tripType: 'TREKKING', bookingMode: 'INSTANT',
      description: 'Explore the mini Israel of India! Trek through pine forests to the legendary hot springs of Kheerganga, camp under the Himalayan sky, and soak in the chill vibes of Kasol village. Stay at riverside camps, try Israeli cuisine at famous cafes, and disconnect from city life completely. Perfect for backpackers, solo travelers, and friend groups.',
      itinerary: [
        { day: 1, title: 'Delhi to Kasol', description: 'Overnight Volvo to Bhuntar, then local transfer.', activities: [{ title: 'Arrive Kasol & camp check-in', time: '10:00 AM' }, { title: 'Parvati River walk', time: '12:00 PM' }, { title: 'Kasol market & cafe lunch', time: '1:00 PM' }, { title: 'Chalal village walk', time: '4:00 PM' }, { title: 'Bonfire at camp', time: '8:00 PM' }] },
        { day: 2, title: 'Kheerganga Trek (12 km)', description: 'Trek through forests and waterfalls.', activities: [{ title: 'Trek start from Barshaini', time: '7:00 AM' }, { title: 'Rudra Nag waterfall', time: '10:00 AM' }, { title: 'Arrive Kheerganga top', time: '1:00 PM' }, { title: 'Natural hot spring dip', time: '3:00 PM' }, { title: 'Camp dinner under stars', time: '8:00 PM' }] },
        { day: 3, title: 'Kheerganga to Kasol & Manikaran', description: 'Trek down, visit Manikaran Gurudwara.', activities: [{ title: 'Sunrise at Kheerganga', time: '5:30 AM' }, { title: 'Trek descent', time: '7:30 AM' }, { title: 'Manikaran Sahib Gurudwara', time: '1:00 PM' }, { title: 'Tosh village visit', time: '4:00 PM' }] },
        { day: 4, title: 'Departure', description: 'Morning departure to Delhi.', activities: [{ title: 'Breakfast', time: '8:00 AM' }, { title: 'Transfer to Bhuntar', time: '10:00 AM' }, { title: 'Board Volvo to Delhi', time: '5:00 PM' }] },
      ],
      startDate: d(2026, 6, 5), endDate: d(2026, 6, 9), bookingDeadline: d(2026, 5, 30),
      pricePerPerson: 9499, earlyBirdPrice: 8499, earlyBirdDeadline: d(2026, 5, 20),
      minGroupSize: 8, maxGroupSize: 20, currentBookings: 3,
      inclusions: ['Delhi-Kasol-Delhi Volvo', 'Riverside camp (2N) + Kheerganga camp (1N)', 'All meals', 'Trek guide', 'Bonfire', 'Manikaran visit', 'Local transfers'],
      exclusions: ['Lunch on Day 1', 'Personal snacks', 'Travel insurance', 'Porter (optional ₹800)'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
      transferPoints: { create: [
        { type: 'PICKUP', label: 'Delhi — Majnu Ka Tila', address: 'Majnu Ka Tila Gurudwara', time: '7:00 PM', sortOrder: 0 },
        { type: 'PICKUP', label: 'Delhi — Kashmere Gate ISBT', time: '8:00 PM', sortOrder: 1 },
        { type: 'PICKUP', label: 'Chandigarh — Sector 43 ISBT', time: '11:30 PM', sortOrder: 2 },
      ] },
    },
  })

  const tripU2 = await prisma.trip.create({
    data: {
      organizerId: org2.id, destinationId: spiti.id,
      title: 'Spiti Valley Circuit — 6N/7D High Altitude Adventure', slug: 'spiti-valley-circuit-jun-2026',
      tripType: 'ROAD_TRIP', bookingMode: 'REQUEST_BASED',
      description: 'Journey through the cold desert mountain valley of Spiti! Epic road trip from Shimla through Kinnaur to Kaza. Visit the world\'s highest post office at Hikkim, 1000-year-old Tabo Monastery, and stunning Chandratal Lake. Some of India\'s most dramatic and remote landscapes.',
      itinerary: [
        { day: 1, title: 'Shimla to Narkanda', description: 'Start the journey.', activities: [{ title: 'Shimla pickup', time: '7:00 AM' }, { title: 'Kufri stop', time: '9:00 AM' }, { title: 'Arrive Narkanda', time: '1:00 PM' }] },
        { day: 2, title: 'Narkanda to Sangla Valley', description: 'Enter Kinnaur valley.', activities: [{ title: 'Drive to Sangla', time: '7:00 AM' }, { title: 'Kamru Fort', time: '2:00 PM' }] },
        { day: 3, title: 'Chitkul & Kalpa', description: 'India\'s last village near Tibet.', activities: [{ title: 'Drive to Chitkul', time: '7:00 AM' }, { title: 'Chitkul village', time: '9:00 AM' }, { title: 'Kinner Kailash sunset from Kalpa', time: '5:30 PM' }] },
        { day: 4, title: 'Kalpa to Tabo', description: 'Enter Spiti.', activities: [{ title: 'Drive along Spiti River', time: '7:00 AM' }, { title: 'Nako Lake', time: '11:00 AM' }, { title: 'Tabo Monastery', time: '3:00 PM' }] },
        { day: 5, title: 'Tabo to Kaza via Dhankar', description: 'Capital of Spiti.', activities: [{ title: 'Dhankar Monastery', time: '8:00 AM' }, { title: 'Dhankar Lake trek', time: '10:00 AM' }, { title: 'Arrive Kaza', time: '2:00 PM' }] },
        { day: 6, title: 'Key, Kibber, Hikkim, Langza', description: 'Iconic Spiti villages.', activities: [{ title: 'Key Monastery', time: '7:30 AM' }, { title: 'Kibber village', time: '10:00 AM' }, { title: 'Hikkim post office', time: '12:00 PM' }, { title: 'Langza Buddha statue', time: '2:00 PM' }] },
        { day: 7, title: 'Chandratal & Manali', description: 'Exit via Kunzum Pass.', activities: [{ title: 'Chandratal Lake', time: '6:00 AM' }, { title: 'Kunzum Pass', time: '11:00 AM' }, { title: 'Arrive Manali', time: '6:00 PM' }] },
      ],
      startDate: d(2026, 6, 12), endDate: d(2026, 6, 19), bookingDeadline: d(2026, 6, 5),
      pricePerPerson: 14999, earlyBirdPrice: 12999, earlyBirdDeadline: d(2026, 5, 25),
      minGroupSize: 6, maxGroupSize: 12, currentBookings: 2,
      inclusions: ['Shimla to Manali transport (Innova/Xylo)', 'Accommodation (6N)', 'All meals', 'Monastery tickets', 'Inner Line Permit', 'Local driver', 'Oxygen & first aid'],
      exclusions: ['Travel to Shimla / from Manali', 'Personal expenses', 'Travel insurance (mandatory)'],
      cancellationPolicy: 'STRICT',
      photos: ['https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    },
  })

  const tripU3 = await prisma.trip.create({
    data: {
      organizerId: org3.id, destinationId: udaipur.id,
      title: 'Udaipur — City of Lakes Royal Getaway 2N/3D', slug: 'udaipur-city-of-lakes-jul-2026',
      tripType: 'CULTURAL', bookingMode: 'INSTANT',
      description: 'Experience the Venice of the East! Udaipur\'s stunning lake palaces, vibrant markets, and rich Mewari culture. Heritage walks, boat rides on Lake Pichola, a Rajasthani cooking class, and mesmerizing Dharohar dance show at Bagore ki Haveli.',
      itinerary: [
        { day: 1, title: 'Arrival & Lake City', description: 'Explore old city around Lake Pichola.', activities: [{ title: 'Hotel check-in', time: '10:00 AM' }, { title: 'City Palace tour', time: '12:00 PM' }, { title: 'Lake Pichola boat ride', time: '4:00 PM' }, { title: 'Dharohar dance show', time: '7:00 PM' }, { title: 'Dinner at Ambrai Ghat', time: '8:30 PM' }] },
        { day: 2, title: 'Heritage & Cooking', description: 'Mewari culture and cuisine.', activities: [{ title: 'Sajjangarh Monsoon Palace sunrise', time: '5:30 AM' }, { title: 'Rajasthani cooking class', time: '11:00 AM' }, { title: 'Vintage car museum', time: '3:00 PM' }, { title: 'Hathi Pol market walk', time: '5:00 PM' }] },
        { day: 3, title: 'Kumbhalgarh Fort & Departure', description: 'Great wall of India and departure.', activities: [{ title: 'Drive to Kumbhalgarh (85 km)', time: '7:00 AM' }, { title: 'Fort exploration', time: '9:30 AM' }, { title: 'Return & drop to station', time: '3:00 PM' }] },
      ],
      startDate: d(2026, 7, 3), endDate: d(2026, 7, 6), bookingDeadline: d(2026, 6, 28),
      pricePerPerson: 9999, earlyBirdPrice: 8999, earlyBirdDeadline: d(2026, 6, 15),
      minGroupSize: 6, maxGroupSize: 18, currentBookings: 4,
      inclusions: ['Lakeside hotel (2N)', 'Breakfast & dinner', 'Lake Pichola boat ride', 'City Palace & fort tickets', 'Cooking class', 'Dharohar show ticket', 'Kumbhalgarh day trip by AC vehicle'],
      exclusions: ['Train/flight tickets', 'Lunch', 'Shopping', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
      transferPoints: { create: [
        { type: 'PICKUP', label: 'Udaipur Railway Station', time: '9:30 AM', sortOrder: 0 },
        { type: 'PICKUP', label: 'Udaipur Airport', time: '9:00 AM', sortOrder: 1 },
      ] },
    },
  })

  const tripU4 = await prisma.trip.create({
    data: {
      organizerId: org4.id, destinationId: coorg.id,
      title: 'Coorg Coffee Plantation Retreat — 2N/3D', slug: 'coorg-coffee-plantation-jul-2026',
      tripType: 'WEEKEND', bookingMode: 'INSTANT',
      description: 'Escape to the Scotland of India! Rolling hills of coffee plantations, misty waterfalls, and spice gardens. Coffee estate tours, private waterfall hikes, and authentic Kodava cuisine. Stay at a plantation homestay surrounded by 200-year-old coffee and pepper vines.',
      itinerary: [
        { day: 1, title: 'Arrival & Plantation Walk', description: 'Immerse in nature at coffee estate.', activities: [{ title: 'Bangalore/Mysore pickup', time: '6:00 AM' }, { title: 'Homestay check-in', time: '12:00 PM' }, { title: 'Coffee plantation walk', time: '2:30 PM' }, { title: 'Coffee roasting & tasting', time: '4:00 PM' }, { title: 'Kodava pork curry dinner', time: '7:30 PM' }] },
        { day: 2, title: 'Waterfalls & Viewpoints', description: 'Full day exploring Coorg.', activities: [{ title: 'Abbey Falls trek', time: '7:30 AM' }, { title: 'Raja\'s Seat viewpoint', time: '10:00 AM' }, { title: 'Madikeri Fort', time: '11:30 AM' }, { title: 'Iruppu Falls hike', time: '3:00 PM' }, { title: 'Golden Temple (Namdroling Monastery)', time: '5:30 PM' }, { title: 'Bonfire & BBQ dinner', time: '8:00 PM' }] },
        { day: 3, title: 'Dubare Elephants & Departure', description: 'Morning with elephants.', activities: [{ title: 'Dubare Elephant Camp', time: '7:00 AM' }, { title: 'Cauvery coracle ride', time: '9:30 AM' }, { title: 'Brunch & departure', time: '11:00 AM' }] },
      ],
      startDate: d(2026, 7, 10), endDate: d(2026, 7, 13), bookingDeadline: d(2026, 7, 5),
      pricePerPerson: 10999, earlyBirdPrice: 9499, earlyBirdDeadline: d(2026, 6, 25),
      minGroupSize: 6, maxGroupSize: 14, currentBookings: 2,
      inclusions: ['Bangalore/Mysore pickup & drop', 'Plantation homestay (2N)', 'All meals (Kodava cuisine)', 'Coffee estate tour', 'Abbey Falls & Iruppu entry', 'Dubare entry', 'Coracle ride', 'Innova transfers'],
      exclusions: ['Elephant ride (₹500)', 'Personal expenses', 'Travel insurance', 'Alcohol'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
      transferPoints: { create: [
        { type: 'PICKUP', label: 'Bangalore — Majestic Bus Stand', time: '6:00 AM', sortOrder: 0 },
        { type: 'PICKUP', label: 'Mysore — KSRTC Bus Stand', time: '8:30 AM', sortOrder: 1 },
      ] },
    },
  })

  const tripU5 = await prisma.trip.create({
    data: {
      organizerId: org1.id, destinationId: varanasi.id,
      title: 'Varanasi — Spiritual & Cultural Immersion 2N/3D', slug: 'varanasi-spiritual-immersion-aug-2026',
      tripType: 'CULTURAL', bookingMode: 'INSTANT',
      description: 'Witness the world\'s oldest living city! Mesmerizing Ganga Aarti, ancient ghats, narrow bylanes of silk weavers. Morning boat rides at sunrise, street food walks through Vishwanath Gali, and silk weaving workshops. This trip takes you beyond the tourist surface into the real Banaras.',
      itinerary: [
        { day: 1, title: 'Arrival & Ganga Aarti', description: 'Arrive and witness legendary evening aarti.', activities: [{ title: 'Haveli check-in', time: '11:00 AM' }, { title: 'Kachori-jalebi-thandai food trail', time: '12:30 PM' }, { title: 'Kashi Vishwanath Temple', time: '3:00 PM' }, { title: 'Ganga Aarti at Dashashwamedh Ghat', time: '6:30 PM' }] },
        { day: 2, title: 'Sunrise Boat Ride & Culture', description: 'Magic of Varanasi at dawn.', activities: [{ title: 'Sunrise boat ride on Ganges', time: '5:00 AM' }, { title: 'Subah-e-Banaras music at Assi Ghat', time: '6:30 AM' }, { title: 'Sarnath — Buddha\'s first sermon', time: '10:00 AM' }, { title: 'Silk weaving workshop', time: '2:00 PM' }, { title: 'Street food walk — chaat, paan, rabri', time: '7:00 PM' }] },
        { day: 3, title: 'Morning Ghats & Departure', description: 'Last morning walk.', activities: [{ title: 'Yoga at Assi Ghat', time: '5:30 AM' }, { title: 'Lesser-known ghats walk', time: '7:30 AM' }, { title: 'Drop to station/airport', time: '1:00 PM' }] },
      ],
      startDate: d(2026, 8, 7), endDate: d(2026, 8, 10), bookingDeadline: d(2026, 8, 2),
      pricePerPerson: 8999, earlyBirdPrice: 7999, earlyBirdDeadline: d(2026, 7, 20),
      minGroupSize: 6, maxGroupSize: 16, currentBookings: 1,
      inclusions: ['Heritage haveli near ghats (2N)', 'Breakfast & dinner + street food walk', 'Sunrise boat ride', 'Sarnath entry & guide', 'Silk weaving workshop', 'Yoga session', 'Local rickshaw transfers'],
      exclusions: ['Flight/train tickets', 'Lunch', 'Shopping', 'Temple donations', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
      transferPoints: { create: [
        { type: 'PICKUP', label: 'Varanasi Airport', address: 'Lal Bahadur Shastri Airport, Arrivals', time: '10:00 AM', sortOrder: 0 },
        { type: 'PICKUP', label: 'Varanasi Junction Station', time: '10:30 AM', sortOrder: 1 },
      ] },
    },
  })

  const tripU6 = await prisma.trip.create({
    data: {
      organizerId: org4.id, destinationId: andaman.id,
      title: 'Andaman Islands Beach & Scuba Expedition 4N/5D', slug: 'andaman-beach-scuba-sep-2026',
      tripType: 'BEACH', bookingMode: 'REQUEST_BASED',
      description: 'Crystal clear turquoise waters, pristine white sand beaches, and vibrant coral reefs — welcome to Andaman! Covers Havelock Island (Swaraj Dweep) and Neil Island (Shaheed Dweep). Scuba diving at Asia\'s best dive sites, mangrove kayaking, and bioluminescence at night. Limited group for an exclusive experience.',
      itinerary: [
        { day: 1, title: 'Port Blair — Cellular Jail', description: 'Historic Cellular Jail visit.', activities: [{ title: 'Airport pickup & hotel check-in', time: '11:00 AM' }, { title: 'Ross Island', time: '1:00 PM' }, { title: 'Cellular Jail museum', time: '4:00 PM' }, { title: 'Sound & Light Show', time: '6:00 PM' }] },
        { day: 2, title: 'Havelock Island — Radhanagar Beach', description: 'Ferry to Havelock.', activities: [{ title: 'Ferry to Havelock', time: '7:00 AM' }, { title: 'Resort check-in', time: '11:00 AM' }, { title: 'Radhanagar Beach (Asia\'s best beach)', time: '2:00 PM' }, { title: 'Sunset at Radhanagar', time: '5:30 PM' }] },
        { day: 3, title: 'Scuba Diving & Elephant Beach', description: 'Underwater adventure.', activities: [{ title: 'Scuba diving session (no experience needed)', time: '8:00 AM' }, { title: 'Elephant Beach snorkeling', time: '12:00 PM' }, { title: 'Mangrove kayaking', time: '4:00 PM' }, { title: 'Bioluminescence night walk', time: '8:00 PM' }] },
        { day: 4, title: 'Neil Island Day Trip', description: 'Natural rock formations.', activities: [{ title: 'Ferry to Neil Island', time: '8:00 AM' }, { title: 'Natural Bridge (Howrah Bridge)', time: '10:00 AM' }, { title: 'Bharatpur Beach snorkeling', time: '12:00 PM' }, { title: 'Laxmanpur sunset', time: '5:00 PM' }, { title: 'Return to Havelock', time: '6:30 PM' }] },
        { day: 5, title: 'Departure', description: 'Ferry back and fly out.', activities: [{ title: 'Ferry to Port Blair', time: '7:00 AM' }, { title: 'Sagarika Emporium shopping', time: '12:00 PM' }, { title: 'Airport drop', time: '3:00 PM' }] },
      ],
      startDate: d(2026, 9, 4), endDate: d(2026, 9, 9), bookingDeadline: d(2026, 8, 25),
      pricePerPerson: 14499, earlyBirdPrice: 12499, earlyBirdDeadline: d(2026, 8, 10),
      minGroupSize: 6, maxGroupSize: 12, currentBookings: 0,
      inclusions: ['Port Blair hotel (1N) + Havelock resort (3N)', 'All meals', 'Ferry tickets (Port Blair-Havelock-Neil-Port Blair)', 'Scuba diving session', 'Snorkeling gear', 'Mangrove kayaking', 'All entry tickets', 'Local transfers'],
      exclusions: ['Flights to/from Port Blair', 'Lunch on Day 1', 'Water sports beyond package', 'Travel insurance (mandatory)', 'Personal expenses'],
      cancellationPolicy: 'STRICT',
      photos: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    },
  })

  console.log('  ✓ Created 6 upcoming trips (June-Sep 2026, ₹9K-15K range)')
  return { tripU1, tripU2, tripU3, tripU4, tripU5, tripU6 }
}

// ══════════════════════════════════════════════════════════
// ── BOOKINGS & REVIEWS FUNCTION ─────────────────────────
// ══════════════════════════════════════════════════════════

async function seedBookingsAndReviews(deps: {
  completedTrips: Record<string, { id: string }>
  upcomingTrips: Record<string, { id: string }>
  travelers: Array<{ id: string; name: string }>
  [key: string]: unknown
}) {
  const { completedTrips: ct, upcomingTrips: ut, travelers } = deps
  const org1User = deps.org1User as { id: string }
  const org2User = deps.org2User as { id: string }
  const org3User = deps.org3User as { id: string }
  const org4User = deps.org4User as { id: string }
  const org1 = deps.org1 as { id: string }
  const org2 = deps.org2 as { id: string }
  const admin = deps.admin as { id: string }
  const org5User = deps.org5User as { id: string }
  const org6User = deps.org6User as { id: string }
  const [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12] = travelers

  let refNum = 0
  const nextRef = () => `SFN-2026-${String(++refNum).padStart(4, '0')}`

  // ══════════════════════════════════════════════════════
  // ── COMPLETED TRIP BOOKINGS ───────────────────────────
  // ══════════════════════════════════════════════════════

  // Trip C1: Goa Beach Carnival — 18 bookings (completed)
  const bC1_1 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t1.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'COMPLETED' } })
  const bC1_2 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t2.id, numTravelers: 1, totalAmount: 5499, bookingStatus: 'COMPLETED' } })
  const bC1_3 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t3.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'COMPLETED' } })
  const bC1_4 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t4.id, numTravelers: 1, totalAmount: 6499, bookingStatus: 'COMPLETED' } })
  const bC1_5 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t5.id, numTravelers: 3, totalAmount: 16497, bookingStatus: 'COMPLETED' } })
  const bC1_6 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t6.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'COMPLETED' } })
  const bC1_7 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t7.id, numTravelers: 1, totalAmount: 6499, bookingStatus: 'COMPLETED' } })
  const bC1_8 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t8.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'COMPLETED' } })
  await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t9.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'CANCELLED', cancellationReason: 'Could not get leave from office', cancelledAt: d(2026, 1, 5), cancelledById: t9.id } })
  await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t10.id, numTravelers: 1, totalAmount: 6499, bookingStatus: 'CANCELLED', cancellationReason: 'Family emergency', cancelledAt: d(2026, 1, 8), cancelledById: t10.id } })

  // Trip C2: Manali Snow — 14 bookings
  const bC2_1 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t3.id, numTravelers: 2, totalAmount: 17998, bookingStatus: 'COMPLETED' } })
  const bC2_2 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t5.id, numTravelers: 1, totalAmount: 7999, bookingStatus: 'COMPLETED' } })
  const bC2_3 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t7.id, numTravelers: 2, totalAmount: 17998, bookingStatus: 'COMPLETED' } })
  const bC2_4 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t9.id, numTravelers: 1, totalAmount: 8999, bookingStatus: 'COMPLETED' } })
  const bC2_5 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t11.id, numTravelers: 2, totalAmount: 17998, bookingStatus: 'COMPLETED' } })
  const bC2_6 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t12.id, numTravelers: 1, totalAmount: 8999, bookingStatus: 'COMPLETED' } })

  // Trip C3: Rishikesh Rafting — 20 bookings
  const bC3_1 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t1.id, numTravelers: 3, totalAmount: 10497, bookingStatus: 'COMPLETED' } })
  const bC3_2 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t4.id, numTravelers: 2, totalAmount: 6998, bookingStatus: 'COMPLETED' } })
  const bC3_3 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t6.id, numTravelers: 1, totalAmount: 3499, bookingStatus: 'COMPLETED' } })
  const bC3_4 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t8.id, numTravelers: 2, totalAmount: 6998, bookingStatus: 'COMPLETED' } })
  const bC3_5 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t10.id, numTravelers: 1, totalAmount: 3499, bookingStatus: 'COMPLETED' } })
  const bC3_6 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t12.id, numTravelers: 2, totalAmount: 6998, bookingStatus: 'COMPLETED' } })

  // Trip C4: Jaipur Heritage — 16 bookings
  const bC4_1 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t2.id, numTravelers: 2, totalAmount: 9998, bookingStatus: 'COMPLETED' } })
  const bC4_2 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t4.id, numTravelers: 1, totalAmount: 5999, bookingStatus: 'COMPLETED' } })
  const bC4_3 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t6.id, numTravelers: 2, totalAmount: 11998, bookingStatus: 'COMPLETED' } })
  const bC4_4 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t8.id, numTravelers: 1, totalAmount: 5999, bookingStatus: 'COMPLETED' } })
  const bC4_5 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t10.id, numTravelers: 2, totalAmount: 11998, bookingStatus: 'COMPLETED' } })
  const bC4_6 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t11.id, numTravelers: 1, totalAmount: 4999, bookingStatus: 'COMPLETED' } })

  console.log('  ✓ Created completed trip bookings (C1-C4)')

  // ── Payments for completed trips ──
  const completedBookings = [bC1_1, bC1_2, bC1_3, bC1_4, bC1_5, bC1_6, bC1_7, bC1_8, bC2_1, bC2_2, bC2_3, bC2_4, bC2_5, bC2_6, bC3_1, bC3_2, bC3_3, bC3_4, bC3_5, bC3_6, bC4_1, bC4_2, bC4_3, bC4_4, bC4_5, bC4_6]
  let payIdx = 0
  for (const b of completedBookings) {
    await prisma.paymentTransaction.create({
      data: { bookingId: b.id, type: 'PAYMENT', amount: b.totalAmount, status: 'CAPTURED', razorpayOrderId: `order_prod_${String(++payIdx).padStart(3, '0')}`, razorpayPaymentId: `pay_prod_${String(payIdx).padStart(3, '0')}` },
    })
  }
  console.log(`  ✓ Created ${payIdx} payment transactions for completed trips`)

  // ── Traveler details for key bookings ──
  await prisma.travelerDetail.createMany({
    data: [
      { bookingId: bC1_1.id, name: 'Amit Kulkarni', phone: '+919876543210', age: 28, gender: 'MALE', isPrimary: true, emergencyContactName: 'Sneha Kulkarni', emergencyContactPhone: '+919876543230' },
      { bookingId: bC1_1.id, name: 'Prerna Kulkarni', age: 26, gender: 'FEMALE' },
      { bookingId: bC1_2.id, name: 'Sneha Deshmukh', phone: '+919876543211', age: 25, gender: 'FEMALE', isPrimary: true },
      { bookingId: bC1_3.id, name: 'Rohan Joshi', phone: '+919876543212', age: 30, gender: 'MALE', isPrimary: true },
      { bookingId: bC1_3.id, name: 'Neha Joshi', age: 28, gender: 'FEMALE' },
      { bookingId: bC1_4.id, name: 'Kavita Reddy', phone: '+919876543213', age: 27, gender: 'FEMALE', isPrimary: true },
      { bookingId: bC1_5.id, name: 'Saurabh Patil', phone: '+919876543214', age: 29, gender: 'MALE', isPrimary: true },
      { bookingId: bC1_5.id, name: 'Akash Patil', age: 27, gender: 'MALE' },
      { bookingId: bC1_5.id, name: 'Varun Patil', age: 26, gender: 'MALE' },
      { bookingId: bC2_1.id, name: 'Rohan Joshi', phone: '+919876543212', age: 30, gender: 'MALE', isPrimary: true },
      { bookingId: bC2_1.id, name: 'Meghna Joshi', age: 28, gender: 'FEMALE' },
      { bookingId: bC2_3.id, name: 'Karan Singh', phone: '+919876543216', age: 31, gender: 'MALE', isPrimary: true },
      { bookingId: bC2_3.id, name: 'Simran Kaur', age: 29, gender: 'FEMALE' },
      { bookingId: bC3_1.id, name: 'Amit Kulkarni', phone: '+919876543210', age: 28, gender: 'MALE', isPrimary: true },
      { bookingId: bC3_1.id, name: 'Ravi Sharma', age: 27, gender: 'MALE' },
      { bookingId: bC3_1.id, name: 'Deepak Yadav', age: 29, gender: 'MALE' },
      { bookingId: bC4_1.id, name: 'Sneha Deshmukh', phone: '+919876543211', age: 25, gender: 'FEMALE', isPrimary: true },
      { bookingId: bC4_1.id, name: 'Priya Deshmukh', age: 52, gender: 'FEMALE' },
    ],
  })
  console.log('  ✓ Created traveler details')

  // ══════════════════════════════════════════════════════
  // ── REVIEWS (for completed trips only) ────────────────
  // ══════════════════════════════════════════════════════

  const reviewData = [
    // Goa Beach Carnival reviews
    { tripId: ct.tripC1.id, bookingId: bC1_1.id, userId: t1.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Absolutely incredible trip! The beachfront resort was stunning, water sports were thrilling, and the group was amazing. Thrillophilia really knows how to organize a perfect Goa getaway. Already planning my next trip with them!', daysAgo: 95 },
    { tripId: ct.tripC1.id, bookingId: bC1_2.id, userId: t2.id, overall: 4, org: 5, val: 4, safe: 5, acc: 4, comment: 'Great experience overall! The Fort Aguada sunset was magical. Only suggestion would be to include lunch in the package. Breakfast and dinner were delicious though.', daysAgo: 93 },
    { tripId: ct.tripC1.id, bookingId: bC1_3.id, userId: t3.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'My wife and I had the best time! South Goa day was the highlight — Palolem Beach was paradise. The spice plantation dinner was a unique touch. Highly recommended for couples!', daysAgo: 91 },
    { tripId: ct.tripC1.id, bookingId: bC1_4.id, userId: t4.id, overall: 4, org: 4, val: 5, safe: 4, acc: 4, comment: 'Great value for ₹6,499! The water sports package alone would cost ₹3,000 if booked separately. Bus from Pune was comfortable. Will come again!', daysAgo: 90 },
    { tripId: ct.tripC1.id, bookingId: bC1_5.id, userId: t5.id, overall: 5, org: 5, val: 4, safe: 5, acc: 5, comment: 'Went with two friends and we had a blast! The organizer was super helpful — even arranged a birthday cake for my friend as a surprise. These small touches make all the difference.', daysAgo: 89 },
    { tripId: ct.tripC1.id, bookingId: bC1_6.id, userId: t6.id, overall: 3, org: 3, val: 3, safe: 4, acc: 3, comment: 'Trip was decent but expected more from the nightlife side. The resort was far from the clubs so we had to arrange our own transport at night. Day activities were well planned though.', daysAgo: 88 },
    { tripId: ct.tripC1.id, bookingId: bC1_7.id, userId: t7.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'As a solo traveler, this was perfect! Made 6 new friends on this trip. The group dynamics were great and the organizer ensured everyone was included in every activity.', daysAgo: 87 },
    { tripId: ct.tripC1.id, bookingId: bC1_8.id, userId: t8.id, overall: 4, org: 4, val: 4, safe: 5, acc: 4, comment: 'Beautiful trip with great safety measures. The life jackets and trained guides during water sports made me feel very secure. Would have loved an extra day in South Goa.', daysAgo: 86 },

    // Manali Snow reviews
    { tripId: ct.tripC2.id, bookingId: bC2_1.id, userId: t3.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'First time seeing snow and it exceeded every expectation! The cottage was cozy with amazing mountain views. Solang Valley skiing was the highlight. WanderOn made this trip magical!', daysAgo: 80 },
    { tripId: ct.tripC2.id, bookingId: bC2_2.id, userId: t5.id, overall: 4, org: 4, val: 5, safe: 4, acc: 4, comment: 'Great value trip. The Atal Tunnel day trip was an unexpected bonus — Sissu was breathtaking. Only downside was the Volvo bus could have been newer. Food was excellent throughout.', daysAgo: 78 },
    { tripId: ct.tripC2.id, bookingId: bC2_3.id, userId: t7.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Took my girlfriend on this trip and she loved every moment! The bonfire night with hot chocolate under the stars was impossibly romantic. Old Manali cafes were the cherry on top.', daysAgo: 76 },
    { tripId: ct.tripC2.id, bookingId: bC2_4.id, userId: t9.id, overall: 3, org: 3, val: 3, safe: 4, acc: 2, comment: 'The skiing session was only 1 hour which felt rushed. Description said "skiing session" — I expected at least 2-3 hours. Rest of the trip was good but this was disappointing.', daysAgo: 75 },
    { tripId: ct.tripC2.id, bookingId: bC2_5.id, userId: t11.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'My parents joined me on this trip and they absolutely loved it! The pace was perfect — not too rushed. Vashisht Hot Springs was their favourite. Planning to do the summer batch next!', daysAgo: 74 },
    { tripId: ct.tripC2.id, bookingId: bC2_6.id, userId: t12.id, overall: 4, org: 5, val: 4, safe: 5, acc: 4, comment: 'Well-organized from start to finish. The guide knew every trail and shared fascinating local stories. Photography tip: the light at Solang Valley is best between 10-11 AM.', daysAgo: 73 },

    // Rishikesh Rafting reviews
    { tripId: ct.tripC3.id, bookingId: bC3_1.id, userId: t1.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'The 16 km rafting was absolutely INSANE! Grade IV rapids had everyone screaming. The cliff jumping was terrifying but worth it. Riverside camping under the stars was the perfect ending. Best ₹3,499 ever spent!', daysAgo: 65 },
    { tripId: ct.tripC3.id, bookingId: bC3_2.id, userId: t4.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Went with my brother and we had an absolute blast. The sunrise yoga by the Ganges was unexpectedly peaceful. From adrenaline to zen in 12 hours — this trip has everything!', daysAgo: 63 },
    { tripId: ct.tripC3.id, bookingId: bC3_3.id, userId: t6.id, overall: 4, org: 4, val: 5, safe: 4, acc: 4, comment: 'Great adventure weekend. The bonfire with live guitar was magical. Only wish: the tents could have been slightly bigger. But for this price point, absolutely no complaints!', daysAgo: 62 },
    { tripId: ct.tripC3.id, bookingId: bC3_4.id, userId: t8.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'As a solo female traveler, I was initially nervous about camping. But the organizer ensured separate tents for women and the group was incredibly respectful. Safety was top-notch. 10/10!', daysAgo: 61 },
    { tripId: ct.tripC3.id, bookingId: bC3_5.id, userId: t10.id, overall: 4, org: 4, val: 4, safe: 5, acc: 3, comment: 'Rafting was amazing but I expected to visit Beatles Ashram which was listed as optional but ended up being rushed. The camping and bonfire made up for it though!', daysAgo: 60 },
    { tripId: ct.tripC3.id, bookingId: bC3_6.id, userId: t12.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'This was my 3rd time rafting in Rishikesh and by far the best experience. The guide knew exactly which rapids to hit for maximum fun. The Ganga Aarti evening was spiritually uplifting. Thrillophilia delivers!', daysAgo: 59 },

    // Jaipur Heritage reviews
    { tripId: ct.tripC4.id, bookingId: bC4_1.id, userId: t2.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Took my mother on this trip and she was in tears at Amber Fort — she had always wanted to visit. The heritage haveli stay felt like living in history. Chokhi Dhani dinner was the highlight. Thank you Tripoto!', daysAgo: 50 },
    { tripId: ct.tripC4.id, bookingId: bC4_2.id, userId: t4.id, overall: 4, org: 4, val: 4, safe: 5, acc: 4, comment: 'The block printing workshop was surprisingly fun — I made my own tablecloth! Nahargarh Fort sunset with chai was Instagram gold. Good mix of history and hands-on experiences.', daysAgo: 48 },
    { tripId: ct.tripC4.id, bookingId: bC4_3.id, userId: t6.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Jaipur exceeded every expectation. The local guide at City Palace was incredibly knowledgeable — felt like a private royal tour. The haveli room had carved wooden doors that were 200 years old!', daysAgo: 47 },
    { tripId: ct.tripC4.id, bookingId: bC4_4.id, userId: t8.id, overall: 4, org: 4, val: 4, safe: 5, acc: 3, comment: 'Lovely trip but the schedule was very packed. Would have appreciated a free afternoon to explore at our own pace. The food at Chokhi Dhani was authentic and delicious.', daysAgo: 46 },
    { tripId: ct.tripC4.id, bookingId: bC4_5.id, userId: t10.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'The lassi at Lassiwala was the best thing I have ever tasted! The entire trip was a sensory overload — colors, flavors, history. Tripoto curates experiences, not just trips. Big difference!', daysAgo: 45 },
    { tripId: ct.tripC4.id, bookingId: bC4_6.id, userId: t11.id, overall: 3, org: 4, val: 3, safe: 5, acc: 3, comment: 'Decent trip but a bit overpriced for 2N/3D. The Johari Bazaar visit felt rushed. Would prefer more time shopping and less at Albert Hall Museum. Good for first-time visitors though.', daysAgo: 44 },
  ]

  const reviewPhotos = [
    ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600'],
    ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600'],
    [],
    ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600'],
    ['https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600'],
    [],
    ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600'],
    [],
    ['https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=600', 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600'],
    ['https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=600'],
    [],
    [],
    ['https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=600', 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600'],
    ['https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=600'],
    ['https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=600', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600'],
    ['https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=600'],
    [],
    ['https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=600', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600'],
    [],
    ['https://images.unsplash.com/photo-1588083949468-c1c1f79104f6?w=600'],
    ['https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600', 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600'],
    ['https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600'],
    ['https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600', 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600'],
    [],
    ['https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600'],
    [],
  ]

  const orgReplies: Record<number, { reply: string; daysAfter: number }> = {
    0: { reply: 'Thank you Amit! So glad you and your wife had a great time. The group was fantastic this batch. See you on our next Goa trip! 🏖️', daysAfter: 2 },
    4: { reply: 'Happy birthday to your friend! We love adding those personal touches. Thanks for choosing Thrillophilia! 🎂', daysAfter: 3 },
    5: { reply: 'Thank you for the feedback, Ananya. We have added a late-night shuttle service for future batches. Hope to see you again!', daysAfter: 1 },
    8: { reply: 'Welcome to the snow fam, Rohan! That cottage really is special, isn\'t it? The mountain views at sunrise are unforgettable. See you next winter! ❄️', daysAfter: 2 },
    11: { reply: 'We appreciate your honest feedback, Nikhil. The skiing session has been extended to 2 hours for all upcoming batches. We take accuracy seriously!', daysAfter: 1 },
    14: { reply: 'Grade IV rapids + cliff jumping + stargazing = the ultimate Rishikesh weekend! Thanks Amit, see you for the monsoon batch! 🌊', daysAfter: 2 },
    17: { reply: 'Safety is our #1 priority, Meera. We are so happy you felt safe as a solo traveler. Our separate tent policy is something we are very proud of! ❤️', daysAfter: 1 },
    20: { reply: 'Sneha, your mother\'s reaction at Amber Fort made our team emotional too! That\'s exactly why we do this. Thank you for trusting Tripoto with such a special trip! 🙏', daysAfter: 2 },
  }

  for (let i = 0; i < reviewData.length; i++) {
    const r = reviewData[i]
    const reply = orgReplies[i]
    await prisma.review.create({
      data: {
        tripId: r.tripId, bookingId: r.bookingId, userId: r.userId,
        overallRating: r.overall, organizationRating: r.org, valueRating: r.val, safetyRating: r.safe, accuracyRating: r.acc,
        comment: r.comment, photos: reviewPhotos[i] ?? [],
        ...(reply && { organizerReply: reply.reply, organizerReplyAt: new Date(d(2026, 5, 7).getTime() - (r.daysAgo - reply.daysAfter) * 86400000) }),
        createdAt: new Date(d(2026, 5, 7).getTime() - r.daysAgo * 86400000),
      },
    })
  }
  console.log(`  ✓ Created ${reviewData.length} reviews with photos & organizer replies`)

  // ══════════════════════════════════════════════════════
  // ── UPCOMING TRIP BOOKINGS ────────────────────────────
  // ══════════════════════════════════════════════════════

  // Kasol trek — 3 confirmed
  const bU1_1 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ut.tripU1.id, userId: t1.id, numTravelers: 2, totalAmount: 16998, bookingStatus: 'CONFIRMED' } })
  await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ut.tripU1.id, userId: t6.id, numTravelers: 1, totalAmount: 8499, bookingStatus: 'CONFIRMED' } })
  // Pending payment
  await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ut.tripU1.id, userId: t9.id, numTravelers: 1, totalAmount: 9499, bookingStatus: 'PENDING_PAYMENT', expiresAt: d(2026, 5, 10) } })

  // Spiti — 2 confirmed (request-based)
  const bU2_1 = await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ut.tripU2.id, userId: t3.id, numTravelers: 2, totalAmount: 25998, bookingStatus: 'CONFIRMED' } })
  await prisma.tripRequest.create({ data: { tripId: ut.tripU2.id, userId: t3.id, numTravelers: 2, message: 'My wife and I have been dreaming of Spiti for years. Both experienced at high altitude. Please approve!', status: 'APPROVED', respondedAt: d(2026, 5, 1), responseNote: 'Welcome aboard! Payment link sent.', bookingId: bU2_1.id } })
  await prisma.tripRequest.create({ data: { tripId: ut.tripU2.id, userId: t7.id, numTravelers: 1, message: 'Solo photographer looking for Spiti landscapes. I have altitude experience from Ladakh.', status: 'PENDING', approvalExpiresAt: d(2026, 5, 15) } })
  await prisma.tripRequest.create({ data: { tripId: ut.tripU2.id, userId: t11.id, numTravelers: 2, message: 'College friends roadtrip! We both have our own bikes — can we ride our own instead?', status: 'PENDING', approvalExpiresAt: d(2026, 5, 15) } })

  // Udaipur — 4 confirmed
  await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ut.tripU3.id, userId: t2.id, numTravelers: 2, totalAmount: 17998, bookingStatus: 'CONFIRMED' } })
  await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ut.tripU3.id, userId: t8.id, numTravelers: 1, totalAmount: 8999, bookingStatus: 'CONFIRMED' } })
  await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ut.tripU3.id, userId: t10.id, numTravelers: 1, totalAmount: 9999, bookingStatus: 'CONFIRMED' } })

  // Coorg — 2 confirmed
  await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ut.tripU4.id, userId: t4.id, numTravelers: 2, totalAmount: 18998, bookingStatus: 'CONFIRMED' } })

  // Varanasi — 1 confirmed
  await prisma.booking.create({ data: { bookingRef: nextRef(), tripId: ut.tripU5.id, userId: t12.id, numTravelers: 1, totalAmount: 7999, bookingStatus: 'CONFIRMED' } })

  // Andaman — request-based, only pending requests
  await prisma.tripRequest.create({ data: { tripId: ut.tripU6.id, userId: t5.id, numTravelers: 2, message: 'Honeymoon trip! My wife and I love scuba diving. Any couples discounts available?', status: 'PENDING', approvalExpiresAt: d(2026, 6, 1) } })
  await prisma.tripRequest.create({ data: { tripId: ut.tripU6.id, userId: t9.id, numTravelers: 1, message: 'Solo travel photographer. Can I bring my underwater camera and drone?', status: 'PENDING', approvalExpiresAt: d(2026, 6, 1) } })

  // Payments for upcoming confirmed bookings
  await prisma.paymentTransaction.create({ data: { bookingId: bU1_1.id, type: 'PAYMENT', amount: 16998, status: 'CAPTURED', razorpayOrderId: 'order_prod_up01', razorpayPaymentId: 'pay_prod_up01' } })
  await prisma.paymentTransaction.create({ data: { bookingId: bU2_1.id, type: 'PAYMENT', amount: 25998, status: 'CAPTURED', razorpayOrderId: 'order_prod_up02', razorpayPaymentId: 'pay_prod_up02' } })

  console.log('  ✓ Created upcoming trip bookings, requests & payments')

  // ══════════════════════════════════════════════════════
  // ── CONVERSATIONS & MESSAGES ──────────────────────────
  // ══════════════════════════════════════════════════════

  const conv1 = await prisma.conversation.create({
    data: { tripId: ut.tripU1.id, travelerId: t1.id, organizerProfileId: org1.id, lastMessageAt: d(2026, 5, 5), lastMessagePreview: 'Thanks! Can we bring our own sleeping bags?' },
  })
  await prisma.message.createMany({ data: [
    { conversationId: conv1.id, senderId: t1.id, content: 'Hi! What should we pack for the Kheerganga trek? Any specific shoes recommended?', readAt: d(2026, 5, 4) },
    { conversationId: conv1.id, senderId: org1User.id, content: 'Hey Amit! Bring sturdy trekking shoes with good grip — the trail gets slippery. Layer up with thermals + fleece. We provide sleeping bags at camp but bring a rain poncho.', readAt: d(2026, 5, 5) },
    { conversationId: conv1.id, senderId: t1.id, content: 'Thanks! Can we bring our own sleeping bags?', readAt: null },
  ] })

  const conv2 = await prisma.conversation.create({
    data: { tripId: ut.tripU2.id, travelerId: t3.id, organizerProfileId: org2.id, lastMessageAt: d(2026, 5, 3), lastMessagePreview: 'We have a doctor on speed dial and carry oxygen cylinders.' },
  })
  await prisma.message.createMany({ data: [
    { conversationId: conv2.id, senderId: t3.id, content: 'Is the Spiti trip safe for someone with mild asthma? My wife has a mild condition.', readAt: d(2026, 5, 2) },
    { conversationId: conv2.id, senderId: org2User.id, content: 'Great question, Rohan. We recommend consulting your doctor first. We carry oxygen cylinders and the itinerary includes gradual altitude gain. We have a doctor on speed dial and carry oxygen cylinders.', readAt: d(2026, 5, 3) },
  ] })

  // Admin support conversation
  const conv3 = await prisma.conversation.create({
    data: { type: 'ADMIN_SUPPORT', travelerId: t9.id, adminId: admin.id, lastMessageAt: d(2026, 5, 6), lastMessagePreview: 'We have extended your payment deadline by 24 hours.' },
  })
  await prisma.message.createMany({ data: [
    { conversationId: conv3.id, senderId: t9.id, content: 'Hi, my payment for Kasol trek failed but the booking shows pending. Can you help?', readAt: d(2026, 5, 6) },
    { conversationId: conv3.id, senderId: admin.id, content: 'Hi Nikhil, I can see the failed attempt. We have extended your payment deadline by 24 hours. Please try again with a different payment method.', readAt: d(2026, 5, 6) },
  ] })

  console.log('  ✓ Created 3 conversations with messages')

  // ══════════════════════════════════════════════════════
  // ── NOTIFICATIONS ─────────────────────────────────────
  // ══════════════════════════════════════════════════════

  await prisma.notification.createMany({ data: [
    { userId: t1.id, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed!', body: 'Your booking for "Kasol & Kheerganga Trek" is confirmed.', sentAt: d(2026, 5, 2), readAt: d(2026, 5, 2) },
    { userId: t1.id, channel: 'IN_APP', type: 'TRIP_REMINDER', title: 'Trip in 4 weeks!', body: 'Your Kasol trek starts on June 5. Start packing!', sentAt: d(2026, 5, 5) },
    { userId: t2.id, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed!', body: 'Your booking for "Udaipur Royal Getaway" is confirmed.', sentAt: d(2026, 5, 3), readAt: d(2026, 5, 3) },
    { userId: t3.id, channel: 'IN_APP', type: 'TRIP_REQUEST_APPROVED', title: 'Request Approved!', body: 'Your request to join "Spiti Valley Circuit" has been approved!', sentAt: d(2026, 5, 1), readAt: d(2026, 5, 1) },
    { userId: t9.id, channel: 'IN_APP', type: 'PAYMENT_FAILED', title: 'Payment Failed', body: 'Your payment for Kasol trek failed. Please retry.', sentAt: d(2026, 5, 4) },
    { userId: org1User.id, channel: 'IN_APP', type: 'REVIEW_REQUEST', title: 'New Review!', body: 'Amit Kulkarni left a 5-star review for "Goa Beach Carnival".', sentAt: d(2026, 2, 1), readAt: d(2026, 2, 1) },
    { userId: org2User.id, channel: 'IN_APP', type: 'ORGANIZER_APPROVED', title: 'Profile Approved!', body: 'Your organizer profile has been approved. Start creating trips!', sentAt: d(2025, 6, 15), readAt: d(2025, 6, 15) },
    { userId: org5User.id, channel: 'IN_APP', type: 'SYSTEM_ALERT', title: 'Verification Pending', body: 'Your organizer application is under review. We will notify you within 48 hours.', sentAt: d(2026, 5, 5) },
    { userId: t1.id, channel: 'EMAIL', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmation', body: 'Your booking for Kasol trek is confirmed. Check your email for details.', sentAt: d(2026, 5, 2) },
    { userId: t1.id, channel: 'SMS', type: 'TRIP_REMINDER', title: 'Trip Reminder', body: 'Reminder: Kasol trek starts June 5 at 7 PM Delhi pickup!', sentAt: d(2026, 5, 5) },
    { userId: t3.id, channel: 'PUSH', type: 'CHAT_MESSAGE', title: 'New Message', body: 'Deepa from WanderOn replied about your Spiti query.', sentAt: d(2026, 5, 3) },
    { userId: admin.id, channel: 'IN_APP', type: 'SYSTEM_ALERT', title: 'New Organizer Application', body: 'Sahyadri Adventures Club submitted an organizer application.', sentAt: d(2026, 5, 5) },
    { userId: t7.id, channel: 'IN_APP', type: 'TRIP_REQUEST_RECEIVED', title: 'Request Submitted', body: 'Your request to join "Spiti Valley Circuit" is pending approval.', sentAt: d(2026, 5, 4) },
    { userId: org2User.id, channel: 'IN_APP', type: 'TRIP_REQUEST_RECEIVED', title: 'New Trip Request', body: 'Karan Singh has requested to join "Spiti Valley Circuit".', sentAt: d(2026, 5, 4) },
    { userId: t9.id, channel: 'IN_APP', type: 'CHAT_MESSAGE', title: 'Support Reply', body: 'Admin replied to your payment query.', sentAt: d(2026, 5, 6) },
    { userId: t5.id, channel: 'IN_APP', type: 'TRIP_REQUEST_RECEIVED', title: 'Request Submitted', body: 'Your request to join "Andaman Beach & Scuba Expedition" is pending.', sentAt: d(2026, 5, 6) },
  ] })
  console.log('  ✓ Created 16 notifications (all channels & types)')

  // ══════════════════════════════════════════════════════
  // ── WALLETS & TRANSACTIONS ────────────────────────────
  // ══════════════════════════════════════════════════════

  const allUserIds = [admin.id, org1User.id, org2User.id, org3User.id, org4User.id, org5User.id, org6User.id, ...travelers.map(t => t.id)]
  for (const uid of allUserIds) {
    await prisma.wallet.create({ data: { userId: uid, balance: 0 } })
  }

  // Amit wallet: refund + cashback
  const amitW = await prisma.wallet.findUnique({ where: { userId: t1.id } })
  if (amitW) {
    await prisma.walletTransaction.create({ data: { walletId: amitW.id, amount: 1500, type: 'REFUND', referenceModel: 'Booking', referenceId: bC1_1.id, description: 'Partial refund for Goa trip date change', balanceBefore: 0, balanceAfter: 1500 } })
    await prisma.walletTransaction.create({ data: { walletId: amitW.id, amount: 200, type: 'CASHBACK', referenceModel: 'Booking', referenceId: bC3_1.id, description: 'Cashback for Rishikesh Rafting booking', balanceBefore: 1500, balanceAfter: 1700 } })
    await prisma.walletTransaction.create({ data: { walletId: amitW.id, amount: 500, type: 'PROMOTIONAL_CREDIT', referenceModel: 'User', referenceId: t1.id, description: 'Welcome bonus credit', balanceBefore: 1700, balanceAfter: 2200 } })
    await prisma.walletTransaction.create({ data: { walletId: amitW.id, amount: 800, type: 'BOOKING_DEDUCTION', referenceModel: 'Booking', referenceId: bU1_1.id, description: 'Wallet used for Kasol trek booking', balanceBefore: 2200, balanceAfter: 1400 } })
    await prisma.wallet.update({ where: { id: amitW.id }, data: { balance: 1400 } })
  }

  // Sneha wallet: admin credit
  const snehaW = await prisma.wallet.findUnique({ where: { userId: t2.id } })
  if (snehaW) {
    await prisma.walletTransaction.create({ data: { walletId: snehaW.id, amount: 300, type: 'ADMIN_CREDIT', referenceModel: 'User', referenceId: t2.id, description: 'Compensation for delayed trip start on Goa trip', balanceBefore: 0, balanceAfter: 300 } })
    await prisma.wallet.update({ where: { id: snehaW.id }, data: { balance: 300 } })
  }

  // Pooja wallet: promo + expiry
  const poojaW = await prisma.wallet.findUnique({ where: { userId: t10.id } })
  if (poojaW) {
    await prisma.walletTransaction.create({ data: { walletId: poojaW.id, amount: 500, type: 'PROMOTIONAL_CREDIT', referenceModel: 'User', referenceId: t10.id, description: 'Referral bonus credit', balanceBefore: 0, balanceAfter: 500 } })
    await prisma.walletTransaction.create({ data: { walletId: poojaW.id, amount: 250, type: 'EXPIRY', referenceModel: 'WalletTransaction', referenceId: 'expired_promo_batch_001', description: 'Promotional credit expired after 90 days', balanceBefore: 500, balanceAfter: 250 } })
    await prisma.wallet.update({ where: { id: poojaW.id }, data: { balance: 250 } })
  }

  // Meera wallet: admin credit + debit
  const meeraW = await prisma.wallet.findUnique({ where: { userId: t8.id } })
  if (meeraW) {
    await prisma.walletTransaction.create({ data: { walletId: meeraW.id, amount: 1000, type: 'ADMIN_CREDIT', referenceModel: 'User', referenceId: t8.id, description: 'Compensation for trip disruption', balanceBefore: 0, balanceAfter: 1000 } })
    await prisma.walletTransaction.create({ data: { walletId: meeraW.id, amount: 400, type: 'ADMIN_DEBIT', referenceModel: 'User', referenceId: t8.id, description: 'Admin corrected over-credited amount', balanceBefore: 1000, balanceAfter: 600 } })
    await prisma.wallet.update({ where: { id: meeraW.id }, data: { balance: 600 } })
  }

  console.log('  ✓ Created 19 wallets + 10 wallet transactions (all 7 types)')
  console.log('     amit.kulkarni: ₹1,400 | sneha.deshmukh: ₹300 | pooja.agarwal: ₹250 | meera.bhat: ₹600')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

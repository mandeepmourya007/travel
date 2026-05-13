import { PrismaClient, Gender, NotificationType, Prisma, TransferPointType } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// Fixed date helper — not relative to "now"
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

// ── Per-record idempotent wrappers (additive re-runs) ─────
// Uses upsert (1 DB call) for models with unique constraints.
// Falls back to find+create for models without unique keys.
// New data added to the seed file is inserted; existing records are skipped.

type BookingCreateArgs = Parameters<typeof prisma.booking.create>[0]
async function safeBookingCreate(args: BookingCreateArgs) {
  const data = args.data as Prisma.BookingUncheckedCreateInput
  return prisma.booking.upsert({ where: { bookingRef: data.bookingRef }, update: {}, create: data })
}

type PaymentCreateArgs = Parameters<typeof prisma.paymentTransaction.create>[0]
async function safePaymentCreate(args: PaymentCreateArgs) {
  const data = args.data as Prisma.PaymentTransactionUncheckedCreateInput
  const found = data.bookingId ? await prisma.paymentTransaction.findFirst({ where: { bookingId: data.bookingId, type: data.type } }) : null
  return found ?? prisma.paymentTransaction.create(args)
}

type ReviewCreateArgs = Parameters<typeof prisma.review.create>[0]
async function safeReviewCreate(args: ReviewCreateArgs) {
  const data = args.data as Prisma.ReviewUncheckedCreateInput
  return prisma.review.upsert({ where: { bookingId: data.bookingId }, update: {}, create: data })
}

type TravelerCreateManyArgs = NonNullable<Parameters<typeof prisma.travelerDetail.createMany>[0]>
async function safeTravelerCreateMany(args: TravelerCreateManyArgs) {
  const rows = Array.isArray(args.data) ? args.data : [args.data]
  const bid = (rows[0] as Prisma.TravelerDetailUncheckedCreateInput).bookingId
  const count = bid ? await prisma.travelerDetail.count({ where: { bookingId: bid } }) : 0
  return count > 0 ? { count: 0 } : prisma.travelerDetail.createMany(args)
}

type TripRequestCreateArgs = Parameters<typeof prisma.tripRequest.create>[0]
async function safeTripRequestCreate(args: TripRequestCreateArgs) {
  const data = args.data as Prisma.TripRequestUncheckedCreateInput
  return prisma.tripRequest.upsert({
    where: { tripId_userId: { tripId: data.tripId, userId: data.userId } },
    update: {},
    create: data,
  })
}

type ConvCreateArgs = Parameters<typeof prisma.conversation.create>[0]
async function safeConvCreate(args: ConvCreateArgs) {
  const data = args.data as Prisma.ConversationUncheckedCreateInput
  const found = data.tripId
    ? await prisma.conversation.findFirst({ where: { tripId: data.tripId, travelerId: data.travelerId } })
    : data.type === 'ADMIN_SUPPORT'
      ? await prisma.conversation.findFirst({ where: { type: 'ADMIN_SUPPORT', travelerId: data.travelerId } })
      : null
  return found ?? prisma.conversation.create(args)
}

type MsgCreateManyArgs = NonNullable<Parameters<typeof prisma.message.createMany>[0]>
async function safeMsgCreateMany(args: MsgCreateManyArgs) {
  const rows = Array.isArray(args.data) ? args.data : [args.data]
  const cid = (rows[0] as Prisma.MessageUncheckedCreateInput).conversationId
  const count = cid ? await prisma.message.count({ where: { conversationId: cid } }) : 0
  return count >= rows.length ? { count: 0 } : prisma.message.createMany(args)
}

type NotifCreateManyArgs = NonNullable<Parameters<typeof prisma.notification.createMany>[0]>
async function safeNotifCreateMany(args: NotifCreateManyArgs) {
  const rows = Array.isArray(args.data) ? args.data : [args.data]
  const titles = rows.map(r => (r as Prisma.NotificationUncheckedCreateInput).title).filter(Boolean) as string[]
  const userId = (rows[0] as Prisma.NotificationUncheckedCreateInput).userId
  const count = userId && titles.length
    ? await prisma.notification.count({ where: { userId, title: { in: titles } } })
    : 0
  return count >= rows.length ? { count: 0 } : prisma.notification.createMany(args)
}

type WalletTxCreateArgs = Parameters<typeof prisma.walletTransaction.create>[0]
async function safeWalletTxCreate(args: WalletTxCreateArgs) {
  const data = args.data as Prisma.WalletTransactionUncheckedCreateInput
  const found = data.type && data.referenceModel && data.referenceId
    ? await prisma.walletTransaction.findFirst({ where: { type: data.type, referenceModel: data.referenceModel, referenceId: data.referenceId } })
    : null
  return found ?? prisma.walletTransaction.create(args)
}

type VehicleCreateArgs = Parameters<typeof prisma.tripVehicle.create>[0]
async function safeVehicleCreate(args: VehicleCreateArgs) {
  const data = args.data as Prisma.TripVehicleUncheckedCreateInput
  const found = data.tripId && data.label
    ? await prisma.tripVehicle.findFirst({ where: { tripId: data.tripId, label: data.label } })
    : null
  return found ?? prisma.tripVehicle.create(args)
}

type SeatCreateManyArgs = NonNullable<Parameters<typeof prisma.vehicleSeat.createMany>[0]>
async function safeSeatCreateMany(args: SeatCreateManyArgs) {
  return prisma.vehicleSeat.createMany({ ...args, skipDuplicates: true })
}

type CategoryCreateArgs = Parameters<typeof prisma.tripCategory.create>[0]
async function safeCategoryCreate(args: CategoryCreateArgs) {
  const data = args.data as Prisma.TripCategoryCreateInput
  return prisma.tripCategory.upsert({ where: { value: data.value }, update: {}, create: data })
}

type TypeReqCreateArgs = Parameters<typeof prisma.tripTypeRequest.create>[0]
async function safeTypeReqCreate(args: TypeReqCreateArgs) {
  const data = args.data as Prisma.TripTypeRequestUncheckedCreateInput
  const found = data.organizerId && data.suggestedName
    ? await prisma.tripTypeRequest.findFirst({ where: { organizerId: data.organizerId, suggestedName: data.suggestedName } })
    : null
  return found ?? prisma.tripTypeRequest.create(args)
}

type EditHistCreateArgs = Parameters<typeof prisma.tripEditHistory.create>[0]
async function safeEditHistCreate(args: EditHistCreateArgs) {
  const data = args.data as Prisma.TripEditHistoryUncheckedCreateInput
  const found = data.tripId && data.createdAt
    ? await prisma.tripEditHistory.findFirst({ where: { tripId: data.tripId, createdAt: data.createdAt } })
    : data.tripId && data.editNote
      ? await prisma.tripEditHistory.findFirst({ where: { tripId: data.tripId, editNote: data.editNote } })
      : null
  return found ?? prisma.tripEditHistory.create(args)
}

// ── Idempotent upsert helpers ─────────────────────────────

async function upsertUser(email: string, data: Omit<Prisma.UserCreateInput, 'email'>) {
  return prisma.user.upsert({
    where: { email },
    create: { email, ...data },
    update: { name: data.name, phone: data.phone, role: data.role, avatarUrl: data.avatarUrl },
  })
}

async function upsertDestination(slug: string, data: Omit<Prisma.DestinationCreateInput, 'slug'>) {
  return prisma.destination.upsert({
    where: { slug },
    create: { slug, ...data },
    update: { name: data.name, state: data.state, photoUrl: data.photoUrl, description: data.description, isPopular: data.isPopular },
  })
}

async function upsertOrgProfile(userId: string, data: Omit<Prisma.OrganizerProfileCreateInput, 'user'>) {
  return prisma.organizerProfile.upsert({
    where: { userId },
    create: { user: { connect: { id: userId } }, ...data },
    update: { businessName: data.businessName, slug: data.slug, description: data.description, commissionRate: data.commissionRate, razorpayAccountId: data.razorpayAccountId },
  })
}

async function upsertTrip(
  slug: string,
  data: Omit<Prisma.TripCreateInput, 'slug' | 'organizer' | 'destination' | 'transferPoints'> & { organizerId: string; destinationId: string },
  transferPoints?: { type: TransferPointType; label: string; address?: string; time?: string; extraCharge?: number; sortOrder: number }[],
) {
  const { organizerId, destinationId, ...rest } = data
  const trip = await prisma.trip.upsert({
    where: { slug },
    create: {
      slug,
      organizer: { connect: { id: organizerId } },
      destination: { connect: { id: destinationId } },
      ...rest,
    },
    update: {
      title: rest.title, description: rest.description, tripType: rest.tripType,
      bookingMode: rest.bookingMode, startDate: rest.startDate, endDate: rest.endDate,
      pricePerPerson: rest.pricePerPerson, earlyBirdPrice: rest.earlyBirdPrice,
      earlyBirdDeadline: rest.earlyBirdDeadline, minGroupSize: rest.minGroupSize,
      maxGroupSize: rest.maxGroupSize, inclusions: rest.inclusions, exclusions: rest.exclusions,
      cancellationPolicy: rest.cancellationPolicy, photos: rest.photos, itinerary: rest.itinerary,
    },
  })

  if (transferPoints && transferPoints.length > 0) {
    const existing = await prisma.tripTransferPoint.findMany({ where: { tripId: trip.id } })
    for (const tp of transferPoints) {
      const match = existing.find(e => e.type === tp.type && e.label === tp.label)
      if (match) {
        await prisma.tripTransferPoint.update({ where: { id: match.id }, data: { address: tp.address, time: tp.time, extraCharge: tp.extraCharge, sortOrder: tp.sortOrder } })
      } else {
        await prisma.tripTransferPoint.create({ data: { tripId: trip.id, ...tp } })
      }
    }
  }

  return trip
}

async function main() {
  console.log('🌱 Seeding PRODUCTION database...\n')

  // ── Idempotent seed — no deleteMany, upserts + guards ──

  const passwordHash = await bcrypt.hash('Test@1234', 12)

  // ══════════════════════════════════════════════════════
  // ── USERS ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════

  const admin = await upsertUser('mandeep@safarnama.in', { name: 'Mandeep Mourya', passwordHash, role: 'ADMIN', emailVerified: true, phoneVerified: true, phone: '+919876000001', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=MM' })
  await upsertUser('admin@safarnama.in', { name: 'Admin', passwordHash, role: 'ADMIN', emailVerified: true, phoneVerified: true, phone: '+919876000002', avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AD' })

  const org1User = await upsertUser('rajesh@desiexplorers.in', { name: 'Rajesh Khanna', passwordHash, role: 'ORGANIZER', phone: '+919820145678', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=RK' })
  const org2User = await upsertUser('deepa@summitshore.in', { name: 'Deepa Nair', passwordHash, role: 'ORGANIZER', phone: '+919845098765', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=DN' })
  const org3User = await upsertUser('arjun@nomadtrails.in', { name: 'Arjun Mehta', passwordHash, role: 'ORGANIZER', phone: '+919871023456', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AM' })
  const org4User = await upsertUser('priya@backpackbharat.com', { name: 'Priya Sharma', passwordHash, role: 'ORGANIZER', phone: '+919890123400', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=PS' })
  const org5User = await upsertUser('vikram@sahyadriadventures.com', { name: 'Vikram Desai', passwordHash, role: 'ORGANIZER', phone: '+919823456700', emailVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=VD' })
  const org6User = await upsertUser('neha@budgettrails.in', { name: 'Neha Gupta', passwordHash, role: 'ORGANIZER', phone: '+919812345600', emailVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=NG' })
  const org7User = await upsertUser('kavya@shetravelsindia.com', { name: 'Kavya Nair', passwordHash, role: 'ORGANIZER', phone: '+919845671230', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=KN' })
  const org8User = await upsertUser('rahul@corporateescapes.in', { name: 'Rahul Kapoor', passwordHash, role: 'ORGANIZER', phone: '+919867453210', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=RK' })

  // 12 Travelers
  const t1 = await upsertUser('amit.kulkarni@gmail.com', { name: 'Amit Kulkarni', passwordHash, role: 'TRAVELER', phone: '+919876543210', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AK' })
  const t2 = await upsertUser('sneha.deshmukh@gmail.com', { name: 'Sneha Deshmukh', passwordHash, role: 'TRAVELER', phone: '+919876543211', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=SD' })
  const t3 = await upsertUser('rohan.joshi@gmail.com', { name: 'Rohan Joshi', passwordHash, role: 'TRAVELER', phone: '+919876543212', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=RJ' })
  const t4 = await upsertUser('kavita.reddy@gmail.com', { name: 'Kavita Reddy', passwordHash, role: 'TRAVELER', phone: '+919876543213', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=KR' })
  const t5 = await upsertUser('saurabh.patil@gmail.com', { name: 'Saurabh Patil', passwordHash, role: 'TRAVELER', phone: '+919876543214', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=SP' })
  const t6 = await upsertUser('ananya.iyer@gmail.com', { name: 'Ananya Iyer', passwordHash, role: 'TRAVELER', phone: '+919876543215', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=AI' })
  const t7 = await upsertUser('karan.singh@gmail.com', { name: 'Karan Singh', passwordHash, role: 'TRAVELER', phone: '+919876543216', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=KS' })
  const t8 = await upsertUser('meera.bhat@gmail.com', { name: 'Meera Bhat', passwordHash, role: 'TRAVELER', phone: '+919876543217', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=MB' })
  const t9 = await upsertUser('nikhil.verma@gmail.com', { name: 'Nikhil Verma', passwordHash, role: 'TRAVELER', phone: '+919876543218', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=NV' })
  const t10 = await upsertUser('pooja.agarwal@gmail.com', { name: 'Pooja Agarwal', passwordHash, role: 'TRAVELER', phone: '+919876543219', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=PA' })
  const t11 = await upsertUser('rahul.tiwari@gmail.com', { name: 'Rahul Tiwari', passwordHash, role: 'TRAVELER', phone: '+919876543220', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=RT' })
  const t12 = await upsertUser('divya.menon@gmail.com', { name: 'Divya Menon', passwordHash, role: 'TRAVELER', phone: '+919876543221', emailVerified: true, phoneVerified: true, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=DM' })

  // 38 additional travelers for realistic variety (total 50)
  const EXTRA_TRAVELER_NAMES = [
    'Vikram Rathore', 'Shreya Kapoor', 'Arjun Nair', 'Priyanka Desai', 'Aakash Malhotra',
    'Neha Joshi', 'Sahil Khanna', 'Tanisha Rao', 'Kunal Bhatt', 'Aditi Singh',
    'Manish Tiwari', 'Roshni Pillai', 'Yash Chauhan', 'Megha Shetty', 'Deepak Rawat',
    'Simran Kaur', 'Varun Saxena', 'Nikita Mishra', 'Gaurav Pandey', 'Swati Deshpande',
    'Harsh Vyas', 'Anjali Krishnan', 'Tarun Oberoi', 'Pallavi Hegde', 'Siddharth Mehra',
    'Bhavna Chawla', 'Rajat Arora', 'Isha Banerjee', 'Mohit Gambhir', 'Sonali Sinha',
    'Akshay Thakur', 'Ritika Mahajan', 'Pranav Goyal', 'Karishma Bajaj', 'Dhruv Sethi',
    'Nisha Rastogi', 'Kartik Bhandari', 'Aparna Sundaram',
  ]
  const extraTravelers: { id: string }[] = []
  for (let i = 0; i < EXTRA_TRAVELER_NAMES.length; i++) {
    const name = EXTRA_TRAVELER_NAMES[i]
    const slug = name.toLowerCase().replace(' ', '.')
    const initials = name.split(' ').map(n => n[0]).join('')
    const t = await upsertUser(`${slug}@gmail.com`, {
      name, passwordHash, role: 'TRAVELER',
      phone: `+9198765${String(43222 + i).padStart(5, '0')}`,
      emailVerified: true, phoneVerified: i % 3 === 0,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${initials}`,
    })
    extraTravelers.push(t)
  }
  const allTravelers = [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, ...extraTravelers]
  console.log(`  ✓ Created ${10 + allTravelers.length} users (2 admins, 8 organizers, ${allTravelers.length} travelers)`)

  // ══════════════════════════════════════════════════════
  // ── ORGANIZER PROFILES ────────────────────────────────
  // ══════════════════════════════════════════════════════

  const org1 = await upsertOrgProfile(org1User.id, { businessName: 'Desi Explorers', slug: 'desi-explorers', description: 'India\'s #1 rated group travel community for young travelers — trusted by 15,000+ explorers (mostly 20s-30s) since 2018. Curated group trips from Pune and Mumbai to 40+ destinations: Goa beach parties, Himalayan adventure treks, Rajasthan heritage tours, and Andaman island getaways. Travel solo, leave with a squad — our groups are designed for people in their 20s and 30s who want to meet like-minded travelers. IATO certified, travel insurance included, all-inclusive packages. Perfect for your first salary trip, couples getaway, college reunion, or solo adventure.', verificationStatus: 'APPROVED', rating: 4.7, totalReviews: 86, totalTripsCompleted: 62, bankAccountLinked: true, commissionRate: 10.0, razorpayAccountId: 'acc_HjVXtlV9LdABJ0' })
  const org2 = await upsertOrgProfile(org2User.id, { businessName: 'Summit & Shore Travels', slug: 'summit-shore-travels', description: 'Bangalore\'s favourite group travel company for young professionals, techies, and solo travelers in their 20s. Curated weekend getaways from Bangalore to Coorg, Hampi, and Gokarna \u2014 perfect Friday-to-Monday escapes. Pan-India adventure trips to Ladakh, Spiti, Meghalaya, and Andaman. Small groups (max 18) where you actually make real friends, not just travel buddies. 5+ years, 10,000+ travelers. Highest safety rating for solo female travelers. Come alone, leave with your new travel squad.', verificationStatus: 'APPROVED', rating: 4.5, totalReviews: 54, totalTripsCompleted: 38, bankAccountLinked: true, commissionRate: 10.0, razorpayAccountId: 'acc_Kp3mNqR8WsYZ2x' })
  const org3 = await upsertOrgProfile(org3User.id, { businessName: 'Nomad Trails India', slug: 'nomad-trails-india', description: 'Handcrafted cultural experiences that make your Instagram pop — Rajasthan palace walks, Jaipur food trails, Varanasi spiritual journeys, Meghalaya root bridge treks, and Hampi archaeology expeditions. Think beyond basic tourist spots: we take you to the real India with expert local guides, boutique stays, and authentic street food crawls. 5+ years, 8,000+ travelers (mostly Gen Z and young couples). Group tour packages from Delhi, Mumbai, and Bangalore for curious minds, photographers, and anyone who wants travel that goes deeper than surface level.', verificationStatus: 'APPROVED', rating: 4.4, totalReviews: 42, totalTripsCompleted: 28, bankAccountLinked: true, commissionRate: 10.0, razorpayAccountId: 'acc_Tn7vBcD4FgHJ1k' })
  const org4 = await upsertOrgProfile(org4User.id, { businessName: 'Backpack Bharat', slug: 'backpack-bharat', description: 'India\'s top-rated budget group travel brand — epic adventures under ₹10,000 that won\'t break a student budget. Weekend treks near Pune, budget Goa trips under ₹5,000, Rishikesh rafting from Delhi (₹2,999!), and Coorg getaways from Bangalore. Hostel vibes, local street food, bonfire nights, and maximum adventure at minimum cost. Built for college students spending their first pocket money on travel, freshers celebrating their first salary, and anyone who believes epic experiences don\'t need a fat wallet. Age group: mostly 18-28.', verificationStatus: 'APPROVED', rating: 4.3, totalReviews: 38, totalTripsCompleted: 24, bankAccountLinked: true, commissionRate: 10.0, razorpayAccountId: 'acc_Lm9wXeF2QrST5n' })
  await upsertOrgProfile(org5User.id, { businessName: 'Sahyadri Adventures Club', slug: 'sahyadri-adventures-club', description: 'Pune\'s premier Western Ghats trekking and camping community. Weekend monsoon treks to Rajmachi Fort, Harishchandragad, Kalsubai Peak, and Sahyadri ridge walks. Pawna Lake camping and Lonavala fort circuits every weekend. Certified mountaineering guides with wilderness first-aid training.', verificationStatus: 'PENDING', rating: 0, totalReviews: 0, totalTripsCompleted: 0, bankAccountLinked: false, commissionRate: 10.0 })
  await upsertOrgProfile(org6User.id, { businessName: 'Budget Trails India', slug: 'budget-trails-india', description: 'Student-focused budget travel packages across India — college trip specials to Goa, Manali, and Rishikesh starting at ₹2,999 per person. Group discounts for 10+ students with hostel stays and adventure activities included.', verificationStatus: 'REJECTED', rating: 0, totalReviews: 0, totalTripsCompleted: 0, bankAccountLinked: false, commissionRate: 10.0 })
  const org7 = await upsertOrgProfile(org7User.id, { businessName: 'She Travels India', slug: 'she-travels-india', description: 'India\'s first women-only group travel company — safe, empowering, and Instagram-worthy trips designed exclusively for women in their 20s and 30s. Solo female travel packages to Ladakh, Rajasthan, Kerala, Meghalaya, and Goa. Women-led guides, women-only stays, and experiences curated by women for women. 3+ years, 4,000+ happy travelers. Come solo, leave with a girl gang. Perfect for your first solo trip, bestie getaway, bachelorette trip, or just because you deserve an adventure. 24/7 safety support — your parents can relax.', verificationStatus: 'APPROVED', rating: 4.8, totalReviews: 32, totalTripsCompleted: 18, bankAccountLinked: true, commissionRate: 10.0, razorpayAccountId: 'acc_Wx5yKnL7PqRS9m' })
  const org8 = await upsertOrgProfile(org8User.id, { businessName: 'Corporate Escapes India', slug: 'corporate-escapes-india', description: 'India\'s go-to corporate offsite and team building travel company \u2014 because your startup team deserves better than another Zoom call. Curated team outing packages from Pune, Mumbai, Delhi, and Bangalore to Goa, Coorg, Lonavala, Rishikesh, and Udaipur. Adventure-first team building, NOT boring conference rooms. Trusted by 50+ startups and tech companies. Custom itineraries for 10-100 people, GST invoicing, and dedicated event managers. Average team age on our trips: 26.', verificationStatus: 'APPROVED', rating: 4.6, totalReviews: 28, totalTripsCompleted: 22, bankAccountLinked: true, commissionRate: 8.0, razorpayAccountId: 'acc_Yz8tBmH3NqFW4k' })
  console.log('  ✓ Created 8 organizer profiles (6 APPROVED, 1 PENDING, 1 REJECTED)')

  // ══════════════════════════════════════════════════════
  // ── DESTINATIONS ──────────────────────────────────────
  // ══════════════════════════════════════════════════════

  const goa = await upsertDestination('goa', { name: 'Goa', state: 'Goa', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1652820330085-82a0c2b88d78?w=800', description: 'India\'s #1 party and beach destination — every college student\'s first trip and every young couple\'s favourite escape. North Goa buzzes with beach parties at Baga, Anjuna flea market, and Calangute nightlife. South Goa offers Instagram-worthy shores at Palolem, Agonda, and Cola Beach. Dudhsagar waterfalls, Fontainhas Latin Quarter, and water sports galore. The vibe is unmatched: sunsets, bonfires, new friends, and memories that become your best stories. Group trip packages from Pune (6 hrs), Mumbai (10 hrs), and Bangalore starting at ₹3,999. Best time: October to March.' })
  const manali = await upsertDestination('manali', { name: 'Manali', state: 'Himachal Pradesh', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1692719058797-2954b100c8fe?w=800', description: 'Every young Indian\'s dream destination — snow-capped peaks, Solang Valley paragliding that\'ll make your reels go viral, and Old Manali cafe culture that feels like a different country. River rafting on the Beas, Atal Tunnel road trips, Vashisht hot springs after a cold trek, and cherry blossom season (Mar-Apr) for couples. The Volvo night bus from Delhi is practically a rite of passage for every 20-something. Group trip packages from Delhi (12 hrs) starting at ₹6,999. Best time: year-round.' })
  const ladakh = await upsertDestination('ladakh', { name: 'Ladakh', state: 'Ladakh', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1593118845043-359e5f628214?w=800', description: 'The ultimate bucket-list road trip for every young Indian — if you haven\'t dreamed of biking Manali to Leh, are you even in your 20s? Dramatic lunar landscapes, the iconic Pangong Tso lake (3 Idiots fame), Nubra Valley sand dunes, Khardung La selfie at 18,380 ft, and ancient Buddhist monasteries. Whether you ride a Royal Enfield or go by SUV, this trip changes you. Group packages starting at ₹14,999 with bike rental options. Best time: June to September.' })
  const rishikesh = await upsertDestination('rishikesh', { name: 'Rishikesh', state: 'Uttarakhand', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1718431108073-7f61fb5dfefb?w=800', description: 'The adrenaline capital of India and the cheapest adventure trip from Delhi (just 5 hrs!). 16 km white-water rafting for ₹2,999, India\'s highest bungee jump (83m at Jumpin Heights), cliff jumping into the Ganges, and riverside camping with bonfire nights. Also the yoga capital of the world with ashrams and the mesmerizing Ganga Aarti. The ultimate weekend escape for college students, young couples, and friend groups. Most bookings are 20-30 year olds travelling in groups of 4-8. Best time: September to June.' })
  const jaipur = await upsertDestination('jaipur', { name: 'Jaipur', state: 'Rajasthan', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1595280769531-a25c4c76116a?w=800', description: 'The Pink City of Rajasthan — a royal blend of UNESCO-worthy forts, vibrant bazaars, and legendary Rajasthani cuisine. Explore Amber Fort by elephant ride, photograph Hawa Mahal\'s honeycomb facade, shop at Johari Bazaar, and savour dal baati churma at Chokhi Dhani. Hot-air balloon rides, block printing workshops, and camel safaris. Heritage trip packages from Delhi (5 hrs) starting at ₹5,999. Best time to visit: October to March.' })
  const kasol = await upsertDestination('kasol', { name: 'Kasol', state: 'Himachal Pradesh', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1673815994546-9913f4d76b77?w=800', description: 'India\'s backpacker capital and Gen Z\'s favourite mountain escape — if you know, you know. Pine forest treks to Kheerganga hot springs (12 km), riverside Israeli cafes where time stops, Tosh village camping with mountain views, and the legendary Malana trail. The vibe is unmatched: cheap stays, great food, bonfire jam sessions, and strangers who become friends. Budget trip packages from Delhi starting at ₹3,999. Best time: March to June and September to November.' })
  const udaipur = await upsertDestination('udaipur', { name: 'Udaipur', state: 'Rajasthan', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1622018135960-249abd263aeb?w=800', description: 'India\'s most romantic city and the #1 couples destination — floating lake palaces, sunset boat rides on Lake Pichola that make your partner fall in love all over again, the majestic City Palace, and old-world Rajasthani charm. Perfect for anniversary trips, pre-wedding photoshoots, and young couples who want luxury without burning their savings. Nearby Kumbhalgarh Fort and Mount Abu hill station. Group trip packages starting at ₹8,499. Best time: September to March.' })
  const meghalaya = await upsertDestination('meghalaya', { name: 'Meghalaya', state: 'Meghalaya', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1552978534-9d01e1f91517?w=800', description: 'The offbeat flex every young traveler wants on their feed — double-decker living root bridges (3,500-step trek), the crystal-clear Dawki river where boats look like they\'re floating in air (yes, that viral reel is real), Asia\'s cleanest village Mawlynnong, and Shillong\'s Scotland-like cafe culture. If you\'ve done Goa and Manali and want something different, Meghalaya is your answer. Group adventure packages from Guwahati starting at ₹11,999. Best time: October to May.' })
  const hampi = await upsertDestination('hampi', { name: 'Hampi', state: 'Karnataka', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1696239105346-4e48185eb001?w=800', description: 'India\'s most Instagrammable ruins and the ultimate backpacker flex — surreal boulder landscapes, 500-year-old Vijayanagara Empire ruins, Hippie Island cafe culture (the vibe is *chef\'s kiss*), coracle rides on the Tungabhadra, and Matanga Hill sunrise that\'ll blow your mind. World-class bouldering, the iconic Stone Chariot, and nights spent in riverside cafes with people from around the world. Budget backpacker packages from Bangalore (6 hrs) starting at ₹2,999. Popular with college students and young creatives. Best time: October to February.' })
  const lonavala = await upsertDestination('lonavala', { name: 'Lonavala', state: 'Maharashtra', isPopular: true, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1621578847110-61f6cf5a3d9e?w=800', description: 'The go-to weekend escape for Pune and Mumbai youngsters — literally 1.5 hrs from Pune! Pawna Lake camping with bonfire, guitars, and stargazing is basically a rite of passage for every college student. Monsoon waterfalls at Bhushi Dam, fort treks (Rajmachi, Lohagad, Tikona), waterfall rappelling, and firefly treks in June that look straight out of a fairy tale. Weekend packages starting at ₹999 — the cheapest adventure you can have. Best time for monsoon treks: June to September.' })
  const spiti = await upsertDestination('spiti-valley', { name: 'Spiti Valley', state: 'Himachal Pradesh', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1709907153050-a668b4473c47?w=800', description: 'India\'s cold desert mountain valley and the ultimate high-altitude road trip — stark lunar landscapes, 1,000-year-old Key and Tabo monasteries, the world\'s highest post office at Hikkim (4,400m), and the pristine Chandratal Moon Lake. Spiti circuit from Manali to Shimla via Kunzum La and Kinnaur Valley. Winter snow leopard tracking in Kibber. Group expedition packages starting at ₹14,999. Best time: June to October (roads open).' })
  const coorg = await upsertDestination('coorg', { name: 'Coorg', state: 'Karnataka', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1699819551081-48095fe86265?w=800', description: 'The Scotland of India and Karnataka\'s coffee country paradise — misty hills with 200-year-old coffee plantations, Abbey Falls, Dubare Elephant Camp, and the Namdroling Tibetan Golden Temple. Summit Tadiandamol (1,748m), Coorg\'s highest peak. Barapole river rafting (Grade III) in monsoon and authentic Kodava cuisine. Perfect weekend escape from Bangalore (5 hrs). Plantation homestay packages starting at ₹3,499. Best time to visit: October to March.' })
  const varanasi = await upsertDestination('varanasi', { name: 'Varanasi', state: 'Uttar Pradesh', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1665413793441-13aedeb062d3?w=800', description: 'One of the world\'s oldest continuously inhabited cities and India\'s spiritual capital. The legendary Ganga Aarti at Dashashwamedh Ghat, sunrise boat rides on the Ganges, 2,000-year-old temples, silk weaving heritage, and iconic street food trails through Kachori Gali. Visit Sarnath where Buddha gave his first sermon. The Dev Deepawali festival lights up every ghat with a million diyas. Spiritual and cultural packages starting at ₹5,499.' })
  const andaman = await upsertDestination('andaman', { name: 'Andaman Islands', state: 'Andaman & Nicobar', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1586359716568-3e1907e4cf9f?w=800', description: 'India\'s tropical island paradise in the Bay of Bengal — turquoise crystal-clear waters, pristine white-sand beaches, and Asia\'s best scuba diving. Havelock Island\'s Radhanagar Beach (rated Asia\'s best), Elephant Beach snorkeling, bioluminescent kayaking at night, and PADI certification courses. Neil Island cycling, Cellular Jail heritage, and glass-bottom boat coral viewing. Honeymoon packages, scuba courses, and island-hopping trips starting at ₹14,499. Best time: November to May.' })
  const dharamshala = await upsertDestination('dharamshala', { name: 'Dharamshala', state: 'Himachal Pradesh', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1581321863389-ef7d7bfe4b75?w=800', description: 'McLeod Ganj — the backpacker and digital nomad hub of Himachal. Tibetan momos that change your life, Triund trek with Dhauladhar mountain views (one of India\'s most Instagrammed treks), Bhagsunag waterfall chill sessions, and cafe-hopping in McLeod Ganj\'s narrow lanes. Home of the Dalai Lama with spiritual monastery visits and mountain yoga. Perfect for solo travelers, couples, and anyone who needs a mountain recharge. Weekend trip packages from Delhi (10 hrs) starting at ₹4,999. Best time: March to June and September to November.' })
  const ooty = await upsertDestination('ooty', { name: 'Ooty', state: 'Tamil Nadu', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1638886540342-240980f60d25?w=800', description: 'South India\'s favourite hill station and the go-to romantic escape for Bangalore couples — ride the UNESCO toy train through misty mountains, walk through Coonoor tea plantations, catch sunrise at Doddabetta Peak, and cozy up in colonial-era cafes. Ooty Lake boating, Pykara waterfalls, and Mudumalai Tiger Reserve safari. Just 5 hrs from Bangalore — perfect for a long weekend with your partner or friend group. Hill station packages starting at ₹4,499. Best time: October to June.' })
  const rannOfKutch = await upsertDestination('rann-of-kutch', { name: 'Rann of Kutch', state: 'Gujarat', isPopular: false, tripCount: 0, photoUrl: 'https://images.unsplash.com/photo-1670923331633-be262e035a9a?w=800', description: 'India\'s surreal white salt desert — the Great Rann of Kutch stretches endlessly under full moon nights. Experience the vibrant Rann Utsav cultural festival (Nov-Feb), Kutchi handicraft villages, Banni grasslands wildlife, Dholavira archaeological site (Indus Valley Civilization), and the India-Pakistan border viewpoint at Kala Dungar. One of the most unique landscapes on Earth. Festival packages from Ahmedabad starting at ₹6,999. Best time: November to February.' })
  console.log('  ✓ Created 17 destinations')

  // ══════════════════════════════════════════════════════
  // ── COMPLETED TRIPS (before April 2026) ───────────────
  // ══════════════════════════════════════════════════════

  const completedTrips = await seedCompletedTrips({ org1, org2, org3, org4, goa, manali, ladakh, rishikesh, jaipur, hampi, lonavala, meghalaya })

  // ══════════════════════════════════════════════════════
  // ── UPCOMING TRIPS (June 2026+, ₹9K-15K) ─────────────
  // ══════════════════════════════════════════════════════

  const upcomingTrips = await seedUpcomingTrips({ org1, org2, org3, org4, kasol, spiti, udaipur, coorg, varanasi, andaman, goa, lonavala, manali, ladakh, rishikesh, jaipur })

  // ══════════════════════════════════════════════════════
  // ── BOOKINGS, PAYMENTS, REVIEWS ───────────────────────
  // ══════════════════════════════════════════════════════

  await seedBookingsAndReviews({ completedTrips, upcomingTrips, travelers: [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12], org1User, org2User, org3User, org4User, org5User, org6User, org1, org2, org3, org4, admin })

  // ══════════════════════════════════════════════════════
  // ── BULK TRIPS (for realistic platform look) ──────────
  // ══════════════════════════════════════════════════════

  await seedBulkTrips({ org1, org2, org3, org4, org7, org8, goa, manali, ladakh, rishikesh, jaipur, kasol, lonavala, udaipur, meghalaya, hampi, spiti, coorg, varanasi, andaman, dharamshala, ooty, rannOfKutch }, allTravelers)

  await seedBulkReviews(allTravelers)

  await seedBulkBookingsAndPayments(allTravelers)

  // ══════════════════════════════════════════════════════
  // ── VEHICLE LAYOUTS, NOTIFICATIONS, CATEGORIES ────────
  // ══════════════════════════════════════════════════════

  const seedSections: { name: string; fn: () => Promise<void> }[] = [
    { name: 'Vehicle Layouts', fn: () => seedVehicleLayouts({
      tripU2: upcomingTrips.tripU2, tripU7: upcomingTrips.tripU7,
      tripU9: upcomingTrips.tripU9, tripU11: upcomingTrips.tripU11,
      tripU12: upcomingTrips.tripU12,
    }) },
    { name: 'Notifications', fn: () => seedNotifications(admin.id, org1User.id, t1.id) },
    { name: 'Trip Categories & Requests', fn: () => seedTripCategoriesAndRequests({
      org1, org2, org3, org4, org7, org8,
      org1User, org2User, org3User, org4User, org7User, org8User,
      completedTrips, upcomingTrips,
    }) },
  ]

  for (const section of seedSections) {
    try {
      await section.fn()
    } catch (e) {
      console.error(`  ⚠ ${section.name} failed (non-fatal):`, e instanceof Error ? e.message : e)
    }
  }

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
  console.log('  🔐 All accounts use password: Test@1234')
  console.log('  📧 Admin:      admin@safarnama.in')
  console.log('  📧 Organizers:  rajesh@desiexplorers.in, deepa@summitshore.in, arjun@nomadtrails.in, priya@backpackbharat.com')
  console.log('  📧 Pending:     vikram@sahyadriadventures.com')
  console.log('  📧 Rejected:    neha@budgettrails.in')
  console.log('  📧 Travelers:   amit.kulkarni@gmail.com, sneha.deshmukh@gmail.com, rohan.joshi@gmail.com ...')
}

// ══════════════════════════════════════════════════════════
// ── COMPLETED TRIPS FUNCTION ────────────────────────────
// ══════════════════════════════════════════════════════════

async function seedCompletedTrips(deps: Record<string, { id: string }>) {
  const { org1, org2, org3, org4, goa, manali, ladakh, rishikesh, jaipur, hampi, lonavala, meghalaya } = deps

  const tripC1 = await upsertTrip('goa-beach-carnival-jan-2026', {
      organizerId: org1.id, destinationId: goa.id,
      title: 'Goa Beach Carnival — 3N/4D Fun Escape',
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
      photos: ['https://images.unsplash.com/photo-1698430184854-17aa542d247c?w=800', 'https://images.unsplash.com/photo-1558894930-0e1f89b9f0ce?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
    }, [
      { type: 'PICKUP', label: 'Pune — Shivaji Nagar Bus Stand', address: 'Shivaji Nagar Bus Depot, Pune 411005', time: '8:00 PM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Pune — Wakad Bridge', address: 'Near Wakad Bridge, Hinjewadi Road', time: '8:45 PM', sortOrder: 1 },
    ])

  const tripC2 = await upsertTrip('manali-snow-adventure-feb-2026', {
      organizerId: org2.id, destinationId: manali.id,
      title: 'Manali Snow Adventure — 4N/5D Winter Special',
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
      photos: ['https://images.unsplash.com/photo-1616942986550-ea6469c08530?w=800', 'https://images.unsplash.com/photo-1618500508371-d0158e696eb0?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
    }, [
      { type: 'PICKUP', label: 'Delhi — Kashmere Gate ISBT', address: 'ISBT Kashmere Gate', time: '6:00 PM', sortOrder: 0 },
    ])

  const tripC3 = await upsertTrip('rishikesh-rafting-camping-feb-2026', {
      organizerId: org1.id, destinationId: rishikesh.id,
      title: 'Rishikesh White Water Rafting & Camping Weekend',
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
      photos: ['https://images.unsplash.com/photo-1718383537744-13289af20e12?w=800', 'https://images.unsplash.com/photo-1653282768163-04a56f9c0d46?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
    }, [
      { type: 'PICKUP', label: 'Delhi — Kashmere Gate ISBT', time: '5:30 AM', sortOrder: 0 },
    ])

  const tripC4 = await upsertTrip('jaipur-heritage-experience-mar-2026', {
      organizerId: org3.id, destinationId: jaipur.id,
      title: 'Jaipur Royal Heritage Experience — 2N/3D',
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
      photos: ['https://images.unsplash.com/photo-1629890030060-80703e074e7e?w=800', 'https://images.unsplash.com/photo-1650450888332-a76185277321?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
    }, [
      { type: 'PICKUP', label: 'Jaipur Junction Railway Station', time: '9:30 AM', sortOrder: 0 },
      { type: 'DROP', label: 'Jaipur Junction Railway Station', time: '3:00 PM', sortOrder: 1 },
    ])

  const tripC5 = await upsertTrip('ladakh-bike-expedition-aug-2025', {
      organizerId: org2.id, destinationId: ladakh.id,
      title: 'Ladakh Bike Expedition — Manali to Leh 8N/9D',
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
      photos: ['https://images.unsplash.com/photo-1633259422382-5ead30efb697?w=800', 'https://images.unsplash.com/photo-1648851460314-ba293ba2cdcf?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
  })

  const tripC6 = await upsertTrip('hampi-ruins-culture-walk-jan-2026', {
      organizerId: org3.id, destinationId: hampi.id,
      title: 'Hampi Ruins & Culture Walk — 2N/3D',
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
      photos: ['https://images.unsplash.com/photo-1696239118208-e3bacef45a63?w=800', 'https://images.unsplash.com/photo-1695981202846-7150a1adc0d8?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
  })

  const tripC7 = await upsertTrip('rajmachi-fort-monsoon-trek-sep-2025', {
      organizerId: org4.id, destinationId: lonavala.id,
      title: 'Rajmachi Fort Monsoon Trek — 1N/2D',
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
    }, [
      { type: 'PICKUP', label: 'Pune — Wakad Bridge', time: '5:30 AM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Pune — Chandni Chowk', time: '6:00 AM', sortOrder: 1 },
    ])

  const tripC8 = await upsertTrip('meghalaya-living-root-bridges-mar-2026', {
      organizerId: org2.id, destinationId: meghalaya.id,
      title: 'Meghalaya — Caves, Waterfalls & Living Root Bridges 5N/6D',
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
      photos: ['https://images.unsplash.com/photo-1689089526066-c7e6e95ee265?w=800', 'https://images.unsplash.com/photo-1629465659213-d28388bc05ff?w=800'],
      status: 'COMPLETED', acceptingBookings: false,
  })

  console.log('  ✓ Created 8 completed trips (before April 2026)')
  return { tripC1, tripC2, tripC3, tripC4, tripC5, tripC6, tripC7, tripC8 }
}

// ══════════════════════════════════════════════════════════
// ── UPCOMING TRIPS FUNCTION ─────────────────────────────
// ══════════════════════════════════════════════════════════

async function seedUpcomingTrips(deps: Record<string, { id: string }>) {
  const { org1, org2, org3, org4, kasol, spiti, udaipur, coorg, varanasi, andaman, goa, lonavala, manali, ladakh, rishikesh, jaipur } = deps

  const tripU1 = await upsertTrip('kasol-kheerganga-trek-jun-2026', {
      organizerId: org1.id, destinationId: kasol.id,
      title: 'Kasol & Kheerganga Trek — 3N/4D Backpacker Special',
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
      photos: ['https://images.unsplash.com/photo-1681176323164-bd4eeb724b81?w=800', 'https://images.unsplash.com/photo-1644008114609-2c8a09b26841?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    }, [
      { type: 'PICKUP', label: 'Delhi — Majnu Ka Tila', address: 'Majnu Ka Tila Gurudwara', time: '7:00 PM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Delhi — Kashmere Gate ISBT', time: '8:00 PM', sortOrder: 1 },
      { type: 'PICKUP', label: 'Chandigarh — Sector 43 ISBT', time: '11:30 PM', sortOrder: 2 },
    ])

  const tripU2 = await upsertTrip('spiti-valley-circuit-jun-2026', {
      organizerId: org2.id, destinationId: spiti.id,
      title: 'Spiti Valley Circuit — 6N/7D High Altitude Adventure',
      tripType: 'ROAD_TRIP', bookingMode: 'REQUEST_BASED', seatSelectionEnabled: true,
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
      photos: ['https://images.unsplash.com/photo-1639776020915-922f56acf66d?w=800', 'https://images.unsplash.com/photo-1723575409854-b8bd40109081?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
  })

  const tripU3 = await upsertTrip('udaipur-city-of-lakes-jul-2026', {
      organizerId: org3.id, destinationId: udaipur.id,
      title: 'Udaipur — City of Lakes Royal Getaway 2N/3D',
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
      photos: ['https://images.unsplash.com/photo-1675772120474-b9d7811220f9?w=800', 'https://images.unsplash.com/photo-1718812771168-3b3dc283cc78?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    }, [
      { type: 'PICKUP', label: 'Udaipur Railway Station', time: '9:30 AM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Udaipur Airport', time: '9:00 AM', sortOrder: 1 },
    ])

  const tripU4 = await upsertTrip('coorg-coffee-plantation-jul-2026', {
      organizerId: org4.id, destinationId: coorg.id,
      title: 'Coorg Coffee Plantation Retreat — 2N/3D',
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
      photos: ['https://images.unsplash.com/photo-1694537623159-52f5c5a98029?w=800', 'https://images.unsplash.com/photo-1699819436460-407a842e4ef6?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    }, [
      { type: 'PICKUP', label: 'Bangalore — Majestic Bus Stand', time: '6:00 AM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Mysore — KSRTC Bus Stand', time: '8:30 AM', sortOrder: 1 },
    ])

  const tripU5 = await upsertTrip('varanasi-spiritual-immersion-aug-2026', {
      organizerId: org1.id, destinationId: varanasi.id,
      title: 'Varanasi — Spiritual & Cultural Immersion 2N/3D',
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
      photos: ['https://images.unsplash.com/photo-1665413793087-d58c23e3a177?w=800', 'https://images.unsplash.com/photo-1665413790985-f57f5cfaaadc?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    }, [
      { type: 'PICKUP', label: 'Varanasi Airport', address: 'Lal Bahadur Shastri Airport, Arrivals', time: '10:00 AM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Varanasi Junction Station', time: '10:30 AM', sortOrder: 1 },
    ])

  const tripU6 = await upsertTrip('andaman-beach-scuba-sep-2026', {
      organizerId: org4.id, destinationId: andaman.id,
      title: 'Andaman Islands Beach & Scuba Expedition 4N/5D',
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
      photos: ['https://images.unsplash.com/photo-1710790980336-8dea6a8d432d?w=800', 'https://images.unsplash.com/photo-1710790980317-7bf33539f67f?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
  })

  // ── Popular Destinations from Pune ───────────────────

  const tripU7 = await upsertTrip('goa-monsoon-beach-escape-jul-2026', {
      organizerId: org1.id, destinationId: goa.id,
      title: 'Goa Monsoon Beach Escape — 3N/4D from Pune',
      tripType: 'BEACH', bookingMode: 'INSTANT', seatSelectionEnabled: true,
      description: 'Experience Goa like never before — in the magical monsoon! Lush green landscapes, empty beaches, dramatic waterfalls, and the freshest seafood of the year. Stay at a boutique resort in South Goa, explore the lesser-known Divar Island, kayak through mangroves, and enjoy Goan feni-tasting sessions. Perfect for those who want Goa without the tourist crowds.',
      itinerary: [
        { day: 1, title: 'Pune to South Goa', description: 'Overnight drive, morning arrival at South Goa.', activities: [{ title: 'AC bus departure from Pune', time: '10:00 PM' }, { title: 'Arrive Palolem & resort check-in', time: '8:00 AM' }, { title: 'Brunch at resort', time: '10:00 AM' }, { title: 'Palolem Beach walk', time: '4:00 PM' }, { title: 'Seafood dinner at a beach shack', time: '7:30 PM' }] },
        { day: 2, title: 'Waterfalls & Spice Plantation', description: 'Monsoon-exclusive experiences.', activities: [{ title: 'Dudhsagar Falls viewpoint trek', time: '7:00 AM' }, { title: 'Spice plantation lunch with feni tasting', time: '12:30 PM' }, { title: 'Old Goa churches (Basilica of Bom Jesus)', time: '3:30 PM' }, { title: 'Fontainhas Latin Quarter walk', time: '5:30 PM' }] },
        { day: 3, title: 'Divar Island & Mangrove Kayaking', description: 'Hidden Goa beyond the beaches.', activities: [{ title: 'Ferry to Divar Island', time: '8:00 AM' }, { title: 'Village cycling tour', time: '9:30 AM' }, { title: 'Mangrove kayaking at Cumbarjua Canal', time: '2:00 PM' }, { title: 'Sunset at Cabo de Rama Fort', time: '5:00 PM' }, { title: 'Farewell Goan thali dinner', time: '8:00 PM' }] },
        { day: 4, title: 'Morning Beach & Departure', description: 'Relaxed morning and drive back.', activities: [{ title: 'Sunrise yoga at Agonda Beach', time: '6:00 AM' }, { title: 'Breakfast & check-out', time: '9:00 AM' }, { title: 'Mapusa Friday Market (if Friday)', time: '10:30 AM' }, { title: 'Board AC bus to Pune', time: '1:00 PM' }] },
      ],
      startDate: d(2026, 7, 17), endDate: d(2026, 7, 21), bookingDeadline: d(2026, 7, 12),
      pricePerPerson: 6999, earlyBirdPrice: 5999, earlyBirdDeadline: d(2026, 7, 1),
      minGroupSize: 10, maxGroupSize: 24, currentBookings: 7,
      inclusions: ['AC sleeper bus Pune-Goa-Pune', 'Boutique resort in South Goa (3N)', 'Breakfast & dinner daily', 'Dudhsagar trek guide', 'Spice plantation entry + lunch', 'Mangrove kayaking', 'Divar Island ferry + cycling', 'All monument entries'],
      exclusions: ['Lunch (Day 1 & 4)', 'Alcoholic beverages', 'Water sports', 'Personal expenses', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1698430184854-17aa542d247c?w=800', 'https://images.unsplash.com/photo-1558894930-0e1f89b9f0ce?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    }, [
      { type: 'PICKUP', label: 'Pune — Shivaji Nagar Bus Stand', address: 'Shivaji Nagar Bus Depot, Pune 411005', time: '10:00 PM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Pune — Wakad Bridge', address: 'Near Wakad Bridge, Hinjewadi Road', time: '10:30 PM', sortOrder: 1 },
      { type: 'PICKUP', label: 'Pune — Swargate ST Stand', address: 'Swargate Bus Depot, Pune 411042', time: '11:00 PM', sortOrder: 2 },
    ])

  const tripU8 = await upsertTrip('lonavala-monsoon-trek-camping-jul-2026', {
      organizerId: org4.id, destinationId: lonavala.id,
      title: 'Lonavala Monsoon Trek & Camping — 1N/2D from Pune',
      tripType: 'TREKKING', bookingMode: 'INSTANT',
      description: 'The quintessential Sahyadri monsoon experience! Trek through mist-covered hills to Tikona Fort, chase waterfalls at Bhushi Dam, camp under the stars with a bonfire and Maharashtrian dinner. Just 2 hours from Pune — the perfect weekend escape when the Western Ghats turn emerald green.',
      itinerary: [
        { day: 1, title: 'Trek to Tikona Fort & Camping', description: 'Morning drive from Pune, full day of trekking and camping.', activities: [{ title: 'Pune pickup (Wakad & Chandni Chowk)', time: '5:30 AM' }, { title: 'Breakfast at base village', time: '7:30 AM' }, { title: 'Tikona Fort trek (moderate, 1.5 hrs)', time: '8:30 AM' }, { title: 'Fort exploration & panoramic views', time: '10:00 AM' }, { title: 'Trek descent & lunch', time: '12:00 PM' }, { title: 'Bhushi Dam waterfall visit', time: '3:00 PM' }, { title: 'Campsite setup at Pawna Lake', time: '5:00 PM' }, { title: 'Bonfire + Maharashtrian veg/non-veg dinner', time: '7:30 PM' }, { title: 'Stargazing session', time: '9:30 PM' }] },
        { day: 2, title: 'Sunrise, Kayaking & Return', description: 'Lakeside morning and return to Pune.', activities: [{ title: 'Sunrise at Pawna Lake', time: '5:30 AM' }, { title: 'Optional: kayaking on Pawna (₹300)', time: '6:30 AM' }, { title: 'Breakfast at camp', time: '8:00 AM' }, { title: 'Lohagad Fort quick visit (optional)', time: '9:30 AM' }, { title: 'Drive back to Pune', time: '12:00 PM' }] },
      ],
      startDate: d(2026, 7, 25), endDate: d(2026, 7, 27), bookingDeadline: d(2026, 7, 22),
      pricePerPerson: 2499,
      minGroupSize: 12, maxGroupSize: 30, currentBookings: 15,
      inclusions: ['Pune pickup & drop (Wakad + Chandni Chowk)', 'Trek guide', 'Camping at Pawna Lake (1N)', 'Tent + sleeping bag + mat', 'All meals (2 breakfast, 1 lunch, 1 dinner)', 'Bonfire', 'First aid kit'],
      exclusions: ['Kayaking (₹300 optional)', 'Personal snacks', 'Rain gear (bring your own)', 'Travel insurance'],
      cancellationPolicy: 'FLEXIBLE',
      photos: ['https://images.unsplash.com/photo-1692214661061-085e8c99a9d4?w=800', 'https://images.unsplash.com/photo-1664872045208-4aea6475f843?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    }, [
      { type: 'PICKUP', label: 'Pune — Wakad Bridge', address: 'Near Wakad Bridge, Hinjewadi Road', time: '5:30 AM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Pune — Chandni Chowk', address: 'Chandni Chowk, Bavdhan', time: '6:00 AM', sortOrder: 1 },
    ])

  const tripU9 = await upsertTrip('manali-summer-adventure-jun-2026', {
      organizerId: org2.id, destinationId: manali.id,
      title: 'Manali Summer Adventure — 5N/6D Himalayan Escape',
      tripType: 'ADVENTURE', bookingMode: 'INSTANT', seatSelectionEnabled: true,
      description: 'Beat the summer heat in the cool Himalayan air of Manali! Paragliding at Solang Valley, river crossing at Beas, Old Manali cafe hopping, and a day trip through the legendary Atal Tunnel to Sissu. Stay at a charming wooden cottage with apple orchard views. Includes a surprise adventure activity!',
      itinerary: [
        { day: 1, title: 'Arrival in Manali', description: 'Fly to Kullu/overnight bus to Manali.', activities: [{ title: 'Arrival & cottage check-in', time: '10:00 AM' }, { title: 'Lunch at river-view cafe', time: '12:30 PM' }, { title: 'Mall Road evening walk', time: '4:00 PM' }, { title: 'Welcome bonfire + hot chocolate', time: '8:00 PM' }] },
        { day: 2, title: 'Solang Valley Adventure', description: 'Full day of adrenaline-pumping activities.', activities: [{ title: 'Drive to Solang Valley', time: '8:00 AM' }, { title: 'Paragliding (tandem)', time: '9:30 AM' }, { title: 'Zorbing & ATV ride', time: '11:30 AM' }, { title: 'Lunch at snow-point dhaba', time: '1:00 PM' }, { title: 'Atal Tunnel drive to Sissu', time: '3:00 PM' }, { title: 'Sissu waterfall & Chandra river', time: '4:30 PM' }] },
        { day: 3, title: 'River Crossing & Nature Walk', description: 'Beas River adventures.', activities: [{ title: 'River crossing at Beas Kund trail', time: '8:00 AM' }, { title: 'Nature walk through pine forests', time: '11:00 AM' }, { title: 'Picnic lunch by the river', time: '1:00 PM' }, { title: 'Free afternoon in Old Manali', time: '4:00 PM' }, { title: 'Cafe hopping (Lazy Dog, Drifters)', time: '5:00 PM' }] },
        { day: 4, title: 'Naggar Castle & Art', description: 'Cultural side of Kullu Valley.', activities: [{ title: 'Drive to Naggar Castle', time: '9:00 AM' }, { title: 'Roerich Art Gallery', time: '11:00 AM' }, { title: 'Jana Waterfall trek', time: '1:00 PM' }, { title: 'Kullu shawl factory visit', time: '4:00 PM' }] },
        { day: 5, title: 'Hadimba Temple & Hot Springs', description: 'Iconic Manali experiences.', activities: [{ title: 'Hadimba Devi Temple', time: '9:00 AM' }, { title: 'Club House', time: '11:00 AM' }, { title: 'Vashisht Hot Springs', time: '2:00 PM' }, { title: 'Farewell dinner with live music', time: '7:30 PM' }] },
        { day: 6, title: 'Departure', description: 'Breakfast and departure.', activities: [{ title: 'Apple orchard breakfast', time: '8:00 AM' }, { title: 'Checkout & departure', time: '10:00 AM' }] },
      ],
      startDate: d(2026, 6, 20), endDate: d(2026, 6, 26), bookingDeadline: d(2026, 6, 14),
      pricePerPerson: 11999, earlyBirdPrice: 10499, earlyBirdDeadline: d(2026, 6, 5),
      minGroupSize: 8, maxGroupSize: 18, currentBookings: 5,
      inclusions: ['Cottage stay with mountain views (5N)', 'All meals', 'Paragliding (tandem)', 'Zorbing + ATV', 'River crossing session', 'Atal Tunnel day trip', 'Naggar Castle & gallery entry', 'Bonfire', 'All local transfers by Innova'],
      exclusions: ['Travel to/from Manali (flight or bus)', 'Lunch on Day 3 & 6', 'Shopping', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1616942986550-ea6469c08530?w=800', 'https://images.unsplash.com/photo-1618500508371-d0158e696eb0?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    }, [
      { type: 'PICKUP', label: 'Kullu-Manali Airport', address: 'Bhuntar Airport, Kullu', time: '9:30 AM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Manali Bus Stand', time: '10:00 AM', sortOrder: 1 },
    ])

  const tripU10 = await upsertTrip('ladakh-bike-expedition-jul-2026', {
      organizerId: org2.id, destinationId: ladakh.id,
      title: 'Ladakh Bike Expedition — Manali to Leh 8N/9D',
      tripType: 'ROAD_TRIP', bookingMode: 'REQUEST_BASED',
      description: 'The ride of a lifetime returns for 2026! Manali to Leh on Royal Enfields through the highest motorable passes. Cross Rohtang, Baralacha La, Tanglang La, and Khardung La. Camp at Pangong Lake under a billion stars, ride through Nubra Valley sand dunes. Small group of experienced riders with backup vehicle and mechanic.',
      itinerary: [
        { day: 1, title: 'Manali — Bike Allocation & Briefing', description: 'Arrive Manali, get your Royal Enfield, safety briefing.', activities: [{ title: 'Hotel check-in & acclimatization', time: '10:00 AM' }, { title: 'Bike allocation & test ride', time: '2:00 PM' }, { title: 'Route briefing & gear check', time: '4:00 PM' }, { title: 'Group dinner & intro', time: '7:30 PM' }] },
        { day: 2, title: 'Manali to Jispa (145 km)', description: 'Through Atal Tunnel to Lahaul Valley.', activities: [{ title: 'Ride start', time: '7:00 AM' }, { title: 'Atal Tunnel crossing', time: '9:00 AM' }, { title: 'Keylong lunch stop', time: '12:00 PM' }, { title: 'Arrive Jispa campsite', time: '4:00 PM' }] },
        { day: 3, title: 'Jispa to Sarchu (85 km)', description: 'Cross Baralacha La pass (4,890m).', activities: [{ title: 'Early ride start', time: '6:30 AM' }, { title: 'Baralacha La summit (16,040 ft)', time: '10:00 AM' }, { title: 'Suraj Tal lake stop', time: '11:00 AM' }, { title: 'Sarchu camp', time: '3:00 PM' }] },
        { day: 4, title: 'Sarchu to Leh (260 km)', description: 'Gata Loops, Lachalung La, More Plains, Tanglang La.', activities: [{ title: 'Pre-dawn start', time: '5:00 AM' }, { title: '21 Gata Loops', time: '7:00 AM' }, { title: 'More Plains — the high altitude desert', time: '11:00 AM' }, { title: 'Tanglang La (17,480 ft)', time: '1:00 PM' }, { title: 'Arrive Leh', time: '6:00 PM' }] },
        { day: 5, title: 'Leh Rest Day — Acclimatization', description: 'Explore Leh at a relaxed pace.', activities: [{ title: 'Leh Palace morning visit', time: '10:00 AM' }, { title: 'Shanti Stupa', time: '12:00 PM' }, { title: 'Leh Main Bazaar walk', time: '3:00 PM' }, { title: 'Changspa Road cafes', time: '5:00 PM' }] },
        { day: 6, title: 'Leh to Pangong Lake (160 km)', description: 'Via Chang La — third highest motorable pass.', activities: [{ title: 'Ride to Chang La (17,586 ft)', time: '7:00 AM' }, { title: 'Arrive Pangong Tso', time: '1:00 PM' }, { title: 'Lakeside camping & photography', time: '3:00 PM' }, { title: 'Stargazing at 14,000 ft', time: '9:00 PM' }] },
        { day: 7, title: 'Pangong to Nubra Valley (280 km)', description: 'Shyok route through dramatic valleys.', activities: [{ title: 'Ride via Shyok River road', time: '7:00 AM' }, { title: 'Hunder village arrival', time: '3:00 PM' }, { title: 'Double-hump camel ride on sand dunes', time: '5:00 PM' }] },
        { day: 8, title: 'Nubra to Leh via Khardung La', description: 'World-famous Khardung La pass.', activities: [{ title: 'Diskit Monastery', time: '7:00 AM' }, { title: 'Maitreya Buddha statue', time: '9:00 AM' }, { title: 'Khardung La (17,982 ft)', time: '12:00 PM' }, { title: 'Arrive Leh — farewell dinner', time: '5:00 PM' }] },
        { day: 9, title: 'Departure', description: 'Fly out from Leh.', activities: [{ title: 'Airport drop', time: '9:00 AM' }] },
      ],
      startDate: d(2026, 7, 10), endDate: d(2026, 7, 19), bookingDeadline: d(2026, 7, 1),
      pricePerPerson: 22999, earlyBirdPrice: 19999, earlyBirdDeadline: d(2026, 6, 20),
      minGroupSize: 6, maxGroupSize: 12, currentBookings: 3,
      inclusions: ['Royal Enfield 350cc rental + fuel', 'Accommodation (8N — hotel + camps)', 'All meals', 'Backup vehicle + mechanic', 'Inner Line Permits', 'First aid & oxygen cylinder', 'Experienced ride captain', 'Pangong lakeside camping'],
      exclusions: ['Flights to Manali / from Leh', 'Riding gear (can rent at ₹800/day)', 'Alcohol', 'Travel insurance (mandatory)', 'Personal expenses'],
      cancellationPolicy: 'STRICT',
      photos: ['https://images.unsplash.com/photo-1633259422382-5ead30efb697?w=800', 'https://images.unsplash.com/photo-1648851460314-ba293ba2cdcf?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
  })

  const tripU11 = await upsertTrip('rishikesh-rafting-bungee-aug-2026', {
      organizerId: org1.id, destinationId: rishikesh.id,
      title: 'Rishikesh Rafting & Bungee Weekend — 1N/2D',
      tripType: 'ADVENTURE', bookingMode: 'INSTANT', seatSelectionEnabled: true,
      description: 'Maximum adrenaline in minimum time! 16 km Grade III-IV white water rafting on the Ganges, India\'s highest bungee jump (83m), cliff jumping, riverside camping under the stars, and a magical Ganga Aarti. Bus from Delhi on Friday night, back by Sunday afternoon. The ultimate weekend adrenaline fix.',
      itinerary: [
        { day: 1, title: 'Arrive, Raft, Camp', description: 'Arrive Rishikesh, hit the rapids, camp by the river.', activities: [{ title: 'Arrive Shivpuri base camp', time: '9:00 AM' }, { title: '16 km white water rafting (Grade III-IV)', time: '10:00 AM' }, { title: 'Cliff jumping at Maggi Point', time: '1:00 PM' }, { title: 'Bungee jump at Jumpin Heights (83m)', time: '3:30 PM' }, { title: 'Riverside tent check-in', time: '5:30 PM' }, { title: 'Ganga Aarti at Triveni Ghat', time: '6:30 PM' }, { title: 'Bonfire + live guitar + dinner', time: '8:30 PM' }] },
        { day: 2, title: 'Yoga, Explore & Depart', description: 'Sunrise yoga and explore Rishikesh.', activities: [{ title: 'Sunrise yoga by the Ganges', time: '6:00 AM' }, { title: 'Breakfast at camp', time: '8:00 AM' }, { title: 'Lakshman Jhula & Ram Jhula walk', time: '9:30 AM' }, { title: 'Chotiwala lunch (famous since 1958)', time: '12:00 PM' }, { title: 'Departure to Delhi', time: '2:00 PM' }] },
      ],
      startDate: d(2026, 8, 14), endDate: d(2026, 8, 16), bookingDeadline: d(2026, 8, 10),
      pricePerPerson: 4999,
      minGroupSize: 10, maxGroupSize: 24, currentBookings: 9,
      inclusions: ['Delhi-Rishikesh-Delhi AC bus', '16 km rafting + safety gear', 'Bungee jump at Jumpin Heights', 'Riverside camping (1N)', 'All meals (2 breakfast, 1 lunch, 1 dinner)', 'Bonfire + music', 'Yoga session', 'Ganga Aarti visit'],
      exclusions: ['Giant swing / flying fox (₹3,500 combo)', 'Personal snacks', 'Travel insurance'],
      cancellationPolicy: 'FLEXIBLE',
      photos: ['https://images.unsplash.com/photo-1718383537744-13289af20e12?w=800', 'https://images.unsplash.com/photo-1653282768163-04a56f9c0d46?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    }, [
      { type: 'PICKUP', label: 'Delhi — Kashmere Gate ISBT', time: '11:00 PM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Delhi — Majnu Ka Tila', address: 'Majnu Ka Tila Gurudwara parking', time: '11:30 PM', sortOrder: 1 },
    ])

  const tripU12 = await upsertTrip('jaipur-royal-heritage-food-trail-aug-2026', {
      organizerId: org3.id, destinationId: jaipur.id,
      title: 'Jaipur Royal Heritage & Food Trail — 2N/3D',
      tripType: 'CULTURAL', bookingMode: 'INSTANT', seatSelectionEnabled: true,
      description: 'The Pink City reimagined! Beyond the usual tourist trail — this trip combines iconic forts with hidden gems: secret step wells, Rajasthani cooking masterclass with a local family, sunrise hot-air balloon ride over Amber Fort, block printing workshop, and a curated street food trail through Jaipur\'s bylanes. Stay at a 200-year-old heritage haveli.',
      itinerary: [
        { day: 1, title: 'Arrival & Hidden Jaipur', description: 'Heritage haveli check-in and explore beyond the obvious.', activities: [{ title: 'Heritage haveli check-in', time: '10:00 AM' }, { title: 'Panna Meena Ka Kund (secret stepwell)', time: '12:00 PM' }, { title: 'Hawa Mahal & City Palace', time: '2:00 PM' }, { title: 'Curated street food trail — kachori, kulfi, pyaaz kachori, ghewar', time: '5:00 PM' }, { title: 'Dharohar dance show at Bagore ki Haveli', time: '7:00 PM' }, { title: 'Rooftop dinner at haveli', time: '8:30 PM' }] },
        { day: 2, title: 'Amber Fort & Crafts', description: 'Iconic forts and hands-on Rajasthani crafts.', activities: [{ title: 'Hot-air balloon ride at sunrise (optional ₹8,000)', time: '5:30 AM' }, { title: 'Amber Fort exploration', time: '9:00 AM' }, { title: 'Rajasthani cooking class with local family', time: '12:00 PM' }, { title: 'Block printing workshop at Sanganer', time: '3:00 PM' }, { title: 'Nahargarh Fort sunset with chai', time: '5:30 PM' }, { title: 'Chokhi Dhani cultural dinner', time: '7:30 PM' }] },
        { day: 3, title: 'Bazaars & Departure', description: 'Famous markets and farewell lassi.', activities: [{ title: 'Johari Bazaar (jewellery)', time: '9:00 AM' }, { title: 'Bapu Bazaar (textiles)', time: '10:30 AM' }, { title: 'Famous lassi at Lassiwala (since 1944)', time: '12:00 PM' }, { title: 'Albert Hall Museum (optional)', time: '1:00 PM' }, { title: 'Drop to station/airport', time: '3:00 PM' }] },
      ],
      startDate: d(2026, 8, 21), endDate: d(2026, 8, 24), bookingDeadline: d(2026, 8, 16),
      pricePerPerson: 7499, earlyBirdPrice: 6499, earlyBirdDeadline: d(2026, 8, 5),
      minGroupSize: 8, maxGroupSize: 20, currentBookings: 6,
      inclusions: ['Heritage haveli stay (2N)', 'Breakfast & dinner daily', 'Amber Fort entry + jeep ride', 'City Palace & Hawa Mahal tickets', 'Cooking class with local family', 'Block printing workshop', 'Dharohar dance show', 'Chokhi Dhani dinner', 'Street food trail', 'AC tempo traveller'],
      exclusions: ['Train/flight tickets', 'Hot-air balloon (₹8,000 optional)', 'Lunch', 'Shopping', 'Travel insurance'],
      cancellationPolicy: 'MODERATE',
      photos: ['https://images.unsplash.com/photo-1629890030060-80703e074e7e?w=800', 'https://images.unsplash.com/photo-1650450888332-a76185277321?w=800'],
      status: 'ACTIVE', acceptingBookings: true,
    }, [
      { type: 'PICKUP', label: 'Jaipur Junction Railway Station', time: '9:30 AM', sortOrder: 0 },
      { type: 'PICKUP', label: 'Jaipur Airport', address: 'Jaipur International Airport, Arrivals', time: '9:00 AM', sortOrder: 1 },
    ])

  console.log('  ✓ Created 12 upcoming trips (June-Sep 2026, ₹2.5K-23K range)')
  return { tripU1, tripU2, tripU3, tripU4, tripU5, tripU6, tripU7, tripU8, tripU9, tripU10, tripU11, tripU12 }
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

  // ⚠ nextRef() generates sequential bookingRefs (SFN-2026-0001, 0002, ...).
  // New bookings MUST be appended at the END of each section — never inserted
  // mid-list — otherwise refs shift and existing data gets mismatched on re-run.
  let refNum = 0
  const nextRef = () => `SFN-2026-${String(++refNum).padStart(4, '0')}`

  // ══════════════════════════════════════════════════════
  // ── COMPLETED TRIP BOOKINGS ───────────────────────────
  // ══════════════════════════════════════════════════════

  // Trip C1: Goa Beach Carnival — 18 bookings (completed)
  const bC1_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t1.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'COMPLETED' } })
  const bC1_2 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t2.id, numTravelers: 1, totalAmount: 5499, bookingStatus: 'COMPLETED' } })
  const bC1_3 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t3.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'COMPLETED' } })
  const bC1_4 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t4.id, numTravelers: 1, totalAmount: 6499, bookingStatus: 'COMPLETED' } })
  const bC1_5 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t5.id, numTravelers: 3, totalAmount: 16497, bookingStatus: 'COMPLETED' } })
  const bC1_6 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t6.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'COMPLETED' } })
  const bC1_7 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t7.id, numTravelers: 1, totalAmount: 6499, bookingStatus: 'COMPLETED' } })
  const bC1_8 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t8.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'COMPLETED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t9.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'CANCELLED', cancellationReason: 'Could not get leave from office', cancelledAt: d(2026, 1, 5), cancelledById: t9.id } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC1.id, userId: t10.id, numTravelers: 1, totalAmount: 6499, bookingStatus: 'CANCELLED', cancellationReason: 'Family emergency', cancelledAt: d(2026, 1, 8), cancelledById: t10.id } })

  // Trip C2: Manali Snow — 14 bookings
  const bC2_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t3.id, numTravelers: 2, totalAmount: 17998, bookingStatus: 'COMPLETED' } })
  const bC2_2 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t5.id, numTravelers: 1, totalAmount: 7999, bookingStatus: 'COMPLETED' } })
  const bC2_3 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t7.id, numTravelers: 2, totalAmount: 17998, bookingStatus: 'COMPLETED' } })
  const bC2_4 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t9.id, numTravelers: 1, totalAmount: 8999, bookingStatus: 'COMPLETED' } })
  const bC2_5 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t11.id, numTravelers: 2, totalAmount: 17998, bookingStatus: 'COMPLETED' } })
  const bC2_6 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC2.id, userId: t12.id, numTravelers: 1, totalAmount: 8999, bookingStatus: 'COMPLETED' } })

  // Trip C3: Rishikesh Rafting — 20 bookings
  const bC3_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t1.id, numTravelers: 3, totalAmount: 10497, bookingStatus: 'COMPLETED' } })
  const bC3_2 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t4.id, numTravelers: 2, totalAmount: 6998, bookingStatus: 'COMPLETED' } })
  const bC3_3 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t6.id, numTravelers: 1, totalAmount: 3499, bookingStatus: 'COMPLETED' } })
  const bC3_4 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t8.id, numTravelers: 2, totalAmount: 6998, bookingStatus: 'COMPLETED' } })
  const bC3_5 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t10.id, numTravelers: 1, totalAmount: 3499, bookingStatus: 'COMPLETED' } })
  const bC3_6 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC3.id, userId: t12.id, numTravelers: 2, totalAmount: 6998, bookingStatus: 'COMPLETED' } })

  // Trip C4: Jaipur Heritage — 16 bookings
  const bC4_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t2.id, numTravelers: 2, totalAmount: 9998, bookingStatus: 'COMPLETED' } })
  const bC4_2 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t4.id, numTravelers: 1, totalAmount: 5999, bookingStatus: 'COMPLETED' } })
  const bC4_3 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t6.id, numTravelers: 2, totalAmount: 11998, bookingStatus: 'COMPLETED' } })
  const bC4_4 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t8.id, numTravelers: 1, totalAmount: 5999, bookingStatus: 'COMPLETED' } })
  const bC4_5 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t10.id, numTravelers: 2, totalAmount: 11998, bookingStatus: 'COMPLETED' } })
  const bC4_6 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ct.tripC4.id, userId: t11.id, numTravelers: 1, totalAmount: 4999, bookingStatus: 'COMPLETED' } })

  console.log('  ✓ Created completed trip bookings (C1-C4)')

  // ── Payments for completed trips ──
  const completedBookings = [bC1_1, bC1_2, bC1_3, bC1_4, bC1_5, bC1_6, bC1_7, bC1_8, bC2_1, bC2_2, bC2_3, bC2_4, bC2_5, bC2_6, bC3_1, bC3_2, bC3_3, bC3_4, bC3_5, bC3_6, bC4_1, bC4_2, bC4_3, bC4_4, bC4_5, bC4_6]
  let payIdx = 0
  for (const b of completedBookings) {
    await safePaymentCreate({
      data: { bookingId: b.id, type: 'PAYMENT', amount: b.totalAmount, status: 'CAPTURED', razorpayOrderId: `order_prod_${String(++payIdx).padStart(3, '0')}`, razorpayPaymentId: `pay_prod_${String(payIdx).padStart(3, '0')}` },
    })
  }
  console.log(`  ✓ Created ${payIdx} payment transactions for completed trips`)

  // ── Traveler details for key bookings ──
  await safeTravelerCreateMany({
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
    { tripId: ct.tripC1.id, bookingId: bC1_1.id, userId: t1.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Absolutely incredible trip! The beachfront resort was stunning, water sports were thrilling, and the group was amazing. Desi Explorers really knows how to organize a perfect Goa getaway. Already planning my next trip with them!', daysAgo: 95 },
    { tripId: ct.tripC1.id, bookingId: bC1_2.id, userId: t2.id, overall: 4, org: 5, val: 4, safe: 5, acc: 4, comment: 'Great experience overall! The Fort Aguada sunset was magical. Only suggestion would be to include lunch in the package. Breakfast and dinner were delicious though.', daysAgo: 93 },
    { tripId: ct.tripC1.id, bookingId: bC1_3.id, userId: t3.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'My wife and I had the best time! South Goa day was the highlight — Palolem Beach was paradise. The spice plantation dinner was a unique touch. Highly recommended for couples!', daysAgo: 91 },
    { tripId: ct.tripC1.id, bookingId: bC1_4.id, userId: t4.id, overall: 4, org: 4, val: 5, safe: 4, acc: 4, comment: 'Great value for ₹6,499! The water sports package alone would cost ₹3,000 if booked separately. Bus from Pune was comfortable. Will come again!', daysAgo: 90 },
    { tripId: ct.tripC1.id, bookingId: bC1_5.id, userId: t5.id, overall: 5, org: 5, val: 4, safe: 5, acc: 5, comment: 'Went with two friends and we had a blast! The organizer was super helpful — even arranged a birthday cake for my friend as a surprise. These small touches make all the difference.', daysAgo: 89 },
    { tripId: ct.tripC1.id, bookingId: bC1_6.id, userId: t6.id, overall: 3, org: 3, val: 3, safe: 4, acc: 3, comment: 'Trip was decent but expected more from the nightlife side. The resort was far from the clubs so we had to arrange our own transport at night. Day activities were well planned though.', daysAgo: 88 },
    { tripId: ct.tripC1.id, bookingId: bC1_7.id, userId: t7.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'As a solo traveler, this was perfect! Made 6 new friends on this trip. The group dynamics were great and the organizer ensured everyone was included in every activity.', daysAgo: 87 },
    { tripId: ct.tripC1.id, bookingId: bC1_8.id, userId: t8.id, overall: 4, org: 4, val: 4, safe: 5, acc: 4, comment: 'Beautiful trip with great safety measures. The life jackets and trained guides during water sports made me feel very secure. Would have loved an extra day in South Goa.', daysAgo: 86 },

    // Manali Snow reviews
    { tripId: ct.tripC2.id, bookingId: bC2_1.id, userId: t3.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'First time seeing snow and it exceeded every expectation! The cottage was cozy with amazing mountain views. Solang Valley skiing was the highlight. Summit & Shore made this trip magical!', daysAgo: 80 },
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
    { tripId: ct.tripC3.id, bookingId: bC3_6.id, userId: t12.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'This was my 3rd time rafting in Rishikesh and by far the best experience. The guide knew exactly which rapids to hit for maximum fun. The Ganga Aarti evening was spiritually uplifting. Desi Explorers delivers!', daysAgo: 59 },

    // Jaipur Heritage reviews
    { tripId: ct.tripC4.id, bookingId: bC4_1.id, userId: t2.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Took my mother on this trip and she was in tears at Amber Fort — she had always wanted to visit. The heritage haveli stay felt like living in history. Chokhi Dhani dinner was the highlight. Thank you Nomad Trails!', daysAgo: 50 },
    { tripId: ct.tripC4.id, bookingId: bC4_2.id, userId: t4.id, overall: 4, org: 4, val: 4, safe: 5, acc: 4, comment: 'The block printing workshop was surprisingly fun — I made my own tablecloth! Nahargarh Fort sunset with chai was Instagram gold. Good mix of history and hands-on experiences.', daysAgo: 48 },
    { tripId: ct.tripC4.id, bookingId: bC4_3.id, userId: t6.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Jaipur exceeded every expectation. The local guide at City Palace was incredibly knowledgeable — felt like a private royal tour. The haveli room had carved wooden doors that were 200 years old!', daysAgo: 47 },
    { tripId: ct.tripC4.id, bookingId: bC4_4.id, userId: t8.id, overall: 4, org: 4, val: 4, safe: 5, acc: 3, comment: 'Lovely trip but the schedule was very packed. Would have appreciated a free afternoon to explore at our own pace. The food at Chokhi Dhani was authentic and delicious.', daysAgo: 46 },
    { tripId: ct.tripC4.id, bookingId: bC4_5.id, userId: t10.id, overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'The lassi at Lassiwala was the best thing I have ever tasted! The entire trip was a sensory overload — colors, flavors, history. Nomad Trails curates experiences, not just trips. Big difference!', daysAgo: 45 },
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
    ['https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=600', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600'],
    ['https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=600'],
    [],
    ['https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=600', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600'],
    [],
    ['https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=600'],
    ['https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600', 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600'],
    ['https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600'],
    ['https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600', 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600'],
    [],
    ['https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600'],
    [],
  ]

  const orgReplies: Record<number, { reply: string; daysAfter: number }> = {
    0: { reply: 'Thank you Amit! So glad you and your wife had a great time. The group was fantastic this batch. See you on our next Goa trip! 🏖️', daysAfter: 2 },
    4: { reply: 'Happy birthday to your friend! We love adding those personal touches. Thanks for choosing Desi Explorers! 🎂', daysAfter: 3 },
    5: { reply: 'Thank you for the feedback, Ananya. We have added a late-night shuttle service for future batches. Hope to see you again!', daysAfter: 1 },
    8: { reply: 'Welcome to the snow fam, Rohan! That cottage really is special, isn\'t it? The mountain views at sunrise are unforgettable. See you next winter! ❄️', daysAfter: 2 },
    11: { reply: 'We appreciate your honest feedback, Nikhil. The skiing session has been extended to 2 hours for all upcoming batches. We take accuracy seriously!', daysAfter: 1 },
    14: { reply: 'Grade IV rapids + cliff jumping + stargazing = the ultimate Rishikesh weekend! Thanks Amit, see you for the monsoon batch! 🌊', daysAfter: 2 },
    17: { reply: 'Safety is our #1 priority, Meera. We are so happy you felt safe as a solo traveler. Our separate tent policy is something we are very proud of! ❤️', daysAfter: 1 },
    20: { reply: 'Sneha, your mother\'s reaction at Amber Fort made our team emotional too! That\'s exactly why we do this. Thank you for trusting Nomad Trails with such a special trip! 🙏', daysAfter: 2 },
  }

  for (let i = 0; i < reviewData.length; i++) {
    const r = reviewData[i]
    const reply = orgReplies[i]
    await safeReviewCreate({
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
  const bU1_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU1.id, userId: t1.id, numTravelers: 2, totalAmount: 16998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU1.id, userId: t6.id, numTravelers: 1, totalAmount: 8499, bookingStatus: 'CONFIRMED' } })
  // Pending payment
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU1.id, userId: t9.id, numTravelers: 1, totalAmount: 9499, bookingStatus: 'PENDING_PAYMENT', expiresAt: d(2026, 5, 10) } })

  // Spiti — 2 confirmed (request-based)
  const bU2_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU2.id, userId: t3.id, numTravelers: 2, totalAmount: 25998, bookingStatus: 'CONFIRMED' } })
  await safeTripRequestCreate({ data: { tripId: ut.tripU2.id, userId: t3.id, numTravelers: 2, message: 'My wife and I have been dreaming of Spiti for years. Both experienced at high altitude. Please approve!', status: 'APPROVED', respondedAt: d(2026, 5, 1), responseNote: 'Welcome aboard! Payment link sent.', bookingId: bU2_1.id } })
  await safeTripRequestCreate({ data: { tripId: ut.tripU2.id, userId: t7.id, numTravelers: 1, message: 'Solo photographer looking for Spiti landscapes. I have altitude experience from Ladakh.', status: 'PENDING', approvalExpiresAt: d(2026, 5, 15) } })
  await safeTripRequestCreate({ data: { tripId: ut.tripU2.id, userId: t11.id, numTravelers: 2, message: 'College friends roadtrip! We both have our own bikes — can we ride our own instead?', status: 'PENDING', approvalExpiresAt: d(2026, 5, 15) } })

  // Udaipur — 4 confirmed
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU3.id, userId: t2.id, numTravelers: 2, totalAmount: 17998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU3.id, userId: t8.id, numTravelers: 1, totalAmount: 8999, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU3.id, userId: t10.id, numTravelers: 1, totalAmount: 9999, bookingStatus: 'CONFIRMED' } })

  // Coorg — 2 confirmed
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU4.id, userId: t4.id, numTravelers: 2, totalAmount: 18998, bookingStatus: 'CONFIRMED' } })

  // Varanasi — 1 confirmed
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU5.id, userId: t12.id, numTravelers: 1, totalAmount: 7999, bookingStatus: 'CONFIRMED' } })

  // Andaman — request-based, only pending requests
  await safeTripRequestCreate({ data: { tripId: ut.tripU6.id, userId: t5.id, numTravelers: 2, message: 'Honeymoon trip! My wife and I love scuba diving. Any couples discounts available?', status: 'PENDING', approvalExpiresAt: d(2026, 6, 1) } })
  await safeTripRequestCreate({ data: { tripId: ut.tripU6.id, userId: t9.id, numTravelers: 1, message: 'Solo travel photographer. Can I bring my underwater camera and drone?', status: 'PENDING', approvalExpiresAt: d(2026, 6, 1) } })

  // Goa Monsoon — 7 confirmed bookings
  const bU7_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU7.id, userId: t1.id, numTravelers: 2, totalAmount: 11998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU7.id, userId: t4.id, numTravelers: 1, totalAmount: 5999, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU7.id, userId: t6.id, numTravelers: 2, totalAmount: 13998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU7.id, userId: t11.id, numTravelers: 2, totalAmount: 13998, bookingStatus: 'CONFIRMED' } })

  // Lonavala Monsoon — 15 confirmed (popular budget trek)
  const bU8_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU8.id, userId: t2.id, numTravelers: 3, totalAmount: 7497, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU8.id, userId: t5.id, numTravelers: 2, totalAmount: 4998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU8.id, userId: t7.id, numTravelers: 1, totalAmount: 2499, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU8.id, userId: t9.id, numTravelers: 2, totalAmount: 4998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU8.id, userId: t10.id, numTravelers: 3, totalAmount: 7497, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU8.id, userId: t12.id, numTravelers: 2, totalAmount: 4998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU8.id, userId: t3.id, numTravelers: 2, totalAmount: 4998, bookingStatus: 'CONFIRMED' } })

  // Manali Summer — 5 confirmed
  const bU9_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU9.id, userId: t3.id, numTravelers: 2, totalAmount: 20998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU9.id, userId: t8.id, numTravelers: 1, totalAmount: 10499, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU9.id, userId: t11.id, numTravelers: 2, totalAmount: 23998, bookingStatus: 'CONFIRMED' } })

  // Ladakh Bike — 3 confirmed (request-based)
  const bU10_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU10.id, userId: t5.id, numTravelers: 1, totalAmount: 19999, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU10.id, userId: t7.id, numTravelers: 2, totalAmount: 45998, bookingStatus: 'CONFIRMED' } })
  await safeTripRequestCreate({ data: { tripId: ut.tripU10.id, userId: t5.id, numTravelers: 1, message: 'Experienced rider with 3 Ladakh trips. Have my own gear. Please approve!', status: 'APPROVED', respondedAt: d(2026, 5, 3), responseNote: 'Welcome aboard, rider! Payment link sent.', bookingId: bU10_1.id } })
  await safeTripRequestCreate({ data: { tripId: ut.tripU10.id, userId: t9.id, numTravelers: 1, message: 'First time Ladakh rider. I have a valid DL and basic riding experience.', status: 'PENDING', approvalExpiresAt: d(2026, 5, 20) } })

  // Rishikesh Rafting & Bungee — 9 confirmed
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU11.id, userId: t1.id, numTravelers: 3, totalAmount: 14997, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU11.id, userId: t4.id, numTravelers: 2, totalAmount: 9998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU11.id, userId: t8.id, numTravelers: 1, totalAmount: 4999, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU11.id, userId: t12.id, numTravelers: 3, totalAmount: 14997, bookingStatus: 'CONFIRMED' } })

  // Jaipur Heritage & Food — 6 confirmed
  const bU12_1 = await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU12.id, userId: t2.id, numTravelers: 2, totalAmount: 12998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU12.id, userId: t6.id, numTravelers: 1, totalAmount: 6499, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU12.id, userId: t10.id, numTravelers: 2, totalAmount: 14998, bookingStatus: 'CONFIRMED' } })
  await safeBookingCreate({ data: { bookingRef: nextRef(), tripId: ut.tripU12.id, userId: t3.id, numTravelers: 1, totalAmount: 7499, bookingStatus: 'CONFIRMED' } })

  // Payments for upcoming confirmed bookings
  await safePaymentCreate({ data: { bookingId: bU1_1.id, type: 'PAYMENT', amount: 16998, status: 'CAPTURED', razorpayOrderId: 'order_prod_up01', razorpayPaymentId: 'pay_prod_up01' } })
  await safePaymentCreate({ data: { bookingId: bU2_1.id, type: 'PAYMENT', amount: 25998, status: 'CAPTURED', razorpayOrderId: 'order_prod_up02', razorpayPaymentId: 'pay_prod_up02' } })
  await safePaymentCreate({ data: { bookingId: bU7_1.id, type: 'PAYMENT', amount: 11998, status: 'CAPTURED', razorpayOrderId: 'order_prod_up03', razorpayPaymentId: 'pay_prod_up03' } })
  await safePaymentCreate({ data: { bookingId: bU8_1.id, type: 'PAYMENT', amount: 7497, status: 'CAPTURED', razorpayOrderId: 'order_prod_up04', razorpayPaymentId: 'pay_prod_up04' } })
  await safePaymentCreate({ data: { bookingId: bU9_1.id, type: 'PAYMENT', amount: 20998, status: 'CAPTURED', razorpayOrderId: 'order_prod_up05', razorpayPaymentId: 'pay_prod_up05' } })
  await safePaymentCreate({ data: { bookingId: bU10_1.id, type: 'PAYMENT', amount: 19999, status: 'CAPTURED', razorpayOrderId: 'order_prod_up06', razorpayPaymentId: 'pay_prod_up06' } })
  await safePaymentCreate({ data: { bookingId: bU12_1.id, type: 'PAYMENT', amount: 12998, status: 'CAPTURED', razorpayOrderId: 'order_prod_up07', razorpayPaymentId: 'pay_prod_up07' } })

  console.log('  ✓ Created upcoming trip bookings, requests & payments')

  // ══════════════════════════════════════════════════════
  // ── CONVERSATIONS & MESSAGES ──────────────────────────
  // ══════════════════════════════════════════════════════

  const conv1 = await safeConvCreate({
    data: { tripId: ut.tripU1.id, travelerId: t1.id, organizerProfileId: org1.id, lastMessageAt: d(2026, 5, 5), lastMessagePreview: 'Thanks! Can we bring our own sleeping bags?' },
  })
  await safeMsgCreateMany({ data: [
    { conversationId: conv1.id, senderId: t1.id, content: 'Hi! What should we pack for the Kheerganga trek? Any specific shoes recommended?', readAt: d(2026, 5, 4) },
    { conversationId: conv1.id, senderId: org1User.id, content: 'Hey Amit! Bring sturdy trekking shoes with good grip — the trail gets slippery. Layer up with thermals + fleece. We provide sleeping bags at camp but bring a rain poncho.', readAt: d(2026, 5, 5) },
    { conversationId: conv1.id, senderId: t1.id, content: 'Thanks! Can we bring our own sleeping bags?', readAt: null },
  ] })

  const conv2 = await safeConvCreate({
    data: { tripId: ut.tripU2.id, travelerId: t3.id, organizerProfileId: org2.id, lastMessageAt: d(2026, 5, 3), lastMessagePreview: 'We have a doctor on speed dial and carry oxygen cylinders.' },
  })
  await safeMsgCreateMany({ data: [
    { conversationId: conv2.id, senderId: t3.id, content: 'Is the Spiti trip safe for someone with mild asthma? My wife has a mild condition.', readAt: d(2026, 5, 2) },
    { conversationId: conv2.id, senderId: org2User.id, content: 'Great question, Rohan. We recommend consulting your doctor first. We carry oxygen cylinders and the itinerary includes gradual altitude gain. We have a doctor on speed dial and carry oxygen cylinders.', readAt: d(2026, 5, 3) },
  ] })

  // Admin support conversation
  const conv3 = await safeConvCreate({
    data: { type: 'ADMIN_SUPPORT', travelerId: t9.id, adminId: admin.id, lastMessageAt: d(2026, 5, 6), lastMessagePreview: 'We have extended your payment deadline by 24 hours.' },
  })
  await safeMsgCreateMany({ data: [
    { conversationId: conv3.id, senderId: t9.id, content: 'Hi, my payment for Kasol trek failed but the booking shows pending. Can you help?', readAt: d(2026, 5, 6) },
    { conversationId: conv3.id, senderId: admin.id, content: 'Hi Nikhil, I can see the failed attempt. We have extended your payment deadline by 24 hours. Please try again with a different payment method.', readAt: d(2026, 5, 6) },
  ] })

  console.log('  ✓ Created 3 conversations with messages')

  // ══════════════════════════════════════════════════════
  // ── NOTIFICATIONS ─────────────────────────────────────
  // ══════════════════════════════════════════════════════

  await safeNotifCreateMany({ data: [
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
    await prisma.wallet.upsert({ where: { userId: uid }, update: {}, create: { userId: uid, balance: 0 } })
  }

  // Amit wallet: refund + cashback
  const amitW = await prisma.wallet.findUnique({ where: { userId: t1.id } })
  if (amitW) {
    await safeWalletTxCreate({ data: { walletId: amitW.id, amount: 1500, type: 'REFUND', referenceModel: 'Booking', referenceId: bC1_1.id, description: 'Partial refund for Goa trip date change', balanceBefore: 0, balanceAfter: 1500 } })
    await safeWalletTxCreate({ data: { walletId: amitW.id, amount: 200, type: 'CASHBACK', referenceModel: 'Booking', referenceId: bC3_1.id, description: 'Cashback for Rishikesh Rafting booking', balanceBefore: 1500, balanceAfter: 1700 } })
    await safeWalletTxCreate({ data: { walletId: amitW.id, amount: 500, type: 'PROMOTIONAL_CREDIT', referenceModel: 'User', referenceId: t1.id, description: 'Welcome bonus credit', balanceBefore: 1700, balanceAfter: 2200 } })
    await safeWalletTxCreate({ data: { walletId: amitW.id, amount: 800, type: 'BOOKING_DEDUCTION', referenceModel: 'Booking', referenceId: bU1_1.id, description: 'Wallet used for Kasol trek booking', balanceBefore: 2200, balanceAfter: 1400 } })
    await prisma.wallet.update({ where: { id: amitW.id }, data: { balance: 1400 } })
  }

  // Sneha wallet: admin credit
  const snehaW = await prisma.wallet.findUnique({ where: { userId: t2.id } })
  if (snehaW) {
    await safeWalletTxCreate({ data: { walletId: snehaW.id, amount: 300, type: 'ADMIN_CREDIT', referenceModel: 'User', referenceId: t2.id, description: 'Compensation for delayed trip start on Goa trip', balanceBefore: 0, balanceAfter: 300 } })
    await prisma.wallet.update({ where: { id: snehaW.id }, data: { balance: 300 } })
  }

  // Pooja wallet: promo + expiry
  const poojaW = await prisma.wallet.findUnique({ where: { userId: t10.id } })
  if (poojaW) {
    await safeWalletTxCreate({ data: { walletId: poojaW.id, amount: 500, type: 'PROMOTIONAL_CREDIT', referenceModel: 'User', referenceId: t10.id, description: 'Referral bonus credit', balanceBefore: 0, balanceAfter: 500 } })
    await safeWalletTxCreate({ data: { walletId: poojaW.id, amount: 250, type: 'EXPIRY', referenceModel: 'WalletTransaction', referenceId: 'expired_promo_batch_001', description: 'Promotional credit expired after 90 days', balanceBefore: 500, balanceAfter: 250 } })
    await prisma.wallet.update({ where: { id: poojaW.id }, data: { balance: 250 } })
  }

  // Meera wallet: admin credit + debit
  const meeraW = await prisma.wallet.findUnique({ where: { userId: t8.id } })
  if (meeraW) {
    await safeWalletTxCreate({ data: { walletId: meeraW.id, amount: 1000, type: 'ADMIN_CREDIT', referenceModel: 'User', referenceId: t8.id, description: 'Compensation for trip disruption', balanceBefore: 0, balanceAfter: 1000 } })
    await safeWalletTxCreate({ data: { walletId: meeraW.id, amount: 400, type: 'ADMIN_DEBIT', referenceModel: 'User', referenceId: t8.id, description: 'Admin corrected over-credited amount', balanceBefore: 1000, balanceAfter: 600 } })
    await prisma.wallet.update({ where: { id: meeraW.id }, data: { balance: 600 } })
  }

  console.log('  ✓ Created 19 wallets + 10 wallet transactions (all 7 types)')
  console.log('     amit.kulkarni: ₹1,400 | sneha.deshmukh: ₹300 | pooja.agarwal: ₹250 | meera.bhat: ₹600')
}

// ══════════════════════════════════════════════════════════
// ── BULK TRIPS + REVIEWS (realistic platform data) ───────
// ══════════════════════════════════════════════════════════

const DEST_PHOTOS: Record<string, string[]> = {
  goa: ['https://images.unsplash.com/photo-1652820330085-82a0c2b88d78?w=800', 'https://images.unsplash.com/photo-1590393275627-0c48482c60e3?w=800', 'https://images.unsplash.com/photo-1646748019366-3f1c922bfe3b?w=800'],
  manali: ['https://images.unsplash.com/photo-1692719058797-2954b100c8fe?w=800', 'https://images.unsplash.com/photo-1606667544139-81e47935d769?w=800', 'https://images.unsplash.com/photo-1679407985687-08a86c5c53ba?w=800'],
  ladakh: ['https://images.unsplash.com/photo-1593118845043-359e5f628214?w=800', 'https://images.unsplash.com/photo-1606857090627-27ca46667290?w=800', 'https://images.unsplash.com/photo-1652204597589-962156b9483d?w=800'],
  rishikesh: ['https://images.unsplash.com/photo-1718431108073-7f61fb5dfefb?w=800', 'https://images.unsplash.com/photo-1711992437606-bd676fb6fdf2?w=800', 'https://images.unsplash.com/photo-1718383537411-6f9e727ae0bb?w=800'],
  jaipur: ['https://images.unsplash.com/photo-1595280769531-a25c4c76116a?w=800', 'https://images.unsplash.com/photo-1677868819682-b17554d29622?w=800', 'https://images.unsplash.com/photo-1714168442131-7b10f314915e?w=800'],
  kasol: ['https://images.unsplash.com/photo-1673815994546-9913f4d76b77?w=800', 'https://images.unsplash.com/photo-1609961245797-9cc9231012d8?w=800', 'https://images.unsplash.com/photo-1580465874672-a34623c30beb?w=800'],
  lonavala: ['https://images.unsplash.com/photo-1621578847110-61f6cf5a3d9e?w=800', 'https://images.unsplash.com/photo-1521206644285-8db1549e484f?w=800', 'https://images.unsplash.com/photo-1692626453173-7af2d5b64426?w=800'],
  udaipur: ['https://images.unsplash.com/photo-1622018135960-249abd263aeb?w=800', 'https://images.unsplash.com/photo-1770665567877-72ee8a7c9051?w=800', 'https://images.unsplash.com/photo-1710987759549-db4263464211?w=800'],
  meghalaya: ['https://images.unsplash.com/photo-1552978534-9d01e1f91517?w=800', 'https://images.unsplash.com/photo-1521437620269-f477f5437820?w=800', 'https://images.unsplash.com/photo-1534531409543-069f6204c5b4?w=800'],
  hampi: ['https://images.unsplash.com/photo-1696239105346-4e48185eb001?w=800', 'https://images.unsplash.com/photo-1631986683754-7d511e03864d?w=800', 'https://images.unsplash.com/photo-1631601147889-7260bbb25a1f?w=800'],
  spiti: ['https://images.unsplash.com/photo-1709907153050-a668b4473c47?w=800', 'https://images.unsplash.com/photo-1652131812743-07bc5dde8b91?w=800', 'https://images.unsplash.com/photo-1671609856557-13a95d395fa6?w=800'],
  coorg: ['https://images.unsplash.com/photo-1699819551081-48095fe86265?w=800', 'https://images.unsplash.com/photo-1641701212196-dec15e3bdf59?w=800', 'https://images.unsplash.com/photo-1694537623072-a1172819c577?w=800'],
  varanasi: ['https://images.unsplash.com/photo-1665413793441-13aedeb062d3?w=800', 'https://images.unsplash.com/photo-1728272355917-f41c61fe9842?w=800', 'https://images.unsplash.com/photo-1713922548844-82c63df42ac3?w=800'],
  andaman: ['https://images.unsplash.com/photo-1586359716568-3e1907e4cf9f?w=800', 'https://images.unsplash.com/photo-1704314315344-cd10b9779ce6?w=800', 'https://images.unsplash.com/photo-1497258149552-cf39daacceaa?w=800'],
  dharamshala: ['https://images.unsplash.com/photo-1581321863389-ef7d7bfe4b75?w=800', 'https://images.unsplash.com/photo-1649951692609-cfb7f753b356?w=800', 'https://images.unsplash.com/photo-1641356918719-41ce2f5c15fb?w=800'],
  ooty: ['https://images.unsplash.com/photo-1638886540342-240980f60d25?w=800', 'https://images.unsplash.com/photo-1660918738010-295b09857f93?w=800', 'https://images.unsplash.com/photo-1707655315272-33a54a771068?w=800'],
  rannOfKutch: ['https://images.unsplash.com/photo-1670923331633-be262e035a9a?w=800', 'https://images.unsplash.com/photo-1669015881702-951de590db31?w=800', 'https://images.unsplash.com/photo-1709917524188-3f442929bacd?w=800'],
}

function bulkD(y: number, m: number, day: number) { return new Date(y, m - 1, day) }

// ── Traveler names pool for bulk booking TravelerDetail generation ──
const BULK_FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Ananya', 'Diya', 'Saanvi', 'Aanya', 'Aadhya', 'Isha', 'Myra', 'Pari', 'Riya', 'Tanvi']
const BULK_LAST_NAMES = ['Sharma', 'Patel', 'Gupta', 'Singh', 'Kumar', 'Reddy', 'Joshi', 'Nair', 'Mehta', 'Bhat', 'Rao', 'Iyer', 'Kulkarni', 'Deshmukh', 'Verma', 'Patil', 'Agarwal', 'Tiwari', 'Menon', 'Kaur']
const BULK_GENDERS: Gender[] = ['MALE', 'FEMALE', 'MALE', 'FEMALE', 'MALE', 'MALE', 'FEMALE', 'MALE', 'FEMALE', 'FEMALE']

function generateTravelerDetails(bookingId: string, numTravelers: number, seed: number) {
  const details: { bookingId: string; name: string; phone: string | null; age: number; gender: Gender; isPrimary: boolean; emergencyContactName: string | null; emergencyContactPhone: string | null }[] = []
  for (let i = 0; i < numTravelers; i++) {
    const idx = (seed + i * 7) % BULK_FIRST_NAMES.length
    const lIdx = (seed + i * 3) % BULK_LAST_NAMES.length
    details.push({
      bookingId,
      name: `${BULK_FIRST_NAMES[idx]} ${BULK_LAST_NAMES[lIdx]}`,
      phone: i === 0 ? `+91${9800000000 + seed * 13 + i}` : null,
      age: 22 + ((seed + i) % 20),
      gender: BULK_GENDERS[(seed + i) % BULK_GENDERS.length],
      isPrimary: i === 0,
      emergencyContactName: i === 0 ? `${BULK_FIRST_NAMES[(idx + 5) % BULK_FIRST_NAMES.length]} ${BULK_LAST_NAMES[lIdx]}` : null,
      emergencyContactPhone: i === 0 ? `+91${9800000000 + seed * 13 + 100}` : null,
    })
  }
  return details
}

// ── Constants for booking variety ──
const CANCEL_REASONS = [
  'Work emergency came up', 'Family medical situation', 'Travel plans changed',
  'Leave not approved by manager', 'Financial constraints', 'Found another trip',
  'Health issue — doctor advised rest', 'Weather forecast looks bad',
]
const REQUEST_MSGS = [
  'Would love to join! First solo trip ever — very excited!',
  'Group of 2 friends looking for an adventure this season.',
  'Experienced trekker, done Everest Base Camp. This looks perfect!',
  'Celebrating my birthday month — this trip seems ideal!',
  'Photography enthusiast — will bring my DSLR for group shots.',
  'Solo female traveler, looking for a safe and fun group.',
  'College friends reunion trip — we are 3 people total.',
  'Referred by a friend who went on your last batch. Loved it!',
  'Couple looking for our first adventure trip together.',
  'Weekend warrior here — been eyeing this route for months!',
]
const REJECT_NOTES = [
  'Sorry, this batch is already gender-balanced. Try our next date!',
  'This expedition requires prior trekking experience. Try our beginner trips!',
  'Age requirement not met for this particular expedition.',
]

interface BulkOpts {
  dest: string; orgIdx: number; title: string; slug: string; type: string; mode: string
  desc: string; days: number; price: number; early?: number; min: number; max: number
  booked: number; status: string; cancel: string; sM: number; sD: number; sY: number
  incl: string[]; excl: string[]; itin: string[]
}

async function seedBulkTrips(deps: Record<string, { id: string }>, travelers: { id: string }[]) {
  const { org1, org2, org3, org4, org7, org8 } = deps
  const orgs = [org1, org2, org3, org4, org7, org8]

  // bookingRef has @@unique (format: SFN-2026-XXXX) — resume counter from max existing to survive partial re-runs
  const maxBRef = await prisma.booking.findFirst({ where: { bookingRef: { startsWith: 'SFN-2026-' } }, orderBy: { bookingRef: 'desc' }, select: { bookingRef: true } })
  const maxBRefNum = maxBRef ? parseInt(maxBRef.bookingRef.replace('SFN-2026-', ''), 10) : 0
  let bulkBRef = Math.max(maxBRefNum, 9000)
  // razorpayOrderId has no unique constraint — safe to restart from 600
  let bulkPayN = 600

  async function mk(o: BulkOpts) {
    const photos = DEST_PHOTOS[o.dest] ?? DEST_PHOTOS.goa
    const trip = await upsertTrip(o.slug, {
      organizerId: orgs[o.orgIdx].id, destinationId: deps[o.dest].id,
      title: o.title, description: o.desc,
      tripType: o.type as 'BEACH' | 'TREKKING' | 'ADVENTURE' | 'CULTURAL' | 'WEEKEND' | 'ROAD_TRIP',
      bookingMode: o.mode as 'INSTANT' | 'REQUEST_BASED',
      status: o.status as 'ACTIVE' | 'FULL' | 'COMPLETED',
      startDate: bulkD(o.sY, o.sM, o.sD), endDate: bulkD(o.sY, o.sM, o.sD + o.days - 1),
      pricePerPerson: o.price, ...(o.early ? { earlyBirdPrice: o.early } : {}),
      minGroupSize: o.min, maxGroupSize: o.max, currentBookings: o.booked,
      acceptingBookings: o.status === 'ACTIVE', inclusions: o.incl, exclusions: o.excl,
      cancellationPolicy: o.cancel as 'FLEXIBLE' | 'MODERATE' | 'STRICT', photos,
      itinerary: o.itin.map((t, i) => ({ day: i + 1, title: t, description: t })),
    }, [
      { type: TransferPointType.PICKUP, label: 'Pune — Shivaji Nagar Bus Stand', address: 'Shivaji Nagar Bus Depot, Pune 411005', time: '06:00 AM', sortOrder: 0 },
      { type: TransferPointType.PICKUP, label: 'Pune — Swargate ST Stand', address: 'Swargate Bus Depot, Pune 411042', time: '06:30 AM', sortOrder: 1 },
      { type: TransferPointType.PICKUP, label: 'Mumbai — Dadar Station (East)', address: 'Dadar TT, Mumbai 400014', time: '10:00 PM', extraCharge: 500, sortOrder: 2 },
      { type: TransferPointType.DROP, label: 'Pune — Swargate ST Stand', address: 'Swargate Bus Depot, Pune 411042', time: '08:00 PM', sortOrder: 0 },
      { type: TransferPointType.DROP, label: 'Pune — Hinjewadi IT Park', address: 'Phase 1 Gate, Hinjewadi, Pune 411057', time: '09:00 PM', extraCharge: 200, sortOrder: 1 },
    ])

    // ── Sentinel: skip bookings if already seeded for this trip ──
    const existingBookings = await prisma.booking.count({ where: { tripId: trip.id } })
    if (existingBookings > 0) return trip

    const isCompleted = o.status === 'COMPLETED'
    const isFull = o.status === 'FULL'
    const isRequest = o.mode === 'REQUEST_BASED'
    const bStatus: 'CONFIRMED' | 'COMPLETED' = isCompleted ? 'COMPLETED' : 'CONFIRMED'

    // Track userIds with TripRequests for this trip — @@unique([tripId, userId])
    const usedRequestUserIds = new Set<string>()
    // Pick a traveler that hasn't been used for a TripRequest on this trip
    const pickUnique = (startIdx: number): { id: string } | null => {
      for (let attempt = 0; attempt < travelers.length; attempt++) {
        const t = travelers[(startIdx + attempt) % travelers.length]
        if (!usedRequestUserIds.has(t.id)) return t
      }
      return null // all 50 used (shouldn't happen with 50 travelers and <30 requests)
    }

    // ── 1. Core bookings (CONFIRMED/COMPLETED) summing to o.booked ──
    // First ~30% of bookings use earlyBirdPrice when available
    const earlyBirdCap = o.early ? Math.ceil(o.booked * 0.3) : 0
    let earlyBirdUsed = 0
    let remaining = o.booked
    let idx = 0
    while (remaining > 0) {
      const numT = Math.min(remaining, 1 + (idx % 3)) // cycles 1, 2, 3
      const trav = travelers[idx % travelers.length]
      const unitPrice = (o.early && earlyBirdUsed < earlyBirdCap) ? o.early : o.price
      const amount = unitPrice * numT
      if (o.early && earlyBirdUsed < earlyBirdCap) earlyBirdUsed += numT
      const b = await safeBookingCreate({ data: {
        bookingRef: `SFN-2026-${String(++bulkBRef).padStart(4, '0')}`,
        tripId: trip.id, userId: trav.id,
        numTravelers: numT, totalAmount: amount, bookingStatus: bStatus,
      }})
      await safeTravelerCreateMany({ data: generateTravelerDetails(b.id, numT, bulkBRef + idx) })
      await safePaymentCreate({ data: {
        bookingId: b.id, type: 'PAYMENT', amount, status: 'CAPTURED',
        razorpayOrderId: `order_mk_${++bulkPayN}`, razorpayPaymentId: `pay_mk_${bulkPayN}`,
      }})
      // For REQUEST_BASED: link an APPROVED TripRequest
      if (isRequest) {
        usedRequestUserIds.add(trav.id)
        await safeTripRequestCreate({ data: {
          tripId: trip.id, userId: trav.id, numTravelers: numT,
          message: REQUEST_MSGS[idx % REQUEST_MSGS.length],
          status: 'APPROVED', respondedAt: new Date(Date.now() - (20 + idx) * 86400000),
          responseNote: 'Welcome aboard! Payment link sent.', bookingId: b.id,
        }})
      }
      remaining -= numT
      idx++
    }

    // ── 2. PENDING_PAYMENT bookings (don't count in currentBookings) ──
    if (!isCompleted && !isFull) {
      const ppCount = isRequest ? 2 + (bulkBRef % 3) : 1 + (bulkBRef % 2) // 2-4 for request, 1-2 for instant
      for (let p = 0; p < ppCount; p++) {
        const trav = travelers[(idx + p + 20) % travelers.length]
        const numT = 1 + (p % 2)
        const amount = o.price * numT
        const b = await safeBookingCreate({ data: {
          bookingRef: `SFN-2026-${String(++bulkBRef).padStart(4, '0')}`,
          tripId: trip.id, userId: trav.id,
          numTravelers: numT, totalAmount: amount,
          bookingStatus: 'PENDING_PAYMENT',
          expiresAt: new Date(Date.now() + (1 + p) * 86400000),
        }})
        await safeTravelerCreateMany({ data: generateTravelerDetails(b.id, numT, bulkBRef + p + 300) })
        // Initiated (not yet captured) payment for PENDING_PAYMENT
        await safePaymentCreate({ data: {
          bookingId: b.id, type: 'PAYMENT', amount, status: 'INITIATED',
          razorpayOrderId: `order_pp_${bulkPayN++}`,
        }})
        if (isRequest) {
          usedRequestUserIds.add(trav.id)
          await safeTripRequestCreate({ data: {
            tripId: trip.id, userId: trav.id, numTravelers: numT,
            message: REQUEST_MSGS[(idx + p + 3) % REQUEST_MSGS.length],
            status: 'APPROVED', respondedAt: new Date(Date.now() - (5 + p) * 86400000),
            responseNote: 'Approved! Please complete payment within 48 hours.', bookingId: b.id,
          }})
        }
      }
    }

    // ── 3. CANCELLED bookings (paid → cancelled → refunded) ──
    if (!isFull) {
      const cancelCount = isCompleted ? (idx % 2) : 1 + (idx % 2) // 0-1 for completed, 1-2 for active
      for (let c = 0; c < cancelCount; c++) {
        const trav = travelers[(idx + c + 30) % travelers.length]
        const amount = o.price
        const cancelDate = new Date(Date.now() - (25 + c * 5) * 86400000)
        const b = await safeBookingCreate({ data: {
          bookingRef: `SFN-2026-${String(++bulkBRef).padStart(4, '0')}`,
          tripId: trip.id, userId: trav.id,
          numTravelers: 1, totalAmount: amount,
          bookingStatus: 'CANCELLED',
          cancellationReason: CANCEL_REASONS[(idx + c) % CANCEL_REASONS.length],
          cancelledAt: cancelDate,
          cancelledById: trav.id,
        }})
        // Original CAPTURED payment (paid before cancellation)
        const payDate = new Date(cancelDate.getTime() - 5 * 86400000)
        await safePaymentCreate({ data: {
          bookingId: b.id, type: 'PAYMENT', amount, status: 'CAPTURED',
          razorpayOrderId: `order_cx_${++bulkPayN}`, razorpayPaymentId: `pay_cx_${bulkPayN}`,
          createdAt: payDate,
        }})
        // REFUND issued after cancellation (net revenue impact = 0)
        await safePaymentCreate({ data: {
          bookingId: b.id, type: 'REFUND', amount, status: 'CAPTURED',
          razorpayOrderId: `order_cx_${bulkPayN}`, razorpayPaymentId: `rfnd_cx_${bulkPayN}`,
          createdAt: new Date(cancelDate.getTime() + 1 * 86400000),
        }})
      }
    }

    // ── 4. Pending TripRequests (REQUEST_BASED, non-completed only) ──
    if (isRequest && !isCompleted) {
      const pendingCount = 3 + (bulkBRef % 3) // 3-5
      for (let pr = 0; pr < pendingCount; pr++) {
        const trav = pickUnique(idx + pr + 35)
        if (!trav) break
        usedRequestUserIds.add(trav.id)
        const numT = 1 + (pr % 3)
        await safeTripRequestCreate({ data: {
          tripId: trip.id, userId: trav.id, numTravelers: numT,
          message: REQUEST_MSGS[(idx + pr) % REQUEST_MSGS.length],
          status: 'PENDING', approvalExpiresAt: new Date(Date.now() + 7 * 86400000),
        }})
      }
      // 1-2 rejected requests
      const rejCount = 1 + (idx % 2)
      for (let rj = 0; rj < rejCount; rj++) {
        const trav = pickUnique(idx + rj + 42)
        if (!trav) break
        usedRequestUserIds.add(trav.id)
        await safeTripRequestCreate({ data: {
          tripId: trip.id, userId: trav.id, numTravelers: 1,
          message: REQUEST_MSGS[(idx + rj + 5) % REQUEST_MSGS.length],
          status: 'REJECTED', respondedAt: new Date(Date.now() - (10 + rj * 3) * 86400000),
          responseNote: REJECT_NOTES[rj % REJECT_NOTES.length],
        }})
      }
    }

    return trip
  }

  // ── GOA (6) ────────────────────────────────────────────
  await mk({ dest: 'goa', orgIdx: 0, title: 'Goa New Year Beach Bash — 3N/4D Party Special from Pune', slug: 'goa-new-year-bash-dec-2026', type: 'BEACH', mode: 'INSTANT', desc: 'Ring in 2027 on golden sands of North Goa! Beach parties at Anjuna & Vagator, NYE countdown, water sports, Dudhsagar day trip, authentic seafood. AC Volvo from Pune.', days: 4, price: 8999, early: 7499, min: 12, max: 30, booked: 18, status: 'ACTIVE', cancel: 'STRICT', sM: 12, sD: 29, sY: 2026, incl: ['AC bus Pune-Goa-Pune', 'Resort (3N)', 'All meals', 'NYE party pass', 'Water sports'], excl: ['Alcohol', 'Personal expenses'], itin: ['Arrive & Beach Hopping — Calangute, Baga, Anjuna', 'Dudhsagar Falls & Spice Farm', 'Water Sports & NYE Party', 'Sunrise Swim & Departure'] })
  await mk({ dest: 'goa', orgIdx: 2, title: 'South Goa Wellness Retreat — 4N/5D Yoga & Nature', slug: 'south-goa-wellness-oct-2026', type: 'WEEKEND', mode: 'INSTANT', desc: 'Pristine beaches, daily yoga at Agonda, Ayurvedic spa, mangrove kayaking, dolphins, silent walks at Cola and Butterfly beaches.', days: 5, price: 12499, early: 10999, min: 6, max: 14, booked: 8, status: 'ACTIVE', cancel: 'MODERATE', sM: 10, sD: 15, sY: 2026, incl: ['Eco-resort (4N)', 'Organic meals', 'Daily yoga', 'Spa session', 'Kayaking', 'Dolphin trip'], excl: ['Travel to Goa', 'Alcohol'], itin: ['Arrival & Sunset Yoga', 'Spa & Butterfly Beach', 'Kayaking & Dolphins', 'Cola Beach & Cooking Class', 'Meditation & Departure'] })
  await mk({ dest: 'goa', orgIdx: 0, title: 'Goa Holi Beach Festival — 2N/3D Color Splash', slug: 'goa-holi-festival-mar-2026', type: 'BEACH', mode: 'INSTANT', desc: 'Holi on the beach! Organic colors at Morjim, pool party, carnival vibes, North Goa nightlife.', days: 3, price: 5499, min: 15, max: 30, booked: 28, status: 'COMPLETED', cancel: 'FLEXIBLE', sM: 3, sD: 12, sY: 2026, incl: ['Bus from Pune', 'Resort (2N)', 'All meals', 'Holi party', 'Pool party'], excl: ['Alcohol', 'Shopping'], itin: ['Arrival & Beach Chill', 'Holi Beach Party — Colors, Pool, DJ', 'Cruise & Departure'] })
  await mk({ dest: 'goa', orgIdx: 1, title: 'Goa Scuba Diving & Snorkeling — 2N/3D Grande Island', slug: 'goa-scuba-diving-nov-2026', type: 'ADVENTURE', mode: 'INSTANT', desc: 'PADI-certified scuba at Grande Island! Snorkeling at coral reefs, island hopping, fresh catch BBQ. Perfect visibility season.', days: 3, price: 7999, early: 6999, min: 8, max: 16, booked: 5, status: 'ACTIVE', cancel: 'MODERATE', sM: 11, sD: 14, sY: 2026, incl: ['Scuba dive (PADI)', 'Snorkeling gear', 'Island boat', 'Resort (2N)', 'All meals'], excl: ['Travel to Goa', 'Underwater camera'], itin: ['Arrival & Pool Training', 'Grande Island Dive & Snorkel', 'North Goa & Departure'] })
  await mk({ dest: 'goa', orgIdx: 3, title: 'Goa Dudhsagar Monsoon Trek — 1N/2D from Pune', slug: 'goa-dudhsagar-trek-aug-2026', type: 'TREKKING', mode: 'INSTANT', desc: 'India\'s 5th tallest waterfall in full monsoon! 11 km trek through Bhagwan Mahavir sanctuary, natural pools, spice plantation camping.', days: 2, price: 3499, min: 12, max: 25, booked: 25, status: 'FULL', cancel: 'FLEXIBLE', sM: 8, sD: 15, sY: 2026, incl: ['Bus from Pune', 'Trek guide', 'Camp (1N)', 'All meals', 'Plantation visit'], excl: ['Rain gear', 'Snacks'], itin: ['11 km Jungle Trek to Dudhsagar Base, Campfire', 'Waterfall Viewpoint, Spice Plantation, Return'] })
  await mk({ dest: 'goa', orgIdx: 2, title: 'Goa Heritage Walk — 3N/4D Architecture & Culture Trail', slug: 'goa-heritage-walk-feb-2026', type: 'CULTURAL', mode: 'INSTANT', desc: 'Portuguese churches, Fontainhas Latin Quarter, 450-year-old Basilica, Chandor heritage homes, Reis Magos Fort. Goa beyond beaches.', days: 4, price: 7499, min: 6, max: 16, booked: 14, status: 'COMPLETED', cancel: 'MODERATE', sM: 2, sD: 5, sY: 2026, incl: ['Heritage hotel (3N)', 'All meals', 'Museum entries', 'Guide', 'Feni tasting'], excl: ['Travel to Goa', 'Shopping'], itin: ['Old Goa Churches — Se Cathedral, Basilica', 'Fontainhas Latin Quarter Walk', 'Chandor Homes & Mangueshi Temple', 'Reis Magos Fort & Departure'] })
  console.log('  ✓ Bulk: Goa (6)')

  // ── MANALI (5) ─────────────────────────────────────────
  await mk({ dest: 'manali', orgIdx: 1, title: 'Manali Winter Wonderland — 4N/5D Snow Holiday from Delhi', slug: 'manali-winter-jan-2027', type: 'ADVENTURE', mode: 'INSTANT', desc: 'Fresh snowfall, Solang skiing, igloo stay, Vashisht hot springs, Old Manali cafe hopping. AC Volvo from Delhi.', days: 5, price: 9999, early: 8499, min: 8, max: 20, booked: 6, status: 'ACTIVE', cancel: 'MODERATE', sM: 1, sD: 5, sY: 2027, incl: ['Delhi-Manali Volvo', 'Cottage (4N)', 'All meals', 'Skiing', 'Igloo', 'Bonfire'], excl: ['Paragliding', 'Shopping'], itin: ['Arrival & Old Manali Cafe Hop', 'Solang Valley Skiing & Snow Tubing', 'Atal Tunnel & Sissu Frozen Waterfalls', 'Igloo Stay & Vashisht Hot Springs', 'Mall Road & Departure'] })
  await mk({ dest: 'manali', orgIdx: 0, title: 'Hampta Pass Trek — 4N/5D Himalayan Crossing', slug: 'hampta-pass-trek-sep-2026', type: 'TREKKING', mode: 'REQUEST_BASED', desc: 'Cross from Kullu to Lahaul via Hampta Pass (4,270m). River crossings, alpine meadows, Chandratal Lake. Perfect moderate trek.', days: 5, price: 8499, early: 7499, min: 8, max: 15, booked: 10, status: 'ACTIVE', cancel: 'STRICT', sM: 9, sD: 12, sY: 2026, incl: ['Camping gear', 'All meals', 'Guide + cook', 'Manali transport', 'Permits'], excl: ['Travel to Manali', 'Personal gear'], itin: ['Manali to Chika via Jobra', 'Chika to Balu Ka Ghera', 'Hampta Pass Summit (4,270m)', 'Chandratal Lake & Stargazing', 'Return to Manali'] })
  await mk({ dest: 'manali', orgIdx: 2, title: 'Manali Cherry Blossom Spring — 3N/4D Pink Valley', slug: 'manali-cherry-blossom-apr-2026', type: 'WEEKEND', mode: 'INSTANT', desc: 'Pink wonderland when cherry blossoms bloom. Riverside picnics, Naggar Castle, Van Vihar walk, Old Manali heritage.', days: 4, price: 7999, min: 8, max: 18, booked: 16, status: 'COMPLETED', cancel: 'MODERATE', sM: 4, sD: 5, sY: 2026, incl: ['Cottage (3N)', 'All meals', 'Naggar trip', 'Nature walks', 'Bonfire'], excl: ['Travel to Manali'], itin: ['Cherry Blossom Valley Walk', 'Naggar Castle & Roerich Gallery', 'Van Vihar & Old Manali', 'Morning Walk & Departure'] })
  await mk({ dest: 'manali', orgIdx: 1, title: 'Manali Paragliding & Rafting Combo — 2N/3D', slug: 'manali-paragliding-jul-2026', type: 'ADVENTURE', mode: 'INSTANT', desc: 'Fly over Solang, conquer Beas rapids! Tandem paragliding, 14 km rafting, ATV rides, riverside camping.', days: 3, price: 6999, min: 10, max: 20, booked: 12, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 7, sD: 18, sY: 2026, incl: ['Paragliding', '14 km rafting', 'Camp (2N)', 'All meals', 'ATV', 'Bonfire'], excl: ['Travel to Manali', 'GoPro'], itin: ['Riverside Camp, ATV, Bonfire', 'Paragliding & Beas Rafting', 'Solang Zorbing & Departure'] })
  await mk({ dest: 'manali', orgIdx: 2, title: 'Manali Photography Expedition — 5N/6D Golden Hour', slug: 'manali-photography-oct-2026', type: 'CULTURAL', mode: 'REQUEST_BASED', desc: 'Capture the Himalayas with a pro! Golden hour shoots, Old Manali portraits, startrails, Lightroom workshops. Max 10 photographers.', days: 6, price: 15999, min: 6, max: 10, booked: 4, status: 'ACTIVE', cancel: 'STRICT', sM: 10, sD: 10, sY: 2026, incl: ['Cottage (5N)', 'All meals', 'Photo mentorship', 'Transport', 'Lightroom workshop'], excl: ['Camera gear', 'Travel to Manali'], itin: ['Beas River Golden Hour', 'Solang Sunrise Shoot', 'Old Manali Streets', 'Atal Tunnel Landscapes', 'Star Trail Night Shoot', 'Portfolio Review & Departure'] })
  console.log('  ✓ Bulk: Manali (5)')

  // ── LADAKH (4) ─────────────────────────────────────────
  await mk({ dest: 'ladakh', orgIdx: 1, title: 'Ladakh Frozen Chadar Trek — 7N/8D Winter Expedition', slug: 'ladakh-chadar-trek-jan-2027', type: 'TREKKING', mode: 'REQUEST_BASED', desc: 'Walk on frozen Zanskar River! Sub-zero camping, ice caves, frozen waterfalls. Experienced trekkers only. Medical cert required.', days: 8, price: 29999, early: 26999, min: 6, max: 10, booked: 4, status: 'ACTIVE', cancel: 'STRICT', sM: 1, sD: 15, sY: 2027, incl: ['Leh pickup', 'Camping gear', 'All meals', 'Guide + cook', 'Permits', 'Oxygen'], excl: ['Flights', 'Winter gear', 'Insurance'], itin: ['Arrive Leh — Acclimatize', 'Leh Palace & Stupa', 'Start Chadar Trek', 'Ice Caves Walk', 'Nerak Frozen Waterfall', 'Return Chadar', 'Drive to Leh', 'Departure'] })
  await mk({ dest: 'ladakh', orgIdx: 1, title: 'Ladakh SUV Road Trip — 5N/6D Nubra & Pangong', slug: 'ladakh-suv-trip-aug-2026', type: 'ROAD_TRIP', mode: 'INSTANT', desc: 'All of Ladakh by Innova! Nubra Valley dunes, Pangong camping, Khardung La, Hemis Monastery, Magnetic Hill. No bike needed.', days: 6, price: 18999, early: 16999, min: 6, max: 14, booked: 7, status: 'ACTIVE', cancel: 'MODERATE', sM: 8, sD: 10, sY: 2026, incl: ['Leh pickup/drop', 'Hotels + camps (5N)', 'All meals', 'Innova', 'Permits', 'Oxygen'], excl: ['Flights', 'AMS medicine'], itin: ['Arrive Leh — Rest', 'Leh Palace, Stupa, Hall of Fame', 'Nubra via Khardung La', 'Nubra to Pangong Lake', 'Pangong to Leh via Chang La', 'Magnetic Hill & Airport'] })
  await mk({ dest: 'ladakh', orgIdx: 1, title: 'Ladakh Mountain Biking — 6N/7D Pedal the Passes', slug: 'ladakh-mtb-sep-2026', type: 'ADVENTURE', mode: 'REQUEST_BASED', desc: 'Cycle the highest passes on premium MTBs! Khardung La, More Plains, Pangong route. Support vehicle included. Serious cyclists only.', days: 7, price: 24999, min: 4, max: 8, booked: 3, status: 'ACTIVE', cancel: 'STRICT', sM: 9, sD: 5, sY: 2026, incl: ['MTB rental', 'Support vehicle', 'All stays', 'All meals', 'Guide', 'Permits'], excl: ['Flights', 'Cycling gear'], itin: ['Arrive — Bike Fitting', 'South Pullu Warm-up', 'Khardung La Summit', 'Hemis Route', 'Chang La Approach', 'Pangong Camp', 'Return to Leh'] })
  await mk({ dest: 'ladakh', orgIdx: 2, title: 'Ladakh Family Tour — 4N/5D Kid-Friendly Sightseeing', slug: 'ladakh-family-jul-2025', type: 'CULTURAL', mode: 'INSTANT', desc: 'Ladakh with kids! Gentle acclimatization, short drives, Shanti Stupa, Hemis, Magnetic Hill. No extreme passes for safety.', days: 5, price: 14999, min: 8, max: 18, booked: 12, status: 'COMPLETED', cancel: 'MODERATE', sM: 7, sD: 10, sY: 2025, incl: ['Leh hotel (4N)', 'Kid meals', 'Innova', 'All entries', 'Medical kit'], excl: ['Flights'], itin: ['Arrive — Easy Day', 'Leh Palace & Stupa', 'Hemis & Thiksey', 'Magnetic Hill & Sangam', 'Shopping & Departure'] })
  console.log('  ✓ Bulk: Ladakh (4)')

  // ──────── PART 2 below ─────────
  await seedBulkPart2(deps, mk)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedBulkPart2(deps: Record<string, { id: string }>, mk: (o: BulkOpts) => Promise<any>) {
  // ── RISHIKESH (5) ──────────────────────────────────────
  await mk({ dest: 'rishikesh', orgIdx: 0, title: 'Rishikesh Yoga Retreat — 4N/5D Ganges Immersion', slug: 'rishikesh-yoga-retreat-oct-2026', type: 'WEEKEND', mode: 'INSTANT', desc: 'Deep yoga on the banks of the Ganges! Daily Ashtanga & Hatha, Pranayama workshops, silent meditation, Ayurvedic meals, evening Ganga Aarti. Certified instructors.', days: 5, price: 9999, early: 8499, min: 8, max: 16, booked: 10, status: 'ACTIVE', cancel: 'MODERATE', sM: 10, sD: 1, sY: 2026, incl: ['Ashram (4N)', 'Ayurvedic meals', 'Daily yoga', 'Meditation', 'Aarti', 'Certificate'], excl: ['Travel', 'Personal expenses'], itin: ['Arrival & Opening Circle', 'Ashtanga & Pranayama', 'Silent Forest Walk & Ganga Meditation', 'Advanced Practice & Philosophy', 'Closing Ceremony'] })
  await mk({ dest: 'rishikesh', orgIdx: 3, title: 'Rishikesh Bungee & Giant Swing Combo — 1N/2D', slug: 'rishikesh-bungee-swing-nov-2026', type: 'ADVENTURE', mode: 'INSTANT', desc: 'India\'s highest bungee (83m) AND giant swing in one weekend! Riverside camping, bonfire, morning yoga by the Ganges.', days: 2, price: 5999, min: 10, max: 20, booked: 16, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 11, sD: 8, sY: 2026, incl: ['Delhi bus', 'Bungee + Swing', 'Camp (1N)', 'All meals', 'Bonfire'], excl: ['Flying fox (optional)'], itin: ['Bungee 83m, Giant Swing, Camp', 'Yoga, Lakshman Jhula, Departure'] })
  await mk({ dest: 'rishikesh', orgIdx: 0, title: 'Rishikesh Kayaking School — 3N/4D Learn to Kayak on Ganges', slug: 'rishikesh-kayaking-school-oct-2026', type: 'ADVENTURE', mode: 'REQUEST_BASED', desc: 'Whitewater kayaking from pool to river! ACA-certified 4-day program on the Ganges with 10 km expedition finale.', days: 4, price: 11999, min: 4, max: 8, booked: 3, status: 'ACTIVE', cancel: 'STRICT', sM: 10, sD: 20, sY: 2026, incl: ['Kayak + gear', 'Instructor', 'Camp (3N)', 'All meals', 'ACA certificate'], excl: ['Travel', 'Waterproof bag'], itin: ['Pool Training & Theory', 'Flat Water Skills', 'Grade II Whitewater', '10 km Expedition & Certification'] })
  await mk({ dest: 'rishikesh', orgIdx: 3, title: 'Rishikesh New Year Camping & Rafting — 2N/3D', slug: 'rishikesh-new-year-camp-dec-2026', type: 'ADVENTURE', mode: 'INSTANT', desc: 'Ring in 2027 by the Ganges! NYE bonfire, 16 km rafting, cliff jumping, sunrise yoga. Live music and unlimited chai.', days: 3, price: 6499, early: 5499, min: 15, max: 30, booked: 22, status: 'ACTIVE', cancel: 'STRICT', sM: 12, sD: 30, sY: 2026, incl: ['Delhi bus', 'Camp (2N)', 'All meals', '16 km rafting', 'NYE party', 'Bonfire'], excl: ['Alcohol', 'Bungee'], itin: ['Arrival & Riverside Camp', 'Rafting & NYE Countdown', 'Sunrise Yoga & Departure'] })
  await mk({ dest: 'rishikesh', orgIdx: 0, title: 'Rishikesh Monsoon Waterfall Trek — 1N/2D', slug: 'rishikesh-waterfall-trek-aug-2025', type: 'TREKKING', mode: 'INSTANT', desc: 'Hidden waterfalls in Rajaji forest, swollen streams, monsoon Ganges. Night camping with hot chai and pakoras.', days: 2, price: 2999, min: 12, max: 24, booked: 20, status: 'COMPLETED', cancel: 'FLEXIBLE', sM: 8, sD: 22, sY: 2025, incl: ['Delhi bus', 'Guide', 'Camp (1N)', 'All meals', 'Rain ponchos'], excl: ['Trekking shoes'], itin: ['Jungle Trail to Hidden Waterfalls, Camp', 'Ganges Viewpoint, Aarti, Departure'] })
  console.log('  ✓ Bulk: Rishikesh (5)')

  // ── JAIPUR (4) ─────────────────────────────────────────
  await mk({ dest: 'jaipur', orgIdx: 2, title: 'Jaipur Diwali Light Festival — 2N/3D Pink City Celebration', slug: 'jaipur-diwali-festival-oct-2026', type: 'CULTURAL', mode: 'INSTANT', desc: 'Diwali in the Pink City! Nahargarh Fort lit with 10,000 diyas, Amer Fort light show, traditional puja, sweets workshop, Johari Bazaar shopping.', days: 3, price: 8999, early: 7999, min: 8, max: 18, booked: 14, status: 'ACTIVE', cancel: 'MODERATE', sM: 10, sD: 20, sY: 2026, incl: ['Haveli (2N)', 'All meals', 'Diwali puja', 'Amer show', 'Sweet workshop', 'AC transport'], excl: ['Train/flight', 'Shopping budget'], itin: ['Arrival & Decorated Bazaars', 'Amer Fort, Sweets Workshop, Puja', 'Johari Bazaar & Departure'] })
  await mk({ dest: 'jaipur', orgIdx: 2, title: 'Jaipur Hot Air Balloon & Camel Safari — 2N/3D', slug: 'jaipur-balloon-safari-nov-2026', type: 'ADVENTURE', mode: 'INSTANT', desc: 'See the Pink City from the sky! Sunrise balloon over Amber Fort, camel safari, Rajasthani folk dinner, Nahargarh stargazing.', days: 3, price: 12999, early: 11499, min: 6, max: 12, booked: 5, status: 'ACTIVE', cancel: 'STRICT', sM: 11, sD: 14, sY: 2026, incl: ['Balloon ride', 'Camel safari', 'Heritage stay (2N)', 'All meals', 'Folk dinner'], excl: ['Flight/train'], itin: ['Hawa Mahal, City Palace, Nahargarh Sunset', 'Sunrise Balloon, Camel Ride, Folk Dinner', 'Amber Fort & Departure'] })
  await mk({ dest: 'jaipur', orgIdx: 3, title: 'Jaipur-Pushkar Camel Fair — 3N/4D Cultural Festival', slug: 'jaipur-pushkar-fair-nov-2026', type: 'CULTURAL', mode: 'INSTANT', desc: 'World-famous Pushkar Camel Fair! Thousands of camels, folk competitions, desert camping, Pushkar Lake holy dip, Brahma Temple.', days: 4, price: 9499, min: 10, max: 22, booked: 22, status: 'FULL', cancel: 'MODERATE', sM: 11, sD: 6, sY: 2026, incl: ['Jaipur hotel (2N) + Pushkar camp (1N)', 'All meals', 'Fair entry', 'Desert camp', 'AC bus'], excl: ['Train/flight', 'Camel ride (₹300)'], itin: ['Jaipur — Amber Fort, Hawa Mahal', 'Pushkar — Camel Fair & Folk Shows', 'Pushkar Lake, Brahma Temple, Desert Camp', 'Return to Jaipur & Departure'] })
  await mk({ dest: 'jaipur', orgIdx: 0, title: 'Ranthambore Tiger Safari + Jaipur Heritage — 3N/4D', slug: 'ranthambore-tiger-jaipur-sep-2025', type: 'ADVENTURE', mode: 'INSTANT', desc: 'Spot the Royal Bengal Tiger at Ranthambore! Two safari drives in open Canter, plus Jaipur forts and palaces. Jungle lodge + heritage haveli.', days: 4, price: 11999, early: 10499, min: 8, max: 16, booked: 10, status: 'COMPLETED', cancel: 'STRICT', sM: 9, sD: 18, sY: 2025, incl: ['Lodge (2N) + Haveli (1N)', 'All meals', '2 safaris', 'Park entry', 'Jaipur tour', 'AC transport'], excl: ['Train/flight'], itin: ['Jaipur — Amber Fort & Hawa Mahal', 'Drive to Ranthambore, Afternoon Safari', 'Double Safari — Sunrise & Sunset', 'Nature Walk, Drive to Jaipur, Departure'] })
  console.log('  ✓ Bulk: Jaipur (4)')

  // ── KASOL (4) ──────────────────────────────────────────
  await mk({ dest: 'kasol', orgIdx: 0, title: 'Sar Pass Trek — 4N/5D High Altitude Himalayan Crossing', slug: 'sar-pass-trek-jun-2026', type: 'TREKKING', mode: 'REQUEST_BASED', desc: 'Cross legendary Sar Pass (4,200m) through snow fields and pine forests! Snow slides, alpine camps, 360° Himalayan panoramas.', days: 5, price: 7999, early: 6999, min: 8, max: 15, booked: 9, status: 'ACTIVE', cancel: 'STRICT', sM: 6, sD: 8, sY: 2026, incl: ['Camping gear', 'All meals', 'Guide + cook', 'Transport', 'Permits'], excl: ['Travel to Kasol', 'Personal gear'], itin: ['Kasol to Grahan Village', 'Grahan to Min Thatch — Meadows', 'Min Thatch to Nagaru — Snow Fields', 'Sar Pass Summit (4,200m) & Snow Slide', 'Biskeri to Kasol'] })
  await mk({ dest: 'kasol', orgIdx: 3, title: 'Kasol Hippie Trail Weekend — 2N/3D Backpacker Special', slug: 'kasol-hippie-trail-sep-2026', type: 'WEEKEND', mode: 'INSTANT', desc: 'The ultimate Kasol chill weekend! Israeli cafes, Chalal village walk, Tosh camping, Manikaran hot springs, riverside bonfires.', days: 3, price: 3999, min: 10, max: 20, booked: 14, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 9, sD: 19, sY: 2026, incl: ['Delhi bus', 'Camp (2N)', 'All meals', 'Tosh trek', 'Manikaran', 'Bonfire'], excl: ['Cafe meals'], itin: ['Arrive & Chalal Village, Bonfire', 'Tosh Trek & Manikaran Hot Springs', 'Cafe Hopping & Departure'] })
  await mk({ dest: 'kasol', orgIdx: 0, title: 'Kasol to Malana Trek — 3N/4D Hidden Village Expedition', slug: 'kasol-malana-trek-apr-2026', type: 'TREKKING', mode: 'REQUEST_BASED', desc: 'Trek to ancient Malana village through dense forests, Malana dam, and remote Waichin Valley. Culturally fascinating and physically rewarding.', days: 4, price: 5999, min: 8, max: 14, booked: 11, status: 'COMPLETED', cancel: 'MODERATE', sM: 4, sD: 10, sY: 2026, incl: ['Camp (3N)', 'All meals', 'Guide', 'Base camp'], excl: ['Travel to Kasol', 'Porter'], itin: ['Kasol to Rasol Village', 'Rasol to Malana — Forest Trek', 'Malana to Waichin Valley', 'Return to Kasol via Dam'] })
  await mk({ dest: 'kasol', orgIdx: 3, title: 'Kasol Winter Snow Trek — 3N/4D Frozen Parvati Valley', slug: 'kasol-winter-snow-dec-2026', type: 'TREKKING', mode: 'INSTANT', desc: 'Kasol in winter! Snow-covered pines, frozen Parvati River, Tosh in white, hot chai at riverside camps. Easy winter trek for beginners.', days: 4, price: 5499, early: 4499, min: 8, max: 16, booked: 6, status: 'ACTIVE', cancel: 'MODERATE', sM: 12, sD: 20, sY: 2026, incl: ['Delhi bus', 'Camp (3N)', 'All meals', 'Snow guide', 'Bonfire', 'Tosh visit'], excl: ['Winter gear rental'], itin: ['Arrive & Riverside Snow Walk', 'Tosh Snow Trek & Hot Springs', 'Kheerganga Approach & Forest Camp', 'Morning Chai & Departure'] })
  console.log('  ✓ Bulk: Kasol (4)')

  // ── LONAVALA (5) ───────────────────────────────────────
  await mk({ dest: 'lonavala', orgIdx: 3, title: 'Lohagad Fort Sunrise Trek — Day Trip from Pune', slug: 'lohagad-sunrise-trek-oct-2026', type: 'TREKKING', mode: 'INSTANT', desc: 'Sunrise from 4,600 ft Lohagad Fort! Pre-dawn drive, Vinchukata (Scorpion Tail) ridge, twin fort exploration. Perfect Sunday morning.', days: 1, price: 999, min: 15, max: 30, booked: 25, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 10, sD: 12, sY: 2026, incl: ['Pune transport', 'Guide', 'Breakfast + chai', 'First aid'], excl: ['Lunch', 'Water bottle'], itin: ['4 AM Pickup, Sunrise Trek, Twin Forts, Return by Noon'] })
  await mk({ dest: 'lonavala', orgIdx: 3, title: 'Pawna Lake Camping — 1N/2D Weekend Escape from Pune', slug: 'pawna-lake-camping-sep-2026', type: 'WEEKEND', mode: 'INSTANT', desc: 'Camp by Pawna Lake with Tung Fort backdrop! Sunset kayaking, BBQ dinner, lakeside bonfire, stargazing. Just 45 km from Pune.', days: 2, price: 1499, min: 12, max: 30, booked: 30, status: 'FULL', cancel: 'FLEXIBLE', sM: 9, sD: 20, sY: 2026, incl: ['Tent + sleeping bag', 'BBQ dinner + breakfast', 'Bonfire', 'Kayaking'], excl: ['Transport to Pawna'], itin: ['Camp Setup, Kayaking, Sunset BBQ, Bonfire', 'Sunrise Chai, Breakfast, Pack Up'] })
  await mk({ dest: 'lonavala', orgIdx: 3, title: 'Rajmachi Firefly Festival Trek — 1N/2D Night Trek', slug: 'rajmachi-firefly-jun-2025', type: 'TREKKING', mode: 'INSTANT', desc: 'Millions of fireflies light up the Sahyadri! Night trek through bioluminescent forests, camping under firefly canopy, fort at dawn.', days: 2, price: 1999, min: 15, max: 30, booked: 30, status: 'COMPLETED', cancel: 'FLEXIBLE', sM: 6, sD: 5, sY: 2025, incl: ['Pune transport', 'Guide', 'Camp (1N)', 'Dinner + breakfast', 'Bonfire'], excl: ['Torch (red filter only)'], itin: ['Evening Drive, Night Trek, Firefly Show', 'Rajmachi Fort at Dawn, Descent, Pune'] })
  await mk({ dest: 'lonavala', orgIdx: 3, title: 'Lonavala 5-Fort Circuit Trek — 2N/3D Western Ghats', slug: 'lonavala-5-fort-circuit-nov-2026', type: 'TREKKING', mode: 'INSTANT', desc: '5 Maratha forts in one epic trek! Lohagad, Visapur, Tikona, Tung, Korigad — connected by scenic Western Ghat ridgelines. Pawna Lake camping.', days: 3, price: 3499, min: 10, max: 18, booked: 8, status: 'ACTIVE', cancel: 'MODERATE', sM: 11, sD: 1, sY: 2026, incl: ['Pune transport', 'Guide', 'Camping (2N)', 'All meals', 'First aid'], excl: ['Trekking shoes'], itin: ['Lohagad & Visapur Twin Forts, Pawna Camp', 'Tikona & Tung Fort, Night Camp', 'Korigad Fort, Descent, Drive to Pune'] })
  await mk({ dest: 'lonavala', orgIdx: 3, title: 'Lonavala Waterfall Rappelling — Day Trip from Pune', slug: 'lonavala-rappelling-aug-2026', type: 'ADVENTURE', mode: 'INSTANT', desc: 'Rappel down a 150 ft monsoon waterfall at Bekare! Certified instructors, pro safety gear. Most thrilling adventure near Pune.', days: 1, price: 1799, min: 10, max: 20, booked: 18, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 8, sD: 9, sY: 2026, incl: ['Pune pickup/drop', 'Rappelling gear', 'Instructor', 'Breakfast + lunch', 'Photos'], excl: ['Change of clothes'], itin: ['6 AM Pickup, Safety Brief, 150 ft Rappel, Lunch, Return 5 PM'] })
  console.log('  ✓ Bulk: Lonavala (5)')

  // ── UDAIPUR (3) ────────────────────────────────────────
  await mk({ dest: 'udaipur', orgIdx: 2, title: 'Udaipur Monsoon Lake Experience — 2N/3D City of Lakes in Rain', slug: 'udaipur-monsoon-lake-aug-2026', type: 'CULTURAL', mode: 'INSTANT', desc: 'Udaipur in monsoon is pure magic! Overflowing lakes, lush Aravalli hills, boat rides through mist, Kumbhalgarh Fort, Ranakpur Jain Temple.', days: 3, price: 8499, early: 7499, min: 6, max: 16, booked: 8, status: 'ACTIVE', cancel: 'MODERATE', sM: 8, sD: 20, sY: 2026, incl: ['Lakeside hotel (2N)', 'All meals', 'Boat ride', 'Kumbhalgarh', 'Ranakpur', 'AC transport'], excl: ['Train/flight', 'Shopping'], itin: ['City Palace, Lake Pichola Boat, Folk Dinner', 'Kumbhalgarh & Ranakpur Temples', 'Fateh Sagar Walk & Departure'] })
  await mk({ dest: 'udaipur', orgIdx: 2, title: 'Udaipur-Mount Abu Hill Station Combo — 3N/4D', slug: 'udaipur-mount-abu-oct-2026', type: 'WEEKEND', mode: 'INSTANT', desc: 'Two Rajasthan gems! Udaipur lakeside romance + Mount Abu hill station cool. Dilwara Temples, Nakki Lake, Guru Shikhar sunset.', days: 4, price: 10999, early: 9499, min: 8, max: 18, booked: 11, status: 'ACTIVE', cancel: 'MODERATE', sM: 10, sD: 5, sY: 2026, incl: ['Hotel (3N)', 'All meals', 'Entries', 'AC transport', 'Boat rides'], excl: ['Train/flight'], itin: ['Udaipur City Palace & Pichola Boat', 'Mount Abu — Dilwara, Nakki, Sunset Point', 'Guru Shikhar & Return to Udaipur', 'Hathi Pol Markets & Departure'] })
  await mk({ dest: 'udaipur', orgIdx: 2, title: 'Udaipur Royal Photography Tour — 2N/3D Palace Architecture', slug: 'udaipur-photo-tour-feb-2026', type: 'CULTURAL', mode: 'REQUEST_BASED', desc: 'Palace architecture, lake reflections, vibrant markets, golden hour magic. Led by professional photographer. Portfolio-worthy shots guaranteed.', days: 3, price: 9999, min: 6, max: 10, booked: 8, status: 'COMPLETED', cancel: 'STRICT', sM: 2, sD: 12, sY: 2026, incl: ['Lakeside hotel (2N)', 'All meals', 'Photo mentorship', 'Boat ride', 'Entries'], excl: ['Camera gear', 'Travel'], itin: ['Golden Hour at Lake Pichola', 'Palace Architecture & Hathi Pol Portraits', 'Sunrise Boat & Portfolio Review'] })
  console.log('  ✓ Bulk: Udaipur (3)')

  // ──────── PART 3 below ─────────
  await seedBulkPart3(deps, mk)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedBulkPart3(_deps: Record<string, { id: string }>, mk: (o: BulkOpts) => Promise<any>) {
  // ── MEGHALAYA (3) ──────────────────────────────────────
  await mk({ dest: 'meghalaya', orgIdx: 1, title: 'Meghalaya Living Root Bridge Trek — 4N/5D Northeast Discovery', slug: 'meghalaya-root-bridge-oct-2026', type: 'TREKKING', mode: 'REQUEST_BASED', desc: 'Double-decker living root bridges, crystal Dawki river, Asia\'s cleanest village Mawlynnong, limestone caves, and Cherrapunji waterfalls. Beyond the usual tourist trail.', days: 5, price: 13999, early: 11999, min: 6, max: 14, booked: 6, status: 'ACTIVE', cancel: 'STRICT', sM: 10, sD: 15, sY: 2026, incl: ['Shillong pickup', 'All stays (4N)', 'All meals', 'Dawki boating', 'Transport', 'Guide'], excl: ['Flights', 'Porter'], itin: ['Arrive Shillong — Don Bosco Museum', 'Cherrapunji Waterfalls & Mawsmai Cave', 'Root Bridge Trek — 3,500 Steps, Rainbow Falls', 'Dawki Crystal River & Mawlynnong Village', 'Laitlum Canyon Trek & Departure'] })
  await mk({ dest: 'meghalaya', orgIdx: 1, title: 'Meghalaya Caving Expedition — 3N/4D Underground Adventure', slug: 'meghalaya-caving-nov-2026', type: 'ADVENTURE', mode: 'REQUEST_BASED', desc: 'Explore India\'s longest caves in Jaintia Hills! Krem Mawmluh, Krem Liat Prah (India\'s longest), underground river passages. For adventure seekers.', days: 4, price: 10999, min: 6, max: 10, booked: 4, status: 'ACTIVE', cancel: 'STRICT', sM: 11, sD: 5, sY: 2026, incl: ['All stays', 'All meals', 'Caving gear', 'Expert guide', 'Transport'], excl: ['Flights', 'Personal headlamp'], itin: ['Shillong — Caving Theory & Gear Fitting', 'Krem Mawmluh Cave Exploration', 'Krem Liat Prah — Underground River', 'Nohkalikai Falls & Departure'] })
  await mk({ dest: 'meghalaya', orgIdx: 1, title: 'Meghalaya Monsoon Photography — 4N/5D Wettest Place on Earth', slug: 'meghalaya-monsoon-photo-aug-2025', type: 'CULTURAL', mode: 'REQUEST_BASED', desc: 'Photograph the wettest place on Earth during peak monsoon! Cascading waterfalls, root bridges in mist, crystal rivers, dramatic cloudscapes.', days: 5, price: 14999, min: 6, max: 8, booked: 6, status: 'COMPLETED', cancel: 'STRICT', sM: 8, sD: 10, sY: 2025, incl: ['All stays', 'All meals', 'Photo mentor', 'Transport', 'Rain gear'], excl: ['Flights', 'Camera gear'], itin: ['Shillong Cloudscapes', 'Cherrapunji Monsoon Waterfalls', 'Root Bridges in Mist', 'Dawki Crystal River Photography', 'Portfolio Review & Departure'] })
  console.log('  ✓ Bulk: Meghalaya (3)')

  // ── HAMPI (3) ──────────────────────────────────────────
  await mk({ dest: 'hampi', orgIdx: 2, title: 'Hampi Heritage & Bouldering — 2N/3D Ruins & Rock Climbing', slug: 'hampi-heritage-bouldering-nov-2026', type: 'ADVENTURE', mode: 'INSTANT', desc: 'UNESCO ruins by day, world-class bouldering by afternoon! Vijayanagara temples, Hippie Island cafes, coracle rides, Matanga Hill sunset.', days: 3, price: 5999, min: 8, max: 16, booked: 10, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 11, sD: 20, sY: 2026, incl: ['Guesthouse (2N)', 'All meals', 'Bouldering guide + gear', 'Coracle ride', 'Monument tickets'], excl: ['Train to Hospet'], itin: ['Virupaksha Temple, Hampi Bazaar, Elephant Stables', 'Bouldering, Hippie Island Cafes, Matanga Sunset', 'Anegundi Monkey Temple, Coracle Ride, Departure'] })
  await mk({ dest: 'hampi', orgIdx: 2, title: 'Hampi Cycle Tour — 2N/3D Ruins on Wheels', slug: 'hampi-cycle-tour-dec-2026', type: 'CULTURAL', mode: 'INSTANT', desc: 'Explore 500-year-old Vijayanagara Empire ruins on bicycles! Cover 25+ monuments across the boulder-strewn landscape. Photography heaven.', days: 3, price: 4999, min: 8, max: 16, booked: 9, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 12, sD: 12, sY: 2026, incl: ['Guesthouse (2N)', 'All meals', 'Bicycle rental', 'Guide', 'Monument tickets'], excl: ['Train to Hospet'], itin: ['Royal Enclosure & Underground Temple by Cycle', 'Vittala Temple, Stone Chariot, Musical Pillars', 'Hippie Island, Sanapur Lake & Departure'] })
  await mk({ dest: 'hampi', orgIdx: 2, title: 'Hampi Backpacker Budget Trip — 2N/3D', slug: 'hampi-backpacker-jan-2027', type: 'CULTURAL', mode: 'INSTANT', desc: 'Hampi on a shoestring! Dorm stay on Hippie Island, self-guided ruin walks, Tungabhadra coracle ride, sunset at Hemakuta Hill. The backpacker\'s dream.', days: 3, price: 2999, min: 10, max: 20, booked: 14, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 1, sD: 10, sY: 2027, incl: ['Dorm stay (2N)', 'Breakfast + dinner', 'Coracle ride', 'Map + self-guide booklet'], excl: ['Train to Hospet', 'Lunch', 'Monument tickets (₹40)'], itin: ['Arrive Hippie Island, Hemakuta Sunset', 'Temple Circuit & Coracle Ride', 'Sanapur Lake, Bazaar Walk, Departure'] })
  console.log('  ✓ Bulk: Hampi (3)')

  // ── SPITI (3) ──────────────────────────────────────────
  await mk({ dest: 'spiti', orgIdx: 0, title: 'Spiti Valley Circuit — 7N/8D Complete Expedition', slug: 'spiti-valley-circuit-aug-2026', type: 'ROAD_TRIP', mode: 'REQUEST_BASED', desc: 'Complete Spiti circuit — Manali to Shimla! Key Monastery, Chandratal Lake, Dhankar, Pin Valley, world\'s highest post office Hikkim. Moonscape landscapes and ancient Buddhist culture.', days: 8, price: 19999, early: 17999, min: 6, max: 12, booked: 5, status: 'ACTIVE', cancel: 'STRICT', sM: 8, sD: 1, sY: 2026, incl: ['Homestays + camps (7N)', 'All meals', 'Tempo Traveller', 'Permits', 'Guide'], excl: ['Travel to Manali', 'Personal gear'], itin: ['Manali to Jispa', 'Jispa to Chandratal Lake', 'Chandratal to Kaza via Kunzum La', 'Key Monastery, Kibber & Hikkim', 'Pin Valley & Dhankar Fort', 'Tabo Monastery & Nako Lake', 'Nako to Kalpa — Kinnaur Valley', 'Shimla Departure'] })
  await mk({ dest: 'spiti', orgIdx: 0, title: 'Spiti Winter Snow Leopard Trail — 6N/7D', slug: 'spiti-snow-leopard-feb-2027', type: 'ADVENTURE', mode: 'REQUEST_BASED', desc: 'Track the elusive snow leopard in frozen Spiti! Winter homestays in Kibber, wildlife spotting with expert naturalists, frozen landscape photography. Limited to 8 travelers.', days: 7, price: 32999, min: 4, max: 8, booked: 3, status: 'ACTIVE', cancel: 'STRICT', sM: 2, sD: 5, sY: 2027, incl: ['Kaza homestays (6N)', 'All meals', 'Naturalist guide', 'Spotting scope', '4x4 transport', 'Permits'], excl: ['Flights to Kaza', 'Winter gear', 'Insurance'], itin: ['Arrive Kaza — Acclimatize', 'Kibber Wildlife Sanctuary', 'Snow Leopard Spotting — Chicham', 'Kibber to Langza — Fossil Hunting', 'Key Monastery in Snow', 'Dhankar Fort & Pin Valley', 'Departure'] })
  await mk({ dest: 'spiti', orgIdx: 0, title: 'Chandratal Lake Trek — 3N/4D Moonlit Camping', slug: 'chandratal-trek-jul-2025', type: 'TREKKING', mode: 'INSTANT', desc: 'Trek to the legendary Moon Lake at 4,300m! Alpine meadows, wildflower trails, and camping by the crystal-clear crescent-shaped lake under a billion stars.', days: 4, price: 6999, min: 8, max: 15, booked: 12, status: 'COMPLETED', cancel: 'MODERATE', sM: 7, sD: 5, sY: 2025, incl: ['Camp (3N)', 'All meals', 'Guide + cook', 'Manali transport', 'Permits'], excl: ['Travel to Manali', 'Personal gear'], itin: ['Manali to Batal via Rohtang', 'Batal to Chandratal Lake Trek', 'Lake Day — Photography & Meditation', 'Return to Manali'] })
  console.log('  ✓ Bulk: Spiti (3)')

  // ── COORG (3) ──────────────────────────────────────────
  await mk({ dest: 'coorg', orgIdx: 2, title: 'Coorg Coffee Plantation Retreat — 2N/3D from Bangalore', slug: 'coorg-coffee-retreat-oct-2026', type: 'WEEKEND', mode: 'INSTANT', desc: 'Misty hills, coffee estate stay, plantation walk, Dubare elephant camp, Abbey Falls, Madikeri fort, and authentic Kodava cuisine. Perfect monsoon escape from Bangalore.', days: 3, price: 6999, early: 5999, min: 8, max: 18, booked: 12, status: 'ACTIVE', cancel: 'MODERATE', sM: 10, sD: 10, sY: 2026, incl: ['Bangalore bus', 'Estate stay (2N)', 'All meals', 'Plantation walk', 'Elephant camp', 'Abbey Falls'], excl: ['Personal expenses'], itin: ['Arrive & Coffee Plantation Walk', 'Dubare Elephant Camp & Abbey Falls', 'Madikeri Fort, Market, Departure'] })
  await mk({ dest: 'coorg', orgIdx: 2, title: 'Coorg Trekking & Camping Weekend — 1N/2D Tadiandamol', slug: 'coorg-tadiandamol-trek-nov-2026', type: 'TREKKING', mode: 'INSTANT', desc: 'Summit Tadiandamol (1,748m), the highest peak of Coorg! Grassland trails through shola forests, panoramic views of the Western Ghats, and camping under the stars.', days: 2, price: 3499, min: 10, max: 20, booked: 15, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 11, sD: 15, sY: 2026, incl: ['Bangalore bus', 'Camp (1N)', 'All meals', 'Trek guide', 'Bonfire'], excl: ['Trekking shoes', 'Personal gear'], itin: ['Drive to Base, Trek to Summit, Camp', 'Sunrise at Peak, Descent, Return Bangalore'] })
  await mk({ dest: 'coorg', orgIdx: 2, title: 'Coorg Monsoon Waterfalls & Rafting — 2N/3D', slug: 'coorg-monsoon-rafting-aug-2025', type: 'ADVENTURE', mode: 'INSTANT', desc: 'Coorg in monsoon — lush green hills, roaring waterfalls, Barapole river rafting (Grade III), coffee estate walks, and misty Mandalpatti viewpoint.', days: 3, price: 5999, min: 10, max: 18, booked: 16, status: 'COMPLETED', cancel: 'FLEXIBLE', sM: 8, sD: 14, sY: 2025, incl: ['Bangalore bus', 'Homestay (2N)', 'All meals', 'Rafting', 'Waterfall trek', 'Plantation walk'], excl: ['Personal expenses'], itin: ['Arrive, Mallalli Falls Trek', 'Barapole Rafting & Coffee Plantation', 'Mandalpatti Jeep Ride & Departure'] })
  console.log('  ✓ Bulk: Coorg (3)')

  // ── VARANASI (3) ───────────────────────────────────────
  await mk({ dest: 'varanasi', orgIdx: 3, title: 'Varanasi Spiritual Immersion — 2N/3D Ganga Aarti & Temples', slug: 'varanasi-spiritual-immersion-nov-2026', type: 'CULTURAL', mode: 'INSTANT', desc: 'The spiritual heart of India! Sunrise boat ride on the Ganges, Ganga Aarti at Dashashwamedh Ghat, Kashi Vishwanath Temple, Sarnath Buddhist pilgrimage, and narrow lane food walks.', days: 3, price: 5999, early: 4999, min: 8, max: 20, booked: 14, status: 'ACTIVE', cancel: 'MODERATE', sM: 11, sD: 20, sY: 2026, incl: ['Heritage hotel (2N)', 'All meals', 'Boat ride', 'Temple visits', 'Sarnath trip', 'Guide'], excl: ['Train/flight', 'Personal puja items'], itin: ['Arrive, Evening Ganga Aarti — Dashashwamedh', 'Sunrise Boat Ride, Temples, Food Walk', 'Sarnath Buddhist Site & Departure'] })
  await mk({ dest: 'varanasi', orgIdx: 3, title: 'Varanasi Dev Deepawali Festival — 2N/3D', slug: 'varanasi-dev-deepawali-nov-2026', type: 'CULTURAL', mode: 'INSTANT', desc: 'Witness a million diyas on the Ganges ghats during Dev Deepawali! The most spectacular festival in Varanasi — boat ride through lit ghats, special aarti, laser show.', days: 3, price: 7999, min: 10, max: 22, booked: 22, status: 'FULL', cancel: 'STRICT', sM: 11, sD: 14, sY: 2026, incl: ['Heritage hotel (2N)', 'All meals', 'Festival boat ride', 'Special aarti', 'Guide', 'Sarnath visit'], excl: ['Train/flight', 'Shopping'], itin: ['Arrive, Explore Ghats & Lanes', 'Dev Deepawali — Million Diyas Festival', 'Sarnath & Departure'] })
  await mk({ dest: 'varanasi', orgIdx: 3, title: 'Varanasi Food & Culture Trail — 2N/3D Culinary Journey', slug: 'varanasi-food-trail-oct-2025', type: 'CULTURAL', mode: 'INSTANT', desc: 'Explore Varanasi through its legendary food! Kachori Gali breakfast, blue lassi, tamatar chaat, boat ride, silk weaving workshop, and evening aarti. A feast for all senses.', days: 3, price: 5499, min: 8, max: 16, booked: 10, status: 'COMPLETED', cancel: 'FLEXIBLE', sM: 10, sD: 8, sY: 2025, incl: ['Hotel (2N)', 'All food trail meals', 'Boat ride', 'Silk workshop', 'Guide'], excl: ['Train/flight'], itin: ['Arrive, Evening Food Walk & Aarti', 'Sunrise Boat, Temple Trail, Silk Weaving', 'Kachori Gali Breakfast & Departure'] })
  console.log('  ✓ Bulk: Varanasi (3)')

  // ── ANDAMAN (3) ────────────────────────────────────────
  await mk({ dest: 'andaman', orgIdx: 1, title: 'Andaman Island Hopping — 5N/6D Beach & Snorkel Paradise', slug: 'andaman-island-hopping-nov-2026', type: 'BEACH', mode: 'INSTANT', desc: 'Crystal clear waters, pristine beaches, and vibrant coral reefs! Havelock Island snorkeling at Elephant Beach, Neil Island cycling, Radhanagar Beach sunset, and Cellular Jail sound & light show.', days: 6, price: 22999, early: 19999, min: 6, max: 14, booked: 7, status: 'ACTIVE', cancel: 'MODERATE', sM: 11, sD: 10, sY: 2026, incl: ['Port Blair airport pickup', 'Resort (5N)', 'All meals', 'Ferry tickets', 'Snorkeling', 'Cellular Jail', 'All transport'], excl: ['Flights', 'Scuba (optional)', 'Water camera'], itin: ['Arrive Port Blair, Cellular Jail Light Show', 'Havelock — Radhanagar Beach Sunset', 'Elephant Beach Snorkeling & Kayaking', 'Neil Island — Cycling & Natural Bridge', 'Glass-Bottom Boat, Coral Gardens', 'Ross Island & Departure'] })
  await mk({ dest: 'andaman', orgIdx: 1, title: 'Andaman Scuba Diving Course — 4N/5D PADI Open Water', slug: 'andaman-scuba-course-dec-2026', type: 'ADVENTURE', mode: 'REQUEST_BASED', desc: 'Get PADI Open Water certified in tropical Andaman! Theory + pool + 4 open water dives at Havelock. See manta rays, sea turtles, coral gardens. Lifetime certification.', days: 5, price: 26999, min: 4, max: 8, booked: 3, status: 'ACTIVE', cancel: 'STRICT', sM: 12, sD: 5, sY: 2026, incl: ['Havelock resort (4N)', 'All meals', 'PADI course + certification', '4 open water dives', 'All equipment', 'Ferry'], excl: ['Flights', 'Underwater camera'], itin: ['Arrive, Theory & Pool Session', 'Confined Water Dives', 'Open Water Dive 1 & 2', 'Open Water Dive 3 & 4 — Certification!', 'Radhanagar Beach & Departure'] })
  await mk({ dest: 'andaman', orgIdx: 1, title: 'Andaman Honeymoon Special — 4N/5D Romance on the Islands', slug: 'andaman-honeymoon-feb-2027', type: 'BEACH', mode: 'INSTANT', desc: 'The ultimate island honeymoon! Private beach dinners, couple spa at Havelock, sunset cruise, candlelit Radhanagar Beach, glass-bottom boat ride. Pure paradise.', days: 5, price: 29999, early: 26999, min: 2, max: 10, booked: 4, status: 'ACTIVE', cancel: 'MODERATE', sM: 2, sD: 14, sY: 2027, incl: ['Beach resort (4N)', 'All meals', 'Private dinner', 'Couple spa', 'Sunset cruise', 'Ferry', 'All transport'], excl: ['Flights', 'Alcohol'], itin: ['Arrive, Cellular Jail, Candlelit Dinner', 'Havelock — Radhanagar Sunset, Spa', 'Elephant Beach Snorkeling, Private Dinner', 'Neil Island Day Trip', 'Sunrise Swim & Departure'] })
  console.log('  ✓ Bulk: Andaman (3)')

  // ── DHARAMSHALA (3) ─────────────────────────────────────
  await mk({ dest: 'dharamshala', orgIdx: 2, title: 'Dharamshala Triund Trek & McLeod Ganj — 2N/3D Himalayan Weekend from Delhi', slug: 'dharamshala-triund-trek-oct-2026', type: 'TREKKING', mode: 'INSTANT', desc: 'One of India\'s most scenic weekend treks! Triund summit (2,828m) with 360-degree Dhauladhar views, McLeod Ganj Tibetan culture walk, Bhagsunag waterfall, and authentic Tibetan momos. Perfect beginner-friendly Himalayan trek from Delhi.', days: 3, price: 4999, early: 3999, min: 8, max: 20, booked: 12, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 10, sD: 18, sY: 2026, incl: ['Guesthouse (2N)', 'All meals', 'Trek guide', 'Camping gear', 'McLeod Ganj walk', 'Bhagsunag visit'], excl: ['Bus/flight to Dharamshala', 'Personal trekking shoes'], itin: ['Arrive McLeod Ganj, Tibetan Market & Momos', 'Triund Trek — Summit & Camping', 'Bhagsunag Waterfall & Departure'] })
  await mk({ dest: 'dharamshala', orgIdx: 2, title: 'Dharamshala Yoga & Meditation Retreat — 4N/5D Spiritual Escape', slug: 'dharamshala-yoga-retreat-nov-2026', type: 'CULTURAL', mode: 'REQUEST_BASED', desc: 'Find your inner peace in the land of the Dalai Lama. Daily yoga sessions with Himalayan views, guided meditation at Tushita Meditation Centre, Tibetan monastery visits, and nature walks through rhododendron forests. All levels welcome.', days: 5, price: 8999, min: 6, max: 14, booked: 5, status: 'ACTIVE', cancel: 'MODERATE', sM: 11, sD: 8, sY: 2026, incl: ['Yoga retreat stay (4N)', 'Vegetarian meals', 'Daily yoga + meditation', 'Monastery visits', 'Nature walks', 'Triund day trek'], excl: ['Transport to Dharamshala', 'Yoga mat (or rent ₹100)'], itin: ['Arrive, Evening Meditation Introduction', 'Sunrise Yoga, Dalai Lama Temple, Tushita Centre', 'Full Day: Yoga, Tibetan Cooking Class, Forest Walk', 'Triund Day Trek with Sunset Meditation', 'Final Session & Departure'] })
  await mk({ dest: 'dharamshala', orgIdx: 2, title: 'Dharamshala Budget Backpacking Trip — 2N/3D McLeod Ganj Explorer', slug: 'dharamshala-backpacking-sep-2025', type: 'ADVENTURE', mode: 'INSTANT', desc: 'Budget-friendly backpacking through Dharamshala and McLeod Ganj! Hostel stays, street food trail, Bhagsunag waterfall swim, Naddi sunset point, and Tibetan handicraft shopping. The perfect weekend escape for young travelers.', days: 3, price: 2999, min: 10, max: 24, booked: 18, status: 'COMPLETED', cancel: 'FLEXIBLE', sM: 9, sD: 12, sY: 2025, incl: ['Hostel (2N)', 'Breakfast', 'Local guide', 'Bhagsunag trek', 'Market walk'], excl: ['Bus to Dharamshala', 'Lunch & dinner'], itin: ['Arrive, McLeod Ganj Walking Tour', 'Bhagsunag Waterfall, Naddi Sunset', 'Tibetan Market, Departure'] })
  console.log('  ✓ Bulk: Dharamshala (3)')

  // ── OOTY (3) ────────────────────────────────────────────
  await mk({ dest: 'ooty', orgIdx: 1, title: 'Ooty & Coonoor Hill Station Retreat — 3N/4D Tea Trails from Bangalore', slug: 'ooty-coonoor-retreat-oct-2026', type: 'WEEKEND', mode: 'INSTANT', desc: 'Escape to the Nilgiri Hills! Ride the UNESCO toy train from Mettupalayam to Ooty, walk through tea plantations in Coonoor, visit the Botanical Garden, and catch sunrise at Doddabetta Peak. The perfect South Indian hill station getaway from Bangalore.', days: 4, price: 6999, early: 5999, min: 8, max: 18, booked: 10, status: 'ACTIVE', cancel: 'MODERATE', sM: 10, sD: 24, sY: 2026, incl: ['Resort (3N)', 'All meals', 'Toy train ticket', 'Tea plantation visit', 'Doddabetta entry', 'All transport from Mysore'], excl: ['Bus/flight to Mysore', 'Shopping'], itin: ['Arrive Mysore, Drive to Ooty, Botanical Garden', 'Toy Train to Coonoor, Tea Plantation Walk', 'Doddabetta Peak Sunrise, Pykara Falls', 'Ooty Lake, Departure via Bandipur Forest'] })
  await mk({ dest: 'ooty', orgIdx: 1, title: 'Ooty Monsoon Magic — 2N/3D Nilgiri Waterfalls & Mist from Bangalore', slug: 'ooty-monsoon-trip-aug-2025', type: 'WEEKEND', mode: 'INSTANT', desc: 'Experience Ooty in its greenest avatar during monsoon! Misty valleys, cascading waterfalls at Pykara, tea estate walks in the rain, and warm soup at colonial-era bakeries. Magical fog-draped Nilgiri landscapes you will never forget.', days: 3, price: 4999, min: 8, max: 20, booked: 16, status: 'COMPLETED', cancel: 'FLEXIBLE', sM: 8, sD: 15, sY: 2025, incl: ['Hotel (2N)', 'All meals', 'Pykara falls', 'Tea plantation', 'Ooty Lake boating', 'Transport'], excl: ['Bus to Ooty', 'Rain gear (recommended)'], itin: ['Arrive, Rose Garden, Ooty Lake Boating', 'Pykara Falls Trek, Tea Estate Walk', 'Doddabetta, Coonoor & Departure'] })
  await mk({ dest: 'ooty', orgIdx: 1, title: 'Ooty Wildlife & Nature Trail — 3N/4D Mudumalai Safari from Bangalore', slug: 'ooty-wildlife-safari-dec-2026', type: 'ADVENTURE', mode: 'REQUEST_BASED', desc: 'Combine Nilgiri hill station charm with Mudumalai Tiger Reserve safari! Spot elephants, bison, and deer on jeep safaris. Visit Ooty tea gardens, Pykara waterfalls, and the scenic Ooty-Coonoor toy train route.', days: 4, price: 8499, min: 6, max: 14, booked: 4, status: 'ACTIVE', cancel: 'MODERATE', sM: 12, sD: 20, sY: 2026, incl: ['Resort (3N)', 'All meals', 'Mudumalai jeep safari', 'Toy train ticket', 'Pykara falls', 'Naturalist guide'], excl: ['Bus/flight to Mysore', 'Camera fees at safari'], itin: ['Arrive, Drive through Bandipur, Mudumalai Check-in', 'Morning & Evening Safari, Waterhole Visit', 'Ooty — Tea Gardens, Toy Train, Doddabetta', 'Pykara Falls & Departure'] })
  console.log('  ✓ Bulk: Ooty (3)')

  // ── RANN OF KUTCH (3) ──────────────────────────────────
  await mk({ dest: 'rannOfKutch', orgIdx: 3, title: 'Rann of Kutch Full Moon Festival — 3N/4D White Desert Experience from Ahmedabad', slug: 'rann-utsav-fullmoon-jan-2027', type: 'CULTURAL', mode: 'INSTANT', desc: 'Walk on the infinite white salt desert under a full moon! Rann Utsav tent city stay, Kutchi folk dance, handicraft village visits, Dholavira archaeological site, and the stunning Kala Dungar sunset — India\'s most unique landscape experience.', days: 4, price: 9999, early: 8499, min: 8, max: 22, booked: 15, status: 'ACTIVE', cancel: 'MODERATE', sM: 1, sD: 12, sY: 2027, incl: ['Tent city stay (3N)', 'All meals', 'Rann full moon walk', 'Kutchi village tour', 'Dholavira visit', 'Folk performances', 'Transport from Bhuj'], excl: ['Flight to Bhuj/Ahmedabad', 'Camel ride (₹200 extra)'], itin: ['Arrive Bhuj, Drive to Tent City, Evening Folk Show', 'White Rann Walk, Kutchi Village Handicrafts', 'Dholavira Archaeological Site, Kala Dungar Sunset', 'Full Moon Night Walk & Departure'] })
  await mk({ dest: 'rannOfKutch', orgIdx: 3, title: 'Rann of Kutch Photography Expedition — 3N/4D Desert Landscapes', slug: 'rann-photography-expedition-dec-2026', type: 'CULTURAL', mode: 'REQUEST_BASED', desc: 'A photographer\'s dream — capture the surreal white desert at golden hour, Kutchi women in embroidered attire, flamingo colonies at Little Rann, Dholavira ruins at sunrise, and star trails over the infinite salt flat. Led by a professional landscape photographer.', days: 4, price: 12999, min: 6, max: 12, booked: 4, status: 'ACTIVE', cancel: 'STRICT', sM: 12, sD: 18, sY: 2026, incl: ['Desert camp (3N)', 'All meals', 'Photography mentor', 'Little Rann flamingo safari', 'Golden hour sessions', 'Transport'], excl: ['Camera equipment', 'Flight to Bhuj'], itin: ['Arrive, Golden Hour White Rann Shoot', 'Flamingo Colony, Kutchi Village Portraits', 'Dholavira Ruins Sunrise, Star Trail Night Session', 'Final Edits Workshop & Departure'] })
  await mk({ dest: 'rannOfKutch', orgIdx: 3, title: 'Rann of Kutch Budget Trip — 2N/3D White Desert & Kutch Culture', slug: 'rann-budget-trip-feb-2025', type: 'CULTURAL', mode: 'INSTANT', desc: 'Experience the surreal White Rann on a budget! Stay in Bhuj, visit the salt desert, explore Kutchi craft villages, see the Aina Mahal mirror palace, and drive to Kala Dungar border viewpoint. Best budget way to see Kutch.', days: 3, price: 4999, min: 10, max: 24, booked: 20, status: 'COMPLETED', cancel: 'FLEXIBLE', sM: 2, sD: 8, sY: 2025, incl: ['Bhuj hotel (2N)', 'All meals', 'White Rann visit', 'Village tour', 'Kala Dungar', 'Transport'], excl: ['Flight to Bhuj', 'Camel ride'], itin: ['Arrive Bhuj, Aina Mahal, Prag Mahal', 'White Rann, Kutch Craft Villages, Sunset', 'Kala Dungar Border View & Departure'] })
  console.log('  ✓ Bulk: Rann of Kutch (3)')

  // ── WOMEN-ONLY TRIPS by She Travels India (orgIdx 4) ───
  await mk({ dest: 'goa', orgIdx: 4, title: 'Women-Only Goa Beach Retreat — 3N/4D All-Girls Getaway from Pune', slug: 'women-only-goa-retreat-jan-2027', type: 'BEACH', mode: 'REQUEST_BASED', desc: 'A safe, empowering beach retreat exclusively for women! South Goa beachside resort, yoga on the beach, water sports, Fontainhas heritage walk, spice plantation tour, and sunset cruise. Women-led guides and all-female group. Perfect for solo women travelers and girls\' trips.', days: 4, price: 8999, early: 7499, min: 8, max: 18, booked: 10, status: 'ACTIVE', cancel: 'MODERATE', sM: 1, sD: 20, sY: 2027, incl: ['Beach resort (3N)', 'All meals', 'Beach yoga', 'Water sports', 'Fontainhas walk', 'Spice plantation', 'Sunset cruise'], excl: ['Transport to Goa', 'Alcohol'], itin: ['Arrive Goa, Beach Yoga, Welcome Dinner', 'Water Sports, Fontainhas Heritage Walk', 'Spice Plantation, Cooking Class, Sunset Cruise', 'Beach Morning & Departure'] })
  await mk({ dest: 'ladakh', orgIdx: 4, title: 'Women-Only Ladakh Road Trip — 7N/8D Empowering Himalayan Adventure', slug: 'women-only-ladakh-aug-2026', type: 'ROAD_TRIP', mode: 'REQUEST_BASED', desc: 'India\'s first all-women Ladakh road trip! Manali to Leh highway, Pangong Lake camping, Nubra Valley sand dunes, Khardung La pass, and monastery visits. Women riders and SUV options. All-female crew with medical support. Empower yourself on the world\'s highest roads.', days: 8, price: 24999, min: 6, max: 14, booked: 8, status: 'ACTIVE', cancel: 'STRICT', sM: 8, sD: 5, sY: 2026, incl: ['Hotels + camps (7N)', 'All meals', 'SUV transport', 'Pangong camping', 'Nubra Valley', 'Oxygen backup', 'Female medic'], excl: ['Flight to Manali/Leh', 'Bike rental (optional ₹2,500/day)', 'Cold weather gear'], itin: ['Manali Acclimatization Day', 'Manali to Jispa — Atal Tunnel', 'Jispa to Leh — Baralacha La', 'Leh — Shanti Stupa, Leh Palace, Market', 'Pangong Lake — Lakeside Camping', 'Nubra Valley — Sand Dunes, Diskit Monastery', 'Khardung La, Back to Leh', 'Departure'] })
  await mk({ dest: 'rishikesh', orgIdx: 4, title: 'Women-Only Rishikesh Yoga & Rafting — 2N/3D Weekend Escape from Delhi', slug: 'women-only-rishikesh-oct-2026', type: 'ADVENTURE', mode: 'INSTANT', desc: 'The perfect weekend escape for women! 16 km white-water rafting, riverside yoga, cliff jumping at Brahmpuri, Ganga Aarti, and camping under the stars. All-female rafting crew, women guides, and safe camping setup. No experience needed.', days: 3, price: 4999, min: 10, max: 22, booked: 14, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 10, sD: 11, sY: 2026, incl: ['Riverside camp (2N)', 'All meals', '16 km rafting', 'Cliff jumping', 'Yoga sessions', 'Ganga Aarti', 'Bonfire'], excl: ['Bus from Delhi (₹600 Volvo)', 'Waterproof phone pouch'], itin: ['Arrive Rishikesh, Riverside Yoga, Ganga Aarti', '16 km Rafting, Cliff Jumping, Beach Games', 'Sunrise Yoga, Ram Jhula Walk & Departure'] })
  await mk({ dest: 'jaipur', orgIdx: 4, title: 'Women-Only Rajasthan Heritage Tour — 4N/5D Jaipur Udaipur Circuit', slug: 'women-only-rajasthan-nov-2026', type: 'CULTURAL', mode: 'INSTANT', desc: 'A royal Rajasthan experience designed for women! Amber Fort, Hawa Mahal, City Palace Udaipur, Lake Pichola boat ride, block printing workshop, traditional Rajasthani cooking class, and shopping in Johari Bazaar. Women guides at every heritage site.', days: 5, price: 11999, early: 9999, min: 8, max: 16, booked: 6, status: 'ACTIVE', cancel: 'MODERATE', sM: 11, sD: 22, sY: 2026, incl: ['Heritage hotels (4N)', 'All meals', 'Amber Fort', 'City Palace', 'Boat ride', 'Block printing workshop', 'Cooking class', 'Transport'], excl: ['Flight to Jaipur', 'Shopping budget'], itin: ['Arrive Jaipur, Hawa Mahal, Johari Bazaar', 'Amber Fort, Block Printing Workshop', 'Drive to Udaipur, Ranakpur Jain Temple', 'City Palace, Lake Pichola, Cooking Class', 'Saheliyon ki Bari & Departure'] })
  await mk({ dest: 'meghalaya', orgIdx: 4, title: 'Women-Only Meghalaya Root Bridges — 5N/6D Northeast Explorer', slug: 'women-only-meghalaya-mar-2027', type: 'TREKKING', mode: 'REQUEST_BASED', desc: 'Explore the magical Northeast with an all-women group! Double-decker root bridge trek, crystal-clear Dawki river kayaking, Mawlynnong cleanest village, Laitlum Canyon, and Shillong café culture. Women tribal guides, safe homestays, and empowering conversations.', days: 6, price: 14999, min: 6, max: 14, booked: 3, status: 'ACTIVE', cancel: 'MODERATE', sM: 3, sD: 15, sY: 2027, incl: ['Homestays + hotels (5N)', 'All meals', 'Root bridge trek', 'Dawki kayaking', 'Mawlynnong visit', 'Shillong tour', 'Local women guides'], excl: ['Flight to Guwahati', 'Rain gear', 'Trekking shoes'], itin: ['Arrive Guwahati, Drive to Shillong', 'Laitlum Canyon, Shillong Cafes', 'Cherrapunji — Double-Decker Root Bridge Trek', 'Rainbow Falls, Mawlynnong Village', 'Dawki River Kayaking, Shnongpdeng Camp', 'Umiam Lake & Departure'] })
  await mk({ dest: 'coorg', orgIdx: 4, title: 'Women-Only Coorg Coffee & Nature Retreat — 2N/3D Weekend from Bangalore', slug: 'women-only-coorg-sep-2025', type: 'WEEKEND', mode: 'INSTANT', desc: 'A rejuvenating weekend in Karnataka\'s coffee country for women! Coffee plantation walks, Abbey Falls trek, Dubare elephant camp, Kodava cooking class, and bonfire under the stars. The ultimate self-care weekend with like-minded women.', days: 3, price: 5499, min: 8, max: 18, booked: 14, status: 'COMPLETED', cancel: 'FLEXIBLE', sM: 9, sD: 19, sY: 2025, incl: ['Plantation homestay (2N)', 'All meals', 'Coffee walk', 'Abbey Falls', 'Dubare camp', 'Cooking class', 'Bonfire'], excl: ['Transport to Coorg', 'Tips'], itin: ['Arrive Coorg, Coffee Plantation Walk, Bonfire', 'Dubare Elephant Camp, Abbey Falls Trek', 'Kodava Cooking Class & Departure'] })
  console.log('  ✓ Bulk: Women-Only (She Travels India) — 6 trips across 6 destinations')

  // ── CORPORATE OFFSITE TRIPS by Corporate Escapes India (orgIdx 5) ──
  await mk({ dest: 'goa', orgIdx: 5, title: 'Corporate Team Offsite Goa — 3N/4D Beach Team Building Package from Pune', slug: 'corporate-goa-offsite-feb-2027', type: 'BEACH', mode: 'REQUEST_BASED', desc: 'India\'s most popular corporate offsite destination! Beach team building games, indoor strategy workshops, yacht party, North Goa night out, and Dudhsagar waterfall excursion. Custom agenda for your team. GST invoicing included. Trusted by 50+ companies.', days: 4, price: 12999, min: 15, max: 40, booked: 22, status: 'ACTIVE', cancel: 'MODERATE', sM: 2, sD: 6, sY: 2027, incl: ['Resort (3N)', 'All meals', 'Conference hall', 'Team building games', 'Yacht party', 'Dudhsagar trip', 'DJ night', 'GST invoice'], excl: ['Transport to Goa', 'Alcohol', 'Personal expenses'], itin: ['Arrive, Check-in, Ice-Breaker Games', 'Morning Workshop, Afternoon Beach Olympics', 'Dudhsagar Waterfall, Evening Yacht Party', 'Award Ceremony & Departure'] })
  await mk({ dest: 'lonavala', orgIdx: 5, title: 'Corporate Offsite Lonavala — 1N/2D Team Outing Package from Pune', slug: 'corporate-lonavala-outing-jan-2027', type: 'WEEKEND', mode: 'INSTANT', desc: 'Quick 2-day team outing from Pune! Pawna Lake campsite, team building challenges, zip-lining, rappelling, barbecue dinner, and morning trek to Tikona Fort. Perfect for quarterly team bonding without burning too many work days.', days: 2, price: 3999, min: 15, max: 50, booked: 30, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 1, sD: 25, sY: 2027, incl: ['Campsite (1N)', 'All meals', 'Team building activities', 'Zip-line', 'Rappelling', 'BBQ dinner', 'Bonfire', 'GST invoice'], excl: ['Transport from Pune (bus available ₹500/person)'], itin: ['Arrive Pawna Lake, Team Building, Zip-Line, BBQ Night', 'Tikona Fort Morning Trek, Award Ceremony, Departure'] })
  await mk({ dest: 'rishikesh', orgIdx: 5, title: 'Corporate Adventure Retreat Rishikesh — 2N/3D Outbound Training from Delhi', slug: 'corporate-rishikesh-retreat-mar-2027', type: 'ADVENTURE', mode: 'REQUEST_BASED', desc: 'Leadership and team building through adventure! White-water rafting as a team, high-rope course, commando net, trust fall exercises, evening yoga, and Ganga Aarti. Corporate outbound training that actually builds teams. Certified facilitators and GST invoicing.', days: 3, price: 7999, min: 15, max: 40, booked: 18, status: 'ACTIVE', cancel: 'MODERATE', sM: 3, sD: 14, sY: 2027, incl: ['Resort (2N)', 'All meals', 'Rafting', 'High-rope course', 'Team challenges', 'Yoga sessions', 'Ganga Aarti', 'Facilitator', 'GST invoice'], excl: ['Bus from Delhi', 'Personal items'], itin: ['Arrive, Ice-Breakers, Evening Ganga Aarti', 'Rafting + Outbound Training Challenges', 'Sunrise Yoga, Awards, Departure'] })
  await mk({ dest: 'coorg', orgIdx: 5, title: 'Corporate Retreat Coorg — 2N/3D Plantation Stay Team Building from Bangalore', slug: 'corporate-coorg-retreat-nov-2026', type: 'WEEKEND', mode: 'INSTANT', desc: 'Escape to coffee country for your next offsite! Plantation resort, outdoor team challenges, treasure hunt in the coffee estate, campfire karaoke, and nature walks. Breakout rooms for strategy sessions. Perfect for Bangalore tech teams.', days: 3, price: 6999, min: 15, max: 35, booked: 20, status: 'ACTIVE', cancel: 'FLEXIBLE', sM: 11, sD: 28, sY: 2026, incl: ['Plantation resort (2N)', 'All meals', 'Team building', 'Treasure hunt', 'Nature walk', 'Campfire', 'Conference room', 'GST invoice'], excl: ['Transport from Bangalore', 'Alcohol'], itin: ['Arrive, Team Building Games, Campfire Karaoke', 'Strategy Session, Outdoor Challenges, Coffee Walk', 'Abbey Falls Outing & Departure'] })
  await mk({ dest: 'udaipur', orgIdx: 5, title: 'Corporate Leadership Retreat Udaipur — 3N/4D Luxury Offsite Package', slug: 'corporate-udaipur-retreat-feb-2027', type: 'CULTURAL', mode: 'REQUEST_BASED', desc: 'A premium corporate leadership retreat in the City of Lakes. Lakeside strategy sessions, team building at Kumbhalgarh Fort, sunset boat ride on Lake Pichola, gala dinner at a heritage haveli, and Rajasthani cultural evening. For C-suite and leadership teams.', days: 4, price: 18999, min: 10, max: 25, booked: 8, status: 'ACTIVE', cancel: 'STRICT', sM: 2, sD: 20, sY: 2027, incl: ['Heritage hotel (3N)', 'All meals', 'Conference hall', 'Boat ride', 'Kumbhalgarh Fort trip', 'Gala dinner', 'Cultural evening', 'GST invoice'], excl: ['Flight to Udaipur', 'Personal shopping'], itin: ['Arrive, Lakeside Strategy Session, Welcome Dinner', 'Kumbhalgarh Fort Team Challenge', 'Lake Pichola Boat, City Palace, Gala Dinner', 'Closing Session & Departure'] })
  await mk({ dest: 'manali', orgIdx: 5, title: 'Corporate Snow Adventure Manali — 3N/4D Winter Team Offsite from Delhi', slug: 'corporate-manali-winter-jan-2025', type: 'ADVENTURE', mode: 'INSTANT', desc: 'Team building in the snow! Solang Valley snow activities, igloo building challenge, Atal Tunnel drive to Sissu, hot springs bonding, and Old Manali after-party. An unforgettable winter offsite for young teams.', days: 4, price: 9999, min: 15, max: 30, booked: 28, status: 'COMPLETED', cancel: 'MODERATE', sM: 1, sD: 10, sY: 2025, incl: ['Hotel (3N)', 'All meals', 'Snow activities', 'Atal Tunnel trip', 'Team games', 'Hot springs', 'Bonfire', 'GST invoice'], excl: ['Volvo bus from Delhi', 'Snow gear rental (₹500)'], itin: ['Arrive Manali, Check-in, Mall Road Walk', 'Solang Valley — Snow Games & Igloo Challenge', 'Atal Tunnel to Sissu, Hot Springs, Team Awards', 'Old Manali Breakfast & Departure'] })
  console.log('  ✓ Bulk: Corporate Offsite (Corporate Escapes India) — 6 trips across 6 destinations')

  console.log('  ══ Total bulk trips created: 84 (across 17 destinations, 6 organizers) ══')
}

// ══════════════════════════════════════════════════════════
// ── BULK REVIEWS (for completed bulk trips) ──────────────
// ══════════════════════════════════════════════════════════

const REVIEW_PHOTOS: Record<string, string[]> = {
  goa: ['https://images.unsplash.com/photo-1652820330085-82a0c2b88d78?w=600', 'https://images.unsplash.com/photo-1590393275627-0c48482c60e3?w=600', 'https://images.unsplash.com/photo-1646748019366-3f1c922bfe3b?w=600'],
  manali: ['https://images.unsplash.com/photo-1692719058797-2954b100c8fe?w=600', 'https://images.unsplash.com/photo-1606667544139-81e47935d769?w=600', 'https://images.unsplash.com/photo-1679407985687-08a86c5c53ba?w=600'],
  ladakh: ['https://images.unsplash.com/photo-1593118845043-359e5f628214?w=600', 'https://images.unsplash.com/photo-1606857090627-27ca46667290?w=600', 'https://images.unsplash.com/photo-1652204597589-962156b9483d?w=600'],
  rishikesh: ['https://images.unsplash.com/photo-1718431108073-7f61fb5dfefb?w=600', 'https://images.unsplash.com/photo-1711992437606-bd676fb6fdf2?w=600', 'https://images.unsplash.com/photo-1718383537411-6f9e727ae0bb?w=600'],
  jaipur: ['https://images.unsplash.com/photo-1595280769531-a25c4c76116a?w=600', 'https://images.unsplash.com/photo-1677868819682-b17554d29622?w=600', 'https://images.unsplash.com/photo-1714168442131-7b10f314915e?w=600'],
  kasol: ['https://images.unsplash.com/photo-1673815994546-9913f4d76b77?w=600', 'https://images.unsplash.com/photo-1609961245797-9cc9231012d8?w=600', 'https://images.unsplash.com/photo-1580465874672-a34623c30beb?w=600'],
  lonavala: ['https://images.unsplash.com/photo-1621578847110-61f6cf5a3d9e?w=600', 'https://images.unsplash.com/photo-1521206644285-8db1549e484f?w=600', 'https://images.unsplash.com/photo-1692626453173-7af2d5b64426?w=600'],
  udaipur: ['https://images.unsplash.com/photo-1622018135960-249abd263aeb?w=600', 'https://images.unsplash.com/photo-1770665567877-72ee8a7c9051?w=600', 'https://images.unsplash.com/photo-1710987759549-db4263464211?w=600'],
  meghalaya: ['https://images.unsplash.com/photo-1552978534-9d01e1f91517?w=600', 'https://images.unsplash.com/photo-1521437620269-f477f5437820?w=600', 'https://images.unsplash.com/photo-1534531409543-069f6204c5b4?w=600'],
  hampi: ['https://images.unsplash.com/photo-1696239105346-4e48185eb001?w=600', 'https://images.unsplash.com/photo-1631986683754-7d511e03864d?w=600', 'https://images.unsplash.com/photo-1631601147889-7260bbb25a1f?w=600'],
  spiti: ['https://images.unsplash.com/photo-1709907153050-a668b4473c47?w=600', 'https://images.unsplash.com/photo-1652131812743-07bc5dde8b91?w=600', 'https://images.unsplash.com/photo-1671609856557-13a95d395fa6?w=600'],
  'spiti-valley': ['https://images.unsplash.com/photo-1709907153050-a668b4473c47?w=600', 'https://images.unsplash.com/photo-1652131812743-07bc5dde8b91?w=600', 'https://images.unsplash.com/photo-1671609856557-13a95d395fa6?w=600'],
  coorg: ['https://images.unsplash.com/photo-1699819551081-48095fe86265?w=600', 'https://images.unsplash.com/photo-1641701212196-dec15e3bdf59?w=600', 'https://images.unsplash.com/photo-1694537623072-a1172819c577?w=600'],
  varanasi: ['https://images.unsplash.com/photo-1665413793441-13aedeb062d3?w=600', 'https://images.unsplash.com/photo-1728272355917-f41c61fe9842?w=600', 'https://images.unsplash.com/photo-1713922548844-82c63df42ac3?w=600'],
  andaman: ['https://images.unsplash.com/photo-1586359716568-3e1907e4cf9f?w=600', 'https://images.unsplash.com/photo-1704314315344-cd10b9779ce6?w=600', 'https://images.unsplash.com/photo-1497258149552-cf39daacceaa?w=600'],
  dharamshala: ['https://images.unsplash.com/photo-1581321863389-ef7d7bfe4b75?w=600', 'https://images.unsplash.com/photo-1649951692609-cfb7f753b356?w=600', 'https://images.unsplash.com/photo-1641356918719-41ce2f5c15fb?w=600'],
  ooty: ['https://images.unsplash.com/photo-1638886540342-240980f60d25?w=600', 'https://images.unsplash.com/photo-1660918738010-295b09857f93?w=600', 'https://images.unsplash.com/photo-1707655315272-33a54a771068?w=600'],
  rannOfKutch: ['https://images.unsplash.com/photo-1670923331633-be262e035a9a?w=600', 'https://images.unsplash.com/photo-1669015881702-951de590db31?w=600', 'https://images.unsplash.com/photo-1709917524188-3f442929bacd?w=600'],
  'rann-of-kutch': ['https://images.unsplash.com/photo-1670923331633-be262e035a9a?w=600', 'https://images.unsplash.com/photo-1669015881702-951de590db31?w=600', 'https://images.unsplash.com/photo-1709917524188-3f442929bacd?w=600'],
}

const REVIEW_TEMPLATES = [
  { overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Best group trip I have ever been on — booked on Safarnama and everything was seamless from payment to pickup. The organizer planned every detail perfectly: comfortable stays, authentic local food, and hidden gems I would never have found on Google Maps. Already recommending to all my friends!' },
  { overall: 4, org: 4, val: 5, safe: 5, acc: 4, comment: 'Amazing value for money! Paid ₹7,999 and got an experience worth triple that — all meals included, comfortable hotel, and activities that would cost way more individually. The group of 15 was well-balanced and the itinerary left just enough free time. Only minor feedback: morning departures were a bit early.' },
  { overall: 5, org: 5, val: 4, safe: 5, acc: 5, comment: 'One of the best travel experiences of my life. The locations were absolutely breathtaking — things you only see on Instagram reels but this was real and in front of my eyes. Food was authentic regional cuisine, not tourist restaurant stuff. The organizer made sure everyone was comfortable and safe. 10/10 would book again on Safarnama!' },
  { overall: 4, org: 5, val: 4, safe: 4, acc: 4, comment: 'Solid group trip with top-notch organization. The highlight was the local experiences — a home-cooked meal with a village family, early morning trek with a certified guide, and sunset spots that no travel blog mentions. Guide was incredibly knowledgeable about the region and its history. Safarnama made the booking process completely hassle-free.' },
  { overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Went as a solo female traveler and felt completely safe the entire time! The organizer created such a welcoming atmosphere from day one — within hours I made friends I am still in touch with. The women in the group were especially supportive. Safarnama\'s escrow payment gave me confidence to book. Best decision of 2025!' },
  { overall: 3, org: 3, val: 3, safe: 4, acc: 3, comment: 'Decent trip but expected more based on the listing photos. Some activities felt rushed — wish we had more time at each location. The accommodation was basic but clean. Food was good, mostly local thali meals. Would have preferred a longer stay at the main destination instead of rushing to cover everything.' },
  { overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Took my parents on this group trip and they had the time of their lives! The pace was perfect for all ages — not too hectic, not too slow. Small personal touches by the organizer (birthday cake for my mom, extra chai stops) made it unforgettable. The all-inclusive pricing meant zero surprises. Already booked our next family trip on Safarnama!' },
  { overall: 4, org: 4, val: 4, safe: 5, acc: 3, comment: 'Beautiful locations and incredibly well-organized logistics — pickups were on time, hotels were pre-checked, and the itinerary ran like clockwork. Photography opportunities were endless. Only wish the schedule was less packed so we could soak in each spot longer. Pro tip: bring a power bank, the bus ride is long but scenic!' },
  { overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'This trip exceeded all expectations! The hidden gems we discovered are things even locals don\'t know about. The food trail was authentic and delicious — street food to home-cooked meals. Met 18 amazing people from across India. Safarnama\'s review system helped me pick the right organizer. Booking my next adventure immediately!' },
  { overall: 4, org: 4, val: 5, safe: 5, acc: 4, comment: 'Great budget group trip — honestly the best value travel package I have found in India. The organizer was responsive on WhatsApp throughout, accommodation was comfortable and clean, and the activities were well-spaced with no rushing. Would 100% recommend Safarnama for first-time group travelers. Already eyeing the Ladakh batch!' },
  { overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Our corporate team did this offsite trip and it was genuinely the best team building experience we have had. The organizer customized activities for our group size, the resort was premium, and the adventure challenges actually brought the team closer. GST invoice and seamless payment through Safarnama made our finance team happy too!' },
  { overall: 5, org: 5, val: 4, safe: 5, acc: 5, comment: 'Joined the women-only batch and it was such an empowering experience! All-female guides, safe accommodations, and a group of 14 incredible women from different cities. We hiked, we laughed, we cried at the sunset. If you are a solo woman traveler wondering whether to take the leap — DO IT. Safarnama verified this organizer and I felt safe throughout.' },
  { overall: 4, org: 5, val: 5, safe: 4, acc: 4, comment: 'Second trip booked through Safarnama and once again the experience was seamless. The early bird pricing saved me ₹2,000 which is a huge deal for a college student. The hostel was vibrant, the group was young and energetic, and the trek guide was certified and experienced. Will definitely be back for the monsoon batch!' },
  { overall: 5, org: 5, val: 5, safe: 5, acc: 5, comment: 'Came for the adventure, stayed for the people! This group trip had the perfect mix — adrenaline activities during the day and bonfire conversations at night. The organizer handled 22 people effortlessly and made sure dietary preferences were respected. The Safarnama app made it easy to track my booking, payment receipt, and trip details all in one place.' },
  { overall: 3, org: 4, val: 3, safe: 5, acc: 2, comment: 'Trip was okay but the listing photos were slightly misleading — the actual accommodation was simpler than shown. Having said that, the organizer was genuinely caring and safety was never a concern. The route and activities were good. Just manage expectations on the luxury front if you are booking a budget trip. Fair pricing though.' },
]

const ORG_REPLY_TEMPLATES = [
  'Thank you so much for the wonderful review! We are thrilled you had such an amazing group trip experience. Your safety and comfort are our top priorities — hope to welcome you on another Safarnama adventure soon!',
  'Your kind words mean the world to our team! We pour our hearts into curating authentic local experiences and your feedback motivates us to keep raising the bar. See you on the next batch!',
  'So glad you enjoyed the trip and the hidden gems we discovered together! We handpick every location, restaurant, and activity to make sure our travelers get the most authentic experience possible. Looking forward to hosting you again!',
  'Thank you for the honest feedback — we genuinely appreciate it! We have taken note of your suggestions about pacing and accommodation and are already improving for future batches. Your comfort matters and we want every trip to exceed expectations.',
  'It was wonderful having you on this trip! Solo travelers are the heart of our community and we love seeing friendships form on every batch. Your energy added so much to the group. See you on the next adventure!',
  'So happy the team outing exceeded expectations! We specialize in corporate group experiences that genuinely bring teams closer. Looking forward to planning your next offsite — we have some amazing new destinations coming up!',
  'Thank you for trusting us with your first solo trip! We take women traveler safety extremely seriously and we are so glad you felt secure and empowered throughout. Your review will inspire other women to take that first step!',
]

async function seedBulkReviews(_travelers: { id: string }[]) {
  // Find all COMPLETED trips that do NOT already have reviews — use existing bookings
  const completedTrips = await prisma.trip.findMany({
    where: { status: 'COMPLETED', isDeleted: false, reviews: { none: {} } },
    include: {
      destination: { select: { slug: true } },
      bookings: {
        where: { bookingStatus: 'COMPLETED', isDeleted: false },
        select: { id: true, userId: true },
        take: 5,
      },
    },
  })

  if (completedTrips.length === 0) {
    console.log('  ⚠ No unreviewed completed bulk trips found — skipping bulk reviews')
    return
  }

  let seedIdx = 5000
  let totalReviews = 0

  for (const trip of completedTrips) {
    if (trip.bookings.length === 0) continue

    // 3-5 reviews per trip, capped by available bookings
    const reviewCount = Math.min(3 + (seedIdx % 3), trip.bookings.length)
    const destSlug = trip.destination.slug.toLowerCase()
    const destPhotos = REVIEW_PHOTOS[destSlug] ?? REVIEW_PHOTOS.goa

    for (let r = 0; r < reviewCount; r++) {
      const booking = trip.bookings[r]
      const template = REVIEW_TEMPLATES[(seedIdx + r) % REVIEW_TEMPLATES.length]

      const photoCount = r % 3
      const photos = destPhotos.slice(0, photoCount)

      const hasReply = r % 5 < 2
      const replyTemplate = ORG_REPLY_TEMPLATES[(seedIdx + r) % ORG_REPLY_TEMPLATES.length]

      await safeReviewCreate({
        data: {
          tripId: trip.id,
          bookingId: booking.id,
          userId: booking.userId,
          overallRating: template.overall,
          organizationRating: template.org,
          valueRating: template.val,
          safetyRating: template.safe,
          accuracyRating: template.acc,
          comment: template.comment,
          photos,
          ...(hasReply && { organizerReply: replyTemplate, organizerReplyAt: new Date(Date.now() - (30 + r) * 86400000) }),
          createdAt: new Date(Date.now() - (60 + r * 5) * 86400000),
        },
      })
      totalReviews++
    }
    seedIdx++
  }

  console.log(`  ✓ Created ${totalReviews} bulk reviews across ${completedTrips.length} completed trips (with photos & organizer replies)`)
}

// ══════════════════════════════════════════════════════════
// ── BULK BOOKINGS, PAYMENTS & WALLETS ────────────────────
// ══════════════════════════════════════════════════════════

async function seedBulkBookingsAndPayments(travelers: { id: string }[]) {
  const t3 = travelers[2], t5 = travelers[4], t9 = travelers[8], t11 = travelers[10]
  let bRef = 7000
  const ref = () => `SFN-2026-${String(++bRef).padStart(4, '0')}`
  let payN = 200
  const payRef = () => ({ razorpayOrderId: `order_bulk_${++payN}`, razorpayPaymentId: `pay_bulk_${payN}` })

  // ── Fetch bulk ACTIVE + FULL trips (only those without bookings = bulk-seeded) ──
  // NOTE: mk() now creates bookings for all bulk trips, so this typically finds 0.
  const activeTrips = await prisma.trip.findMany({
    where: { status: { in: ['ACTIVE', 'FULL'] }, isDeleted: false, bookings: { none: {} }, tripRequests: { none: {} } },
    include: { destination: { select: { slug: true } }, transferPoints: true },
    take: 30,
  })

  if (activeTrips.length === 0) {
    console.log('  ⚠ No trips without bookings found — mk() already seeded all bookings. Skipping.')
    return
  }

  const requestTrips = activeTrips.filter(t => t.bookingMode === 'REQUEST_BASED')
  const instantTrips = activeTrips.filter(t => t.bookingMode === 'INSTANT')

  // ── Helper: get transfer points for a trip ──
  type TP = (typeof activeTrips)[number]['transferPoints'][number]
  const pickups = (trip: (typeof activeTrips)[number]): TP[] => trip.transferPoints.filter(tp => tp.type === 'PICKUP')
  const drops = (trip: (typeof activeTrips)[number]): TP[] => trip.transferPoints.filter(tp => tp.type === 'DROP')

  // ── Transfer point combo patterns (cycled across bookings) ──
  // 0 = Pune pickup (free) + Pune drop (free)
  // 1 = Pune pickup (free) + Hinjewadi drop (₹200 extra)
  // 2 = Mumbai pickup (₹500 extra) + Pune drop (free)
  // 3 = Mumbai pickup (₹500 extra) + Hinjewadi drop (₹200 extra) = ₹700 total
  // 4 = Pune pickup only (no drop)
  // 5 = drop only (no pickup)

  function applyTP(trip: (typeof activeTrips)[number], combo: number): { pickupPointId?: string; dropPointId?: string; extraCharge: number } {
    const pu = pickups(trip); const dr = drops(trip)
    if (!pu.length && !dr.length) return { extraCharge: 0 }
    const puFree = pu.find(p => p.extraCharge === 0)
    const puPaid = pu.find(p => p.extraCharge > 0)
    const drFree = dr.find(p => p.extraCharge === 0)
    const drPaid = dr.find(p => p.extraCharge > 0)
    switch (combo % 6) {
      case 0: return { pickupPointId: puFree?.id, dropPointId: drFree?.id, extraCharge: 0 }
      case 1: return { pickupPointId: puFree?.id, dropPointId: drPaid?.id ?? drFree?.id, extraCharge: drPaid?.extraCharge ?? 0 }
      case 2: return { pickupPointId: puPaid?.id ?? puFree?.id, dropPointId: drFree?.id, extraCharge: puPaid?.extraCharge ?? 0 }
      case 3: return { pickupPointId: puPaid?.id ?? puFree?.id, dropPointId: drPaid?.id ?? drFree?.id, extraCharge: (puPaid?.extraCharge ?? 0) + (drPaid?.extraCharge ?? 0) }
      case 4: return { pickupPointId: puFree?.id, extraCharge: 0 }
      case 5: return { dropPointId: drFree?.id, extraCharge: 0 }
      default: return { extraCharge: 0 }
    }
  }

  // ── 1) INSTANT BOOK — confirmed at regular price ──
  const instantConfirmed: { id: string; totalAmount: number }[] = []
  for (let i = 0; i < Math.min(instantTrips.length, 12); i++) {
    const trip = instantTrips[i]
    const trav = travelers[i % 12]
    const tp = applyTP(trip, i)
    const numT = 1 + (i % 2)
    const amount = trip.pricePerPerson * numT + tp.extraCharge * numT
    const b = await safeBookingCreate({ data: { bookingRef: ref(), tripId: trip.id, userId: trav.id, numTravelers: numT, totalAmount: amount, bookingStatus: 'CONFIRMED', ...(tp.pickupPointId && { pickupPointId: tp.pickupPointId }), ...(tp.dropPointId && { dropPointId: tp.dropPointId }) } })
    await safeTravelerCreateMany({ data: generateTravelerDetails(b.id, numT, bRef + i) })
    instantConfirmed.push(b)
  }

  // ── 2) EARLY BIRD — confirmed at earlyBirdPrice ──
  const earlyBirdTrips = instantTrips.filter(t => t.earlyBirdPrice)
  const earlyConfirmed: { id: string; totalAmount: number }[] = []
  for (let i = 0; i < Math.min(earlyBirdTrips.length, 8); i++) {
    const trip = earlyBirdTrips[i]
    const trav = travelers[(i + 4) % 12]
    const tp = applyTP(trip, i + 2) // offset combos for variety
    const numT = 1 + (i % 2)
    const price = trip.earlyBirdPrice! * numT + tp.extraCharge * numT
    const b = await safeBookingCreate({ data: { bookingRef: ref(), tripId: trip.id, userId: trav.id, numTravelers: numT, totalAmount: price, bookingStatus: 'CONFIRMED', ...(tp.pickupPointId && { pickupPointId: tp.pickupPointId }), ...(tp.dropPointId && { dropPointId: tp.dropPointId }) } })
    await safeTravelerCreateMany({ data: generateTravelerDetails(b.id, numT, bRef + i + 100) })
    earlyConfirmed.push(b)
  }

  // ── 3) CANCELLED bookings + refund payments ──
  const cancelledBookings: { id: string; totalAmount: number }[] = []
  const cancelReasons = ['Work emergency came up', 'Family medical situation', 'Travel plans changed', 'Could not get leave approved', 'Financial constraints']
  for (let i = 0; i < Math.min(instantTrips.length, 5); i++) {
    const trip = instantTrips[i]
    const trav = travelers[(i + 8) % 12]
    const tp = applyTP(trip, i + 3) // Mumbai pickup cancelled = user sees refund including extra charge
    const amount = trip.pricePerPerson + tp.extraCharge
    const b = await safeBookingCreate({ data: { bookingRef: ref(), tripId: trip.id, userId: trav.id, numTravelers: 1, totalAmount: amount, bookingStatus: 'CANCELLED', cancellationReason: cancelReasons[i], cancelledAt: new Date(Date.now() - (20 + i * 5) * 86400000), cancelledById: trav.id, ...(tp.pickupPointId && { pickupPointId: tp.pickupPointId }), ...(tp.dropPointId && { dropPointId: tp.dropPointId }) } })
    cancelledBookings.push(b)
  }

  // ── 4) PENDING_PAYMENT bookings (expiring soon) ──
  for (let i = 0; i < 3; i++) {
    const trip = instantTrips[i + 5] ?? instantTrips[i]
    const trav = travelers[(i + 6) % 12]
    const tp = applyTP(trip, i + 1)
    const amount = trip.pricePerPerson + tp.extraCharge
    await safeBookingCreate({ data: { bookingRef: ref(), tripId: trip.id, userId: trav.id, numTravelers: 1, totalAmount: amount, bookingStatus: 'PENDING_PAYMENT', expiresAt: new Date(Date.now() + (1 + i) * 86400000), ...(tp.pickupPointId && { pickupPointId: tp.pickupPointId }), ...(tp.dropPointId && { dropPointId: tp.dropPointId }) } })
  }

  // ── 5) REQUEST_BASED — approved + pending + rejected ──
  const requestConfirmed: { id: string; totalAmount: number }[] = []
  for (let i = 0; i < Math.min(requestTrips.length, 6); i++) {
    const trip = requestTrips[i]
    // Approved request → confirmed booking
    const trav = travelers[i % 12]
    const tp = applyTP(trip, i)
    const numT = 1 + (i % 2)
    const amount = trip.pricePerPerson * numT + tp.extraCharge * numT
    const b = await safeBookingCreate({ data: { bookingRef: ref(), tripId: trip.id, userId: trav.id, numTravelers: numT, totalAmount: amount, bookingStatus: 'CONFIRMED', ...(tp.pickupPointId && { pickupPointId: tp.pickupPointId }), ...(tp.dropPointId && { dropPointId: tp.dropPointId }) } })
    await safeTravelerCreateMany({ data: generateTravelerDetails(b.id, numT, bRef + i + 200) })
    await safeTripRequestCreate({ data: { tripId: trip.id, userId: trav.id, numTravelers: numT, message: 'I have relevant experience and would love to join this trip!', status: 'APPROVED', respondedAt: new Date(Date.now() - (15 + i) * 86400000), responseNote: 'Welcome! Payment link sent.', bookingId: b.id } })
    requestConfirmed.push(b)

    // Pending request
    if (i < 4) {
      const pt = travelers[(i + 3) % 12]
      await safeTripRequestCreate({ data: { tripId: trip.id, userId: pt.id, numTravelers: 1, message: 'First timer here. Very excited about this trip!', status: 'PENDING', approvalExpiresAt: new Date(Date.now() + 7 * 86400000) } })
    }
    // Rejected request
    if (i < 3) {
      const rt = travelers[(i + 7) % 12]
      await safeTripRequestCreate({ data: { tripId: trip.id, userId: rt.id, numTravelers: 1, message: 'Can I join even though I have no prior experience?', status: 'REJECTED', respondedAt: new Date(Date.now() - (10 + i) * 86400000), responseNote: 'Sorry, this trip requires prior experience for safety reasons.' } })
    }
  }
  console.log(`  ✓ Bulk bookings: ${instantConfirmed.length} instant + ${earlyConfirmed.length} early-bird + ${cancelledBookings.length} cancelled + 3 pending-payment + ${requestConfirmed.length} request-approved`)
  console.log('    ↳ Transfer point combos: free pickup+drop, paid pickup, paid drop, both paid, pickup-only, drop-only')

  // ── 6) PAYMENT TRANSACTIONS ──
  const allConfirmed = [...instantConfirmed, ...earlyConfirmed, ...requestConfirmed]
  for (const b of allConfirmed) {
    await safePaymentCreate({ data: { bookingId: b.id, type: 'PAYMENT', amount: b.totalAmount, status: 'CAPTURED', ...payRef() } })
  }
  // Refund payments for cancelled
  for (const b of cancelledBookings) {
    await safePaymentCreate({ data: { bookingId: b.id, type: 'PAYMENT', amount: b.totalAmount, status: 'CAPTURED', ...payRef() } })
    await safePaymentCreate({ data: { bookingId: b.id, type: 'REFUND', amount: Math.round(b.totalAmount * 0.85), status: 'REFUNDED', razorpayRefundId: `rfnd_bulk_${payN}`, ...payRef() } })
  }
  // Failed payment for one pending
  await safePaymentCreate({ data: { bookingId: (await prisma.booking.findFirst({ where: { bookingStatus: 'PENDING_PAYMENT' }, orderBy: { createdAt: 'desc' } }))!.id, type: 'PAYMENT', amount: 5999, status: 'FAILED', failureReason: 'Bank declined the transaction', ...payRef() } })
  console.log(`  ✓ Bulk payments: ${allConfirmed.length} captured + ${cancelledBookings.length} refunds + 1 failed`)

  // ── 7) WALLET TRANSACTIONS (cashbacks + refunds) ──
  // Traveler 5 (Saurabh): cashback on early bird
  const w5 = await prisma.wallet.findUnique({ where: { userId: t5.id } })
  if (w5) {
    await safeWalletTxCreate({ data: { walletId: w5.id, amount: 500, type: 'CASHBACK', referenceModel: 'Booking', referenceId: earlyConfirmed[0]?.id ?? 'bulk_cb_1', description: 'Early bird booking cashback', balanceBefore: 0, balanceAfter: 500 } })
    await prisma.wallet.update({ where: { id: w5.id }, data: { balance: 500 } })
  }
  // Traveler 9 (Nikhil): cancellation refund to wallet
  const w9 = await prisma.wallet.findUnique({ where: { userId: t9.id } })
  if (w9) {
    const refAmt = cancelledBookings[0] ? Math.round(cancelledBookings[0].totalAmount * 0.15) : 750
    await safeWalletTxCreate({ data: { walletId: w9.id, amount: refAmt, type: 'REFUND', referenceModel: 'Booking', referenceId: cancelledBookings[0]?.id ?? 'bulk_rf_1', description: 'Partial cancellation refund to wallet', balanceBefore: 0, balanceAfter: refAmt } })
    await prisma.wallet.update({ where: { id: w9.id }, data: { balance: refAmt } })
  }
  // Traveler 3 (Rohan): promo + used for booking
  const w3 = await prisma.wallet.findUnique({ where: { userId: t3.id } })
  if (w3) {
    await safeWalletTxCreate({ data: { walletId: w3.id, amount: 1000, type: 'PROMOTIONAL_CREDIT', referenceModel: 'User', referenceId: t3.id, description: 'Referral bonus — invited 2 friends', balanceBefore: 0, balanceAfter: 1000 } })
    await safeWalletTxCreate({ data: { walletId: w3.id, amount: 600, type: 'BOOKING_DEDUCTION', referenceModel: 'Booking', referenceId: requestConfirmed[0]?.id ?? 'bulk_bd_1', description: 'Wallet applied to Spiti booking', balanceBefore: 1000, balanceAfter: 400 } })
    await prisma.wallet.update({ where: { id: w3.id }, data: { balance: 400 } })
  }
  // Traveler 11 (Deepak): cashback from completed trip
  const w11 = await prisma.wallet.findUnique({ where: { userId: t11.id } })
  if (w11) {
    await safeWalletTxCreate({ data: { walletId: w11.id, amount: 350, type: 'CASHBACK', referenceModel: 'Booking', referenceId: instantConfirmed[2]?.id ?? 'bulk_cb_2', description: 'Trip completion cashback reward', balanceBefore: 0, balanceAfter: 350 } })
    await prisma.wallet.update({ where: { id: w11.id }, data: { balance: 350 } })
  }
  console.log('  ✓ Bulk wallet transactions: cashbacks, refunds, promo credits, deductions')
}

// ══════════════════════════════════════════════════════════
// ── VEHICLE LAYOUTS SEED ──────────────────────────────────
// ══════════════════════════════════════════════════════════

type CellType = 'SEAT' | 'DRIVER' | 'EMPTY' | 'BLOCKED'

interface VehicleLayoutDef {
  tripId: string
  label: string
  vehicleType: string
  rows: number
  cols: number
  aisleAfterCol: number | null
  layout: CellType[][]
}

const INNOVA_LAYOUT: CellType[][] = [
  ['SEAT', 'EMPTY', 'DRIVER'],
  ['SEAT', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'EMPTY'],
]

const TEMPO_LAYOUT: CellType[][] = [
  ['EMPTY', 'EMPTY', 'EMPTY', 'DRIVER'],
  ['SEAT', 'SEAT', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT', 'SEAT'],
  ['EMPTY', 'EMPTY', 'EMPTY', 'EMPTY'],
]

// ── Custom layouts (not from a template) ──
const CUSTOM_SUV_LAYOUT: CellType[][] = [
  ['DRIVER', 'EMPTY', 'SEAT'],
  ['SEAT', 'EMPTY', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT'],
]

const CUSTOM_MINIBUS_LAYOUT: CellType[][] = [
  ['EMPTY', 'EMPTY', 'EMPTY', 'EMPTY', 'DRIVER'],
  ['SEAT', 'SEAT', 'EMPTY', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'EMPTY', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'EMPTY', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT', 'SEAT', 'SEAT'],
]

const CUSTOM_VAN_LAYOUT: CellType[][] = [
  ['DRIVER', 'EMPTY', 'EMPTY', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT', 'SEAT'],
]

const CUSTOM_ERTIGA_LAYOUT: CellType[][] = [
  ['DRIVER', 'EMPTY', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT'],
  ['EMPTY', 'SEAT', 'SEAT'],
]

const CUSTOM_SLEEPER_LAYOUT: CellType[][] = [
  ['EMPTY', 'EMPTY', 'EMPTY', 'DRIVER'],
  ['SEAT', 'SEAT', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'SEAT', 'SEAT'],
  ['SEAT', 'SEAT', 'BLOCKED', 'BLOCKED'],
]

async function seedVehicleLayouts(trips: Record<string, { id: string }>) {
  const { tripU2, tripU7, tripU9, tripU11, tripU12 } = trips


  const defs: VehicleLayoutDef[] = [
    // ── tripU2 (Spiti): 1 predefined Innova + 1 custom SUV ──
    { tripId: tripU2.id, label: 'Innova Crysta — Spiti Primary', vehicleType: 'innova', rows: 4, cols: 3, aisleAfterCol: null, layout: INNOVA_LAYOUT },
    { tripId: tripU2.id, label: 'Custom SUV — Spiti Backup', vehicleType: 'custom', rows: 3, cols: 3, aisleAfterCol: null, layout: CUSTOM_SUV_LAYOUT },

    // ── tripU7 (Goa Monsoon): 1 predefined Tempo + 1 custom sleeper ──
    { tripId: tripU7.id, label: 'Tempo Traveller — Goa Pune', vehicleType: 'tempo', rows: 5, cols: 4, aisleAfterCol: 1, layout: TEMPO_LAYOUT },
    { tripId: tripU7.id, label: 'Custom Sleeper Coach — Goa Pune', vehicleType: 'custom', rows: 6, cols: 4, aisleAfterCol: 1, layout: CUSTOM_SLEEPER_LAYOUT },

    // ── tripU9 (Manali Summer): 1 predefined Innova + 1 custom Ertiga ──
    { tripId: tripU9.id, label: 'Innova Crysta — Manali Primary', vehicleType: 'innova', rows: 4, cols: 3, aisleAfterCol: null, layout: INNOVA_LAYOUT },
    { tripId: tripU9.id, label: 'Custom Ertiga — Manali Overflow', vehicleType: 'custom', rows: 4, cols: 3, aisleAfterCol: null, layout: CUSTOM_ERTIGA_LAYOUT },

    // ── tripU11 (Rishikesh): 1 predefined Tempo + 1 custom van ──
    { tripId: tripU11.id, label: 'Tempo Traveller — Rishikesh', vehicleType: 'tempo', rows: 5, cols: 4, aisleAfterCol: 1, layout: TEMPO_LAYOUT },
    { tripId: tripU11.id, label: 'Custom Adventure Van — Rishikesh', vehicleType: 'custom', rows: 3, cols: 4, aisleAfterCol: null, layout: CUSTOM_VAN_LAYOUT },

    // ── tripU12 (Jaipur): 1 predefined Tempo + 1 custom minibus ──
    { tripId: tripU12.id, label: 'Tempo Traveller — Jaipur Heritage', vehicleType: 'tempo', rows: 5, cols: 4, aisleAfterCol: 1, layout: TEMPO_LAYOUT },
    { tripId: tripU12.id, label: 'Custom Minibus — Jaipur Heritage', vehicleType: 'custom', rows: 5, cols: 5, aisleAfterCol: 2, layout: CUSTOM_MINIBUS_LAYOUT },
  ]

  const COL_LETTERS = 'ABCDEFGHIJ'

  for (const def of defs) {
    const vehicle = await safeVehicleCreate({
      data: {
        tripId: def.tripId,
        label: def.label,
        vehicleType: def.vehicleType,
        rows: def.rows,
        cols: def.cols,
        aisleAfterCol: def.aisleAfterCol,
        driverRow: 0,
        driverCol: def.cols - 1,
        layout: def.layout,
      },
    })

    let seatNumber = 1
    const seatData: { tripVehicleId: string; row: number; col: number; seatLabel: string; seatNumber: number; status: 'AVAILABLE' }[] = []

    for (let r = 0; r < def.rows; r++) {
      for (let c = 0; c < def.cols; c++) {
        if (def.layout[r][c] === 'SEAT') {
          seatData.push({
            tripVehicleId: vehicle.id,
            row: r,
            col: c,
            seatLabel: `${r + 1}${COL_LETTERS[c]}`,
            seatNumber: seatNumber++,
            status: 'AVAILABLE',
          })
        }
      }
    }

    await safeSeatCreateMany({ data: seatData })
  }

  console.log(`  ✓ Created ${defs.length} vehicle layouts with seat maps (5 predefined + 5 custom, 2 per trip)`)
}

// ══════════════════════════════════════════════════════════
// ── NOTIFICATIONS SEED ────────────────────────────────────
// ══════════════════════════════════════════════════════════

async function seedNotifications(adminId: string, organizerId: string, travelerId: string) {

  const now = new Date()
  const ago = (mins: number) => new Date(now.getTime() - mins * 60_000)

  const notifications: Prisma.NotificationCreateManyInput[] = [
    // ── TRAVELER (amit.kulkarni@gmail.com) ──
    { userId: travelerId, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed!', body: 'Your Goa Beach Carnival booking is confirmed. See you on Jan 10!', data: { bookingId: 'seed-bk-1', tripSlug: 'goa-beach-carnival-jan-2026' }, sentAt: ago(3), createdAt: ago(3) },
    { userId: travelerId, channel: 'IN_APP', type: 'PAYMENT_RECEIVED', title: 'Payment Received', body: '₹6,499 payment received for Goa Beach Carnival booking.', data: { amount: 6499 }, sentAt: ago(5), createdAt: ago(5) },
    { userId: travelerId, channel: 'IN_APP', type: 'TRIP_REMINDER', title: 'Trip Starting Soon!', body: 'Your Goa Beach Carnival trip starts in 3 days. Pack your bags!', data: { tripSlug: 'goa-beach-carnival-jan-2026' }, sentAt: ago(30), createdAt: ago(30) },
    { userId: travelerId, channel: 'IN_APP', type: 'REVIEW_REQUEST', title: 'How was your trip?', body: 'Share your experience from Rishikesh Rafting & Camping. Your review helps other travelers!', data: { tripSlug: 'rishikesh-rafting-camping-feb-2026' }, readAt: ago(200), sentAt: ago(1440), createdAt: ago(1440) },
    { userId: travelerId, channel: 'IN_APP', type: 'CHAT_MESSAGE', title: 'New message from Rajesh', body: 'Rajesh Khanna: "Hi! Pickup point is Shivaji Nagar Bus Stand, 8 PM sharp."', data: { conversationId: 'seed-conv-1' }, sentAt: ago(10), createdAt: ago(10) },
    { userId: travelerId, channel: 'IN_APP', type: 'TRIP_REQUEST_APPROVED', title: 'Trip Request Approved!', body: 'Your request to join Ladakh Bike Expedition has been approved. Complete payment within 48h.', data: { tripSlug: 'ladakh-bike-expedition-aug-2025' }, sentAt: ago(60), createdAt: ago(60) },
    { userId: travelerId, channel: 'IN_APP', type: 'BOOKING_CANCELLED', title: 'Booking Cancelled', body: 'Your Jaipur Heritage Experience booking has been cancelled. Refund will be processed in 5-7 days.', data: { bookingId: 'seed-bk-2' }, readAt: ago(3000), sentAt: ago(4320), createdAt: ago(4320) },
    { userId: travelerId, channel: 'IN_APP', type: 'REFUND_PROCESSED', title: 'Refund Processed', body: '₹5,999 refund for Jaipur Heritage Experience has been initiated to your bank account.', data: { amount: 5999 }, readAt: ago(2800), sentAt: ago(4200), createdAt: ago(4200) },
    { userId: travelerId, channel: 'IN_APP', type: 'PAYMENT_FAILED', title: 'Payment Failed', body: 'Your payment of ₹8,999 for Manali Snow Adventure failed. Please try again.', data: { amount: 8999 }, sentAt: ago(120), createdAt: ago(120) },
    { userId: travelerId, channel: 'IN_APP', type: 'SYSTEM_ALERT', title: 'Platform Maintenance', body: 'Scheduled maintenance on May 15, 2-4 AM IST. Bookings may be temporarily unavailable.', sentAt: ago(2880), createdAt: ago(2880), readAt: ago(2000) },

    // ── ORGANIZER (rajesh@desiexplorers.in) ──
    { userId: organizerId, channel: 'IN_APP', type: 'TRIP_REQUEST_RECEIVED', title: 'New Trip Request', body: 'Amit Kulkarni wants to join your Ladakh Bike Expedition. Review and respond.', data: { tripSlug: 'ladakh-bike-expedition-aug-2025', travelerName: 'Amit Kulkarni' }, sentAt: ago(90), createdAt: ago(90) },
    { userId: organizerId, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'New Booking!', body: 'Sneha Deshmukh just booked Goa Beach Carnival. 19/24 seats filled!', data: { bookingId: 'seed-bk-3', currentBookings: 19, maxGroupSize: 24 }, sentAt: ago(15), createdAt: ago(15) },
    { userId: organizerId, channel: 'IN_APP', type: 'PAYMENT_RECEIVED', title: 'Payment Received', body: '₹6,499 received from Sneha Deshmukh for Goa Beach Carnival.', data: { amount: 6499, travelerName: 'Sneha Deshmukh' }, sentAt: ago(15), createdAt: ago(15) },
    { userId: organizerId, channel: 'IN_APP', type: 'CHAT_MESSAGE', title: 'New message from Amit', body: 'Amit Kulkarni: "What should I pack for the Goa trip?"', data: { conversationId: 'seed-conv-1' }, sentAt: ago(8), createdAt: ago(8) },
    { userId: organizerId, channel: 'IN_APP', type: 'ORGANIZER_APPROVED', title: 'Profile Approved!', body: 'Congratulations! Your organizer profile "Desi Explorers" has been approved. Start creating trips!', data: { profileId: 'seed-profile-1' }, readAt: ago(40000), sentAt: ago(43200), createdAt: ago(43200) },
    { userId: organizerId, channel: 'IN_APP', type: 'REVIEW_REQUEST', title: 'New review received', body: 'Rohan Joshi left a 5-star review for Rishikesh Rafting & Camping.', data: { rating: 5, tripSlug: 'rishikesh-rafting-camping-feb-2026' }, readAt: ago(600), sentAt: ago(1440), createdAt: ago(1440) },
    { userId: organizerId, channel: 'IN_APP', type: 'BOOKING_CANCELLED', title: 'Booking Cancelled', body: 'Kavita Reddy cancelled her booking for Jaipur Heritage Experience. Seat released.', data: { bookingId: 'seed-bk-4', travelerName: 'Kavita Reddy' }, readAt: ago(3500), sentAt: ago(5760), createdAt: ago(5760) },
    { userId: organizerId, channel: 'IN_APP', type: 'TRIP_REQUEST_EXPIRED' as NotificationType, title: 'Trip Request Expired', body: 'Saurabh Patil\'s request for Ladakh Bike Expedition expired (no response in 48h).', data: { travelerName: 'Saurabh Patil' }, sentAt: ago(180), createdAt: ago(180) },
    { userId: organizerId, channel: 'IN_APP', type: 'SYSTEM_ALERT', title: 'Commission Update', body: 'Platform commission rate remains 10% for Q2 2026. No changes to your payout structure.', sentAt: ago(7200), createdAt: ago(7200), readAt: ago(6000) },

    // ── ADMIN (mandeep@safarnama.in) ──
    { userId: adminId, channel: 'IN_APP', type: 'ADMIN_SUPPORT_MESSAGE' as NotificationType, title: 'Support Ticket #1042', body: 'Amit Kulkarni reported an issue: "Refund not received for cancelled booking after 10 days."', data: { ticketId: '1042', userId: travelerId }, sentAt: ago(20), createdAt: ago(20) },
    { userId: adminId, channel: 'IN_APP', type: 'SYSTEM_ALERT', title: 'New Organizer Pending', body: 'Vikram Desai from "Sahyadri Adventures Club" submitted an organizer application. Review it.', data: { profileId: 'seed-pending-1' }, sentAt: ago(45), createdAt: ago(45) },
    { userId: adminId, channel: 'IN_APP', type: 'PAYMENT_FAILED', title: 'Payment Gateway Alert', body: '3 payment failures detected in the last hour. Razorpay may be experiencing issues.', data: { failureCount: 3 }, sentAt: ago(75), createdAt: ago(75) },
    { userId: adminId, channel: 'IN_APP', type: 'BOOKING_CONFIRMED', title: 'Platform Milestone!', body: 'Total platform bookings crossed 500. Goa Beach Carnival is the most popular trip this month.', data: { totalBookings: 500 }, readAt: ago(100), sentAt: ago(180), createdAt: ago(180) },
    { userId: adminId, channel: 'IN_APP', type: 'ORGANIZER_REJECTED', title: 'Organizer Rejected', body: 'Neha Gupta\'s application for "Budget Trails India" was rejected — incomplete bank details.', data: { profileId: 'seed-rejected-1' }, readAt: ago(5000), sentAt: ago(10080), createdAt: ago(10080) },
    { userId: adminId, channel: 'IN_APP', type: 'CHAT_MESSAGE', title: 'Flagged Message', body: 'Anti-leakage filter flagged a message in conversation between Amit and Rajesh (phone number detected).', data: { conversationId: 'seed-conv-1' }, sentAt: ago(35), createdAt: ago(35) },
    { userId: adminId, channel: 'IN_APP', type: 'REFUND_PROCESSED', title: 'Refund Completed', body: '₹5,999 refund processed for Kavita Reddy (Jaipur Heritage Experience). Transaction ID: TXN-RF-9847.', data: { amount: 5999, transactionId: 'TXN-RF-9847' }, readAt: ago(2500), sentAt: ago(4320), createdAt: ago(4320) },
    { userId: adminId, channel: 'IN_APP', type: 'TRIP_REQUEST_RECEIVED', title: 'High-Value Request', body: 'New request for ₹24,999 Ladakh Bike Expedition. Organizer has 48h to respond.', data: { amount: 24999 }, sentAt: ago(95), createdAt: ago(95) },
    { userId: adminId, channel: 'IN_APP', type: 'SYSTEM_ALERT', title: 'Daily Stats Summary', body: 'Today: 12 new bookings, 3 cancellations, ₹1.2L revenue, 2 new organizer applications.', data: { bookings: 12, cancellations: 3, revenue: 120000 }, sentAt: ago(1440), createdAt: ago(1440), readAt: ago(1300) },
  ]

  await safeNotifCreateMany({ data: notifications.map(n => ({ ...n, sentAt: n.sentAt, readAt: n.readAt ?? null })) })

  const unreadAdmin = notifications.filter(n => n.userId === adminId && !n.readAt).length
  const unreadOrg = notifications.filter(n => n.userId === organizerId && !n.readAt).length
  const unreadTrav = notifications.filter(n => n.userId === travelerId && !n.readAt).length
  console.log(`  ✓ Created ${notifications.length} notifications (Admin: ${unreadAdmin} unread, Organizer: ${unreadOrg} unread, Traveler: ${unreadTrav} unread)`)
}

// ══════════════════════════════════════════════════════════
// ── TRIP CATEGORIES, TYPE REQUESTS & EDIT HISTORY ─────────
// ══════════════════════════════════════════════════════════

async function seedTripCategoriesAndRequests(deps: {
  org1: { id: string }; org2: { id: string }; org3: { id: string }
  org4: { id: string }; org7: { id: string }; org8: { id: string }
  org1User: { id: string }; org2User: { id: string }; org3User: { id: string }
  org4User: { id: string }; org7User: { id: string }; org8User: { id: string }
  completedTrips: Record<string, { id: string }>
  upcomingTrips: Record<string, { id: string }>
}) {

  // ══════════════════════════════════════════════════════
  // ── 1) TRIP CATEGORIES ─────────────────────────────────
  // ══════════════════════════════════════════════════════

  const categories = [
    { value: 'BEACH', label: 'Beach', icon: '🏖️', sortOrder: 1 },
    { value: 'TREKKING', label: 'Trekking', icon: '🥾', sortOrder: 2 },
    { value: 'ADVENTURE', label: 'Adventure', icon: '🧗', sortOrder: 3 },
    { value: 'CULTURAL', label: 'Cultural', icon: '🏛️', sortOrder: 4 },
    { value: 'WEEKEND', label: 'Weekend Getaway', icon: '⛺', sortOrder: 5 },
    { value: 'ROAD_TRIP', label: 'Road Trip', icon: '🏍️', sortOrder: 6 },
    { value: 'SPIRITUAL', label: 'Spiritual', icon: '🕉️', sortOrder: 7 },
    { value: 'WILDLIFE', label: 'Wildlife Safari', icon: '🐅', sortOrder: 8 },
  ]

  for (const cat of categories) {
    await safeCategoryCreate({ data: cat })
  }
  console.log(`  ✓ Created ${categories.length} trip categories (6 in-use + 2 new: SPIRITUAL, WILDLIFE)`)

  // ══════════════════════════════════════════════════════
  // ── 2) TRIP TYPE REQUESTS ──────────────────────────────
  // ══════════════════════════════════════════════════════

  const { org1, org2, org3, org4, org7, org8 } = deps

  // ── PENDING requests (waiting for admin review) ──
  await safeTypeReqCreate({ data: {
    organizerId: org1.id,
    suggestedName: 'Camping',
    reason: 'Many of our Lonavala and Pawna Lake trips are primarily camping experiences — tent stays, bonfires, stargazing. "Weekend Getaway" doesn\'t capture the camping essence. A dedicated Camping category would help travelers find these trips faster.',
    status: 'PENDING',
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org7.id,
    suggestedName: 'Women-Only',
    reason: 'She Travels India exclusively organizes women-only group trips. Having a dedicated "Women-Only" trip type would let female solo travelers filter and discover safe, women-focused experiences instantly. Currently we tag them under various types which dilutes discoverability.',
    status: 'PENDING',
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org8.id,
    suggestedName: 'Corporate Offsite',
    reason: 'Corporate Escapes India runs team building and corporate retreat packages with GST invoicing, conference rooms, and group activities. These don\'t fit under "Adventure" or "Weekend" — they need a dedicated corporate category for B2B discovery.',
    status: 'PENDING',
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org2.id,
    suggestedName: 'Backpacking',
    reason: 'Budget backpacking trips across Northeast India and Himachal — hostel stays, local transport, flexible itineraries. Very different from organized group tours. A "Backpacking" category would attract the right audience who wants raw, unstructured travel.',
    status: 'PENDING',
  } })

  // ── APPROVED requests (admin reviewed and approved) ──
  await safeTypeReqCreate({ data: {
    organizerId: org3.id,
    suggestedName: 'Food Trail',
    reason: 'Nomad Trails India runs dedicated food-focused trips — Jaipur street food crawls, Varanasi kachori trails, Lucknow kebab walks. The food experience IS the trip, not a side activity. A "Food Trail" category would be a huge differentiator for the platform.',
    status: 'APPROVED',
    adminNote: 'Great suggestion! Food tourism is a growing segment in India. We\'ll add this as a new category once we have 5+ active food trail trips on the platform.',
    reviewedAt: d(2026, 4, 20),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org4.id,
    suggestedName: 'Festival Special',
    reason: 'Backpack Bharat runs special trips around Indian festivals — Holi in Mathura, Diwali in Varanasi, Rann Utsav in Kutch, Pushkar Camel Fair. These are time-sensitive, festival-themed experiences that don\'t fit existing categories.',
    status: 'APPROVED',
    adminNote: 'Approved! Festival tourism is huge for group travel. We\'ll create a "Festival Special" category and feature it during festival seasons.',
    reviewedAt: d(2026, 4, 25),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org1.id,
    suggestedName: 'Honeymoon',
    reason: 'We get many couples requesting romantic, honeymoon-focused itineraries — Udaipur, Andaman, Kerala backwaters. Having a "Honeymoon" category would help couples find curated romantic packages without scrolling through adventure trips.',
    status: 'APPROVED',
    adminNote: 'Makes sense — couples are 22% of our booking base. Adding "Honeymoon / Couples" as a category.',
    reviewedAt: d(2026, 3, 15),
  } })

  // ── REJECTED requests (admin reviewed and rejected) ──
  await safeTypeReqCreate({ data: {
    organizerId: org2.id,
    suggestedName: 'Luxury',
    reason: 'We want to offer premium luxury group trips — 5-star hotels, business class travel, private guides. A "Luxury" category would let high-budget travelers find these easily.',
    status: 'REJECTED',
    adminNote: 'We prefer to use price filters rather than a separate "Luxury" category. Luxury is a price tier, not a trip type. Organizers can mention "premium" or "luxury" in trip descriptions and set appropriate pricing. This keeps the category list clean.',
    reviewedAt: d(2026, 4, 10),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org3.id,
    suggestedName: 'Photography Tour',
    reason: 'Nomad Trails runs photography-focused trips with pro photographers — golden hour shoots, composition workshops, photo walks. A dedicated category would attract photography enthusiasts.',
    status: 'REJECTED',
    adminNote: 'Photography can be a tag/feature on any trip type rather than a standalone category. We\'ll add a "Photography" tag system in the next update so any trip can be marked as photography-friendly.',
    reviewedAt: d(2026, 4, 18),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org4.id,
    suggestedName: 'Hostel Hopping',
    reason: 'Budget travelers love hopping between hostels in different cities — Delhi to Rishikesh to Manali hostel circuit. A "Hostel Hopping" category would resonate with college students.',
    status: 'REJECTED',
    adminNote: 'This overlaps heavily with "Backpacking" which is already requested and under consideration. Hostel stays are an accommodation type, not a trip type. We recommend using the trip description to highlight hostel stays.',
    reviewedAt: d(2026, 5, 2),
  } })

  // ── Additional PENDING requests (for pagination testing) ──
  await safeTypeReqCreate({ data: {
    organizerId: org3.id,
    suggestedName: 'Cycling Tour',
    reason: 'Multi-day cycling tours from Manali to Leh, Munnar hills, Konkan coast. Cycling tourism is booming in India — a dedicated category would attract fitness-focused travelers.',
    status: 'PENDING',
    createdAt: d(2026, 5, 1),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org4.id,
    suggestedName: 'Volunteering',
    reason: 'Backpack Bharat partners with NGOs for voluntourism trips — teaching English in rural schools, beach cleanups in Goa, wildlife conservation in Jim Corbett. These deserve their own category.',
    status: 'PENDING',
    createdAt: d(2026, 5, 2),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org1.id,
    suggestedName: 'Houseboat Stay',
    reason: 'Kerala backwater houseboat experiences are unique — floating through canals, village visits from the boat, fresh seafood cooked onboard. Not beach, not adventure — it\'s its own thing.',
    status: 'PENDING',
    createdAt: d(2026, 5, 3),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org7.id,
    suggestedName: 'Wellness Retreat',
    reason: 'She Travels India runs Ayurveda and yoga retreat packages in Rishikesh, Goa, and Kerala. These are health and wellness focused, very different from adventure or cultural trips.',
    status: 'PENDING',
    createdAt: d(2026, 5, 4),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org2.id,
    suggestedName: 'Train Journey',
    reason: 'Scenic train journeys — Darjeeling toy train, Konkan Railway, Kalka-Shimla. The train IS the experience. We want to package multi-day rail adventures as a distinct trip type.',
    status: 'PENDING',
    createdAt: d(2026, 5, 5),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org8.id,
    suggestedName: 'Team Building',
    reason: 'Corporate team building activities — paintball, treasure hunts, obstacle courses — that are separate from full corporate offsites. Shorter duration, activity-focused.',
    status: 'PENDING',
    createdAt: d(2026, 5, 6),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org3.id,
    suggestedName: 'Stargazing',
    reason: 'Nomad Trails runs dedicated stargazing trips to dark-sky locations — Spiti, Rann of Kutch, Coorg. Telescopes, astrophotography workshops, overnight camping under the stars.',
    status: 'PENDING',
    createdAt: d(2026, 5, 7),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org4.id,
    suggestedName: 'Scuba & Diving',
    reason: 'Dedicated scuba diving trips to Andaman, Goa, Pondicherry, Netrani Island. PADI certification combos, multi-dive packages. Very different from general "Beach" trips.',
    status: 'PENDING',
    createdAt: d(2026, 5, 8),
  } })

  // ── Additional APPROVED requests ──
  await safeTypeReqCreate({ data: {
    organizerId: org2.id,
    suggestedName: 'Heritage Walk',
    reason: 'Walking tours through heritage cities — Old Delhi, Jaipur, Hampi, Pondicherry French Quarter. Guided by local historians, 3-4 hour walking experiences.',
    status: 'APPROVED',
    adminNote: 'Heritage walks are a great niche. Adding as a sub-category under Cultural initially, may promote to top-level if we get 10+ active trips.',
    reviewedAt: d(2026, 4, 28),
    createdAt: d(2026, 4, 15),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org7.id,
    suggestedName: 'Solo Female',
    reason: 'Distinct from Women-Only groups — these are curated itineraries designed for solo female travelers with safety-focused accommodations and local women guides.',
    status: 'APPROVED',
    adminNote: 'Approved! Solo female travel safety is a priority. We\'ll create this and feature it prominently.',
    reviewedAt: d(2026, 5, 1),
    createdAt: d(2026, 4, 20),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org1.id,
    suggestedName: 'Bike Rally',
    reason: 'Group motorcycle rallies — Royal Enfield runs to Ladakh, Spiti, Rajasthan. These are distinct from general road trips — it\'s the biking community experience.',
    status: 'APPROVED',
    adminNote: 'Bike rallies are hugely popular in India. Approved — adding under the adventure umbrella.',
    reviewedAt: d(2026, 5, 3),
    createdAt: d(2026, 4, 22),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org3.id,
    suggestedName: 'River Rafting',
    reason: 'Multi-day rafting expeditions on Ganges, Teesta, Zanskar. Not just a 2-hour activity — full camping + rafting packages over 3-5 days.',
    status: 'APPROVED',
    adminNote: 'Multi-day rafting is indeed distinct from general adventure. Approved!',
    reviewedAt: d(2026, 5, 5),
    createdAt: d(2026, 4, 25),
  } })

  // ── Additional REJECTED requests ──
  await safeTypeReqCreate({ data: {
    organizerId: org8.id,
    suggestedName: 'International',
    reason: 'We want to list international group trips — Thailand, Bali, Dubai. An "International" category would separate domestic from international.',
    status: 'REJECTED',
    adminNote: 'Safarnama currently focuses on domestic India travel. International trips are planned for Phase 3. Will revisit this request then.',
    reviewedAt: d(2026, 4, 22),
    createdAt: d(2026, 4, 12),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org2.id,
    suggestedName: 'Budget',
    reason: 'Trips under ₹3,000 per person. A "Budget" label would help price-sensitive travelers find affordable options quickly.',
    status: 'REJECTED',
    adminNote: 'Similar to "Luxury" — "Budget" is a price tier, not a trip type. Use the price filter and mention budget-friendly in the trip description.',
    reviewedAt: d(2026, 4, 30),
    createdAt: d(2026, 4, 18),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org4.id,
    suggestedName: 'Day Trip',
    reason: 'One-day excursions from cities — Pune to Lonavala, Bangalore to Nandi Hills, Mumbai to Alibaug. Quick escapes that don\'t need overnight stay.',
    status: 'REJECTED',
    adminNote: 'Trip duration is already indicated by start/end date. A "Day Trip" filter would be more appropriate than a category. We\'ll add duration-based filtering soon.',
    reviewedAt: d(2026, 5, 4),
    createdAt: d(2026, 4, 28),
  } })

  await safeTypeReqCreate({ data: {
    organizerId: org3.id,
    suggestedName: 'Pet Friendly',
    reason: 'Pet-friendly group trips with pet-allowed homestays and activities. Growing demand from pet parents who want to travel with their dogs.',
    status: 'REJECTED',
    adminNote: 'Interesting idea but too niche for a top-level category right now. We\'ll add a "Pet Friendly" tag/badge that can be applied to any trip type instead.',
    reviewedAt: d(2026, 5, 6),
    createdAt: d(2026, 5, 1),
  } })

  console.log('  ✓ Created 25 trip type requests (12 PENDING, 7 APPROVED, 6 REJECTED) from 6 different organizers')

  // ══════════════════════════════════════════════════════
  // ── 3) TRIP EDIT HISTORY ───────────────────────────────
  // ══════════════════════════════════════════════════════

  const { completedTrips: ct, upcomingTrips: ut } = deps

  // tripC1 (Goa Beach Carnival) — organizer updated price and description before trip started
  await safeEditHistCreate({ data: {
    tripId: ct.tripC1.id,
    editedById: deps.org1User.id,
    changedFields: ['pricePerPerson', 'earlyBirdPrice'],
    editNote: 'Reduced price from ₹7,499 to ₹6,499 for early bird promotion',
    snapshot: { pricePerPerson: 7499, earlyBirdPrice: 5999, title: 'Goa Beach Carnival — 3N/4D Beach Party, Watersports & Dudhsagar from Pune' },
    createdAt: d(2025, 12, 15),
  } })

  await safeEditHistCreate({ data: {
    tripId: ct.tripC1.id,
    editedById: deps.org1User.id,
    changedFields: ['description', 'inclusions'],
    editNote: 'Added spice plantation visit to itinerary and updated description',
    snapshot: { description: 'Original description before spice plantation was added...', inclusions: ['Resort (3N)', 'Breakfast + dinner', 'Water sports', 'North Goa tour'] },
    createdAt: d(2025, 12, 20),
  } })

  // tripU2 (Spiti Valley Circuit) — organizer adjusted dates and max group size
  await safeEditHistCreate({ data: {
    tripId: ut.tripU2.id,
    editedById: deps.org2User.id,
    changedFields: ['startDate', 'endDate'],
    editNote: 'Shifted start date by 2 days to avoid overlap with another batch',
    snapshot: { startDate: d(2026, 7, 8), endDate: d(2026, 7, 17) },
    createdAt: d(2026, 4, 28),
  } })

  await safeEditHistCreate({ data: {
    tripId: ut.tripU2.id,
    editedById: deps.org2User.id,
    changedFields: ['maxGroupSize', 'description'],
    editNote: 'Increased max group from 12 to 14 after securing additional vehicle',
    snapshot: { maxGroupSize: 12, description: 'Previous description before vehicle update...' },
    createdAt: d(2026, 5, 1),
  } })

  // tripU7 (Goa Monsoon) — organizer updated transfer points and cancellation policy
  await safeEditHistCreate({ data: {
    tripId: ut.tripU7.id,
    editedById: deps.org1User.id,
    changedFields: ['cancellationPolicy', 'itinerary'],
    editNote: 'Changed cancellation policy from STRICT to MODERATE based on traveler feedback',
    snapshot: { cancellationPolicy: 'STRICT', itinerary: [{ day: 1, title: 'Arrive Goa' }, { day: 2, title: 'North Goa Tour' }] },
    createdAt: d(2026, 5, 3),
  } })

  // tripU9 (Manali Summer) — organizer corrected pricing
  await safeEditHistCreate({ data: {
    tripId: ut.tripU9.id,
    editedById: deps.org3User.id,
    changedFields: ['pricePerPerson'],
    editNote: 'Price correction — was ₹12,999, should be ₹10,499 as advertised on social media',
    snapshot: { pricePerPerson: 12999 },
    createdAt: d(2026, 4, 15),
  } })

  // tripC3 (Rishikesh Rafting) — organizer added photos and updated itinerary after trip
  await safeEditHistCreate({ data: {
    tripId: ct.tripC3.id,
    editedById: deps.org1User.id,
    changedFields: ['photos', 'itinerary'],
    editNote: 'Added actual trip photos from the February batch for better listing accuracy',
    snapshot: { photos: ['https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=800'], itinerary: [{ day: 1, title: 'Arrive Rishikesh' }] },
    createdAt: d(2026, 3, 1),
  } })

  console.log('  ✓ Created 7 trip edit history entries across 5 trips (price changes, date shifts, policy updates)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

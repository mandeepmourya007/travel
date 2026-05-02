# Group Travel Aggregator — MVP Plan

A complete MVP blueprint for a group travel aggregator platform (web app), targeting Pune as the launch city.

---

## 1. MVP Scope — What's In vs What's Out

### IN (Build for MVP)

| Feature | Why It's Essential |
|---------|-------------------|
| Trip listing & search | Core product — users need to find trips |
| Trip comparison | Key differentiator vs Instagram |
| Trip detail page | SEO landing page + conversion page |
| Booking with Razorpay escrow | Prevents leakage, builds trust |
| User auth (signup/login) | Required for booking |
| Organizer auth & dashboard | Organizers need to list and manage trips |
| Review system | Trust moat — only post-trip, verified reviews |
| In-app chat (traveler ↔ organizer) | Keeps communication on-platform |
| Basic admin panel | Manage disputes, approve organizers |

### OUT (Deferred to Phase 2+)

| Feature | Why It Can Wait |
|---------|----------------|
| Mobile app | Web-first for SEO; mobile later |
| Trip protection insurance | Needs insurance partner; manual refunds for now |
| Organizer analytics dashboard | Not needed until 50+ organizers |
| AI recommendations | Not needed at MVP scale |
| Multi-city support | Launch Pune only; add cities later |
| Social features (trip photos, community) | Nice-to-have, not core |
| Surge/dynamic pricing | Needs data; implement after 6 months |

---

## 2. User Roles

| Role | Description |
|------|-------------|
| **Traveler** | Searches, compares, books trips |
| **Organizer** | Creates & manages trip listings, receives bookings |
| **Admin** | Approves organizers, handles disputes, monitors platform |

---

## 3. User Flows

### Traveler Flow

```
DISCOVERY:
  Landing Page → Browse Popular Destinations → Search/Filter Trips
    (destination, date, price range, trip type, group size)
    → Compare Trips (side-by-side, up to 3)
    → View Trip Detail (itinerary, reviews, organizer profile)
    → Save to Wishlist (optional)

BOOKING (Instant Mode — trip.bookingMode = INSTANT):
  Trip Detail → Click "Book Now" → Select travelers count
    → Fill traveler details → Razorpay checkout (UPI/Card/Net Banking)
    → Booking PENDING_PAYMENT (30min expiry window)
    → Payment captured (webhook) → Booking CONFIRMED
    → Receive confirmation (email + in-app notification)
    → Money held in escrow

BOOKING (Request Mode — trip.bookingMode = REQUEST_BASED):
  Trip Detail → Click "Request to Join" → Enter message + traveler count
    → TripRequest PENDING → Notification to organizer
    → Organizer approves → TripRequest APPROVED + notification to traveler
    → Traveler pays within 48h → Booking created → TripRequest CONVERTED
    → OR: 48h expires → TripRequest EXPIRED
    → OR: Organizer rejects → TripRequest REJECTED + notification

POST-TRIP:
  Trip completes → Leave Review (overall + organization + value + safety + accuracy)
    → Escrow released to organizer

CANCELLATION:
  My Bookings → Cancel Booking → Enter reason
    → Refund per cancellation policy (Flexible: full 48h before / Moderate: 50% / Strict: none)
    → Booking CANCELLED → Seat released (atomic decrement)
```

### Organizer Flow

```
ONBOARDING:
  Sign Up (email/Google) → Choose "I'm an Organizer" → Submit Verification
    (Aadhaar + PAN + business proof) → OrganizerProfile PENDING
    → Admin reviews → APPROVED or REJECTED → Notification sent
    → Link bank account (required before first payout)

TRIP MANAGEMENT:
  Organizer Dashboard → Create Trip Listing (structured form)
    → Set booking mode (Instant or Request-Based)
    → Add destination (from Destination lookup), dates, price, inclusions, photos
    → Save as DRAFT → Preview → Publish (status → ACTIVE)
    → Trip appears in search results

REQUEST HANDLING (Request-Based trips only):
  Dashboard → View pending TripRequests → Review traveler profile + message
    → Approve (traveler gets 48h pay window) or Reject (with note)

DURING TRIP LIFECYCLE:
  View bookings → Chat with travelers (anti-leakage filtered)
    → Trip happens → Admin/auto triggers escrow release
    → Payment transferred (minus platform commission)
    → View reviews + ratings

TRIP STATUS TRANSITIONS:
  DRAFT → ACTIVE → FULL (auto when currentBookings = maxGroupSize)
    → COMPLETED (after end date) → Escrow released
  ACTIVE → CANCELLED (organizer cancels → all travelers refunded)
```

### Admin Flow

```
ORGANIZER MANAGEMENT:
  Admin Dashboard → Pending Organizer Approvals queue
    → Review documents → Approve or Reject → Notification sent
    → AuditLog entry created

MONITORING:
  View all bookings → Handle disputes (Phase 2)
    → View flagged chat messages (anti-leakage triggers)
    → Platform stats (bookings, revenue, active trips)

ESCROW MANAGEMENT:
  Post-trip → Trigger escrow release to organizer
    → OrganizerPayout record created (Phase 2)
```

---

## 4. Pages & Wireframes

### Page 1: Home / Landing Page

```
┌─────────────────────────────────────────────────┐
│  LOGO                        Login | Sign Up     │
├─────────────────────────────────────────────────┤
│                                                   │
│   "Compare Group Trips. Book Safely."             │
│                                                   │
│   ┌───────────────────────────────────────┐       │
│   │ 🔍 Where do you want to go?           │       │
│   │    [Destination]  [Date]  [Search]     │       │
│   └───────────────────────────────────────┘       │
│                                                   │
├─────────────────────────────────────────────────┤
│  POPULAR DESTINATIONS (from Pune)                 │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐             │
│  │Goa  │  │Manali│  │Lonav│  │Gokrn│             │
│  │₹3.5K│  │₹5.2K│  │₹1.8K│  │₹4.0K│             │
│  │12trp│  │8trip │  │15trp│  │6trip │             │
│  └─────┘  └─────┘  └─────┘  └─────┘             │
│                                                   │
├─────────────────────────────────────────────────┤
│  TRENDING TRIPS THIS WEEKEND                      │
│  [Trip Card] [Trip Card] [Trip Card]              │
│                                                   │
├─────────────────────────────────────────────────┤
│  WHY BOOK WITH US                                 │
│  ✅ Compare trips    ✅ Escrow payments            │
│  ✅ Verified reviews ✅ Cancellation protection    │
│                                                   │
├─────────────────────────────────────────────────┤
│  "Are you a trip organizer?" → [List Your Trips]  │
│                                                   │
├─────────────────────────────────────────────────┤
│  Footer: About | Contact | Terms | Privacy        │
└─────────────────────────────────────────────────┘
```

**SEO target:** "group trips from Pune", "weekend trips near Pune"

---

### Page 2: Search Results / Trip Listing

```
┌─────────────────────────────────────────────────┐
│  LOGO          [Search Bar]        Login | User   │
├─────────────────────────────────────────────────┤
│                                                   │
│  FILTERS (sidebar or top bar)                     │
│  ┌──────────────────────────────┐                 │
│  │ Destination: [Dropdown]      │                 │
│  │ Date Range:  [Picker]        │                 │
│  │ Price:       [₹0 ━━━━ ₹10K] │                 │
│  │ Group Size:  [5-30]          │                 │
│  │ Trip Type:   [Adventure|     │                 │
│  │    Weekend|Trekking|Beach]   │                 │
│  │ Sort:        [Price|Rating|  │                 │
│  │    Date|Popularity]          │                 │
│  │ [Compare Selected] button    │                 │
│  └──────────────────────────────┘                 │
│                                                   │
│  RESULTS: "15 trips to Goa this weekend"          │
│                                                   │
│  ┌──────────────────────────────────────┐         │
│  │ ☐ Trip Card                          │         │
│  │ ┌──────┐  Goa Beach Getaway          │         │
│  │ │ IMG  │  by TripVibes ✅ Verified    │         │
│  │ └──────┘  ⭐ 4.7 (38 reviews)        │         │
│  │           Dec 6-8 | 3D/2N            │         │
│  │           ₹4,500/person              │         │
│  │           12/20 seats left           │         │
│  │           🟢 Instant Book / 🟡 Request│        │
│  │           Includes: 🚌🏨🍽️           │         │
│  │           [View Details] [Compare]   │         │
│  └──────────────────────────────────────┘         │
│                                                   │
│  ┌──────────────────────────────────────┐         │
│  │ ☐ Trip Card (same structure)         │         │
│  └──────────────────────────────────────┘         │
│                                                   │
│  [Load More / Pagination]                         │
└─────────────────────────────────────────────────┘
```

**Key features:**
- Checkbox to select trips for comparison
- Inclusion icons (transport/stay/meals) for quick scanning
- Verified badge for approved organizers

---

### Page 3: Trip Comparison (Side-by-Side)

```
┌──────────────────────────────────────────────────┐
│  COMPARING 3 TRIPS TO GOA                         │
├──────────┬──────────┬──────────┬─────────────────┤
│          │ Trip A   │ Trip B   │ Trip C           │
├──────────┼──────────┼──────────┼─────────────────┤
│ Organizer│ TripVibes│ GoWander │ PuneTrails       │
│ Rating   │ ⭐4.7    │ ⭐4.3    │ ⭐4.9             │
│ Reviews  │ 38       │ 12       │ 52               │
│ Price    │ ₹4,500   │ ₹3,800   │ ₹5,200           │
│ Dates    │ Dec 6-8  │ Dec 6-8  │ Dec 7-9          │
│ Duration │ 3D/2N    │ 3D/2N    │ 3D/2N            │
│ Group    │ 20 ppl   │ 15 ppl   │ 12 ppl           │
│ Seats    │ 8 left   │ 3 left   │ 5 left           │
│ Transport│ AC Bus   │ Non-AC   │ AC Bus            │
│ Stay     │ 3★ Hotel │ Hostel   │ 4★ Resort         │
│ Meals    │ All      │ Bfast    │ All               │
│ Cancell. │ Free 48h │ No refnd │ Free 72h          │
│          │ [Book]   │ [Book]   │ [Book]            │
├──────────┴──────────┴──────────┴─────────────────┤
│ 💡 Best Value: Trip B | Best Rated: Trip C        │
└──────────────────────────────────────────────────┘
```

**This is your killer feature.** No Instagram page offers this.

---

### Page 4: Trip Detail Page

```
┌─────────────────────────────────────────────────┐
│  ← Back to results                               │
├─────────────────────────────────────────────────┤
│                                                   │
│  [Image Gallery / Carousel - 4-5 trip photos]     │
│                                                   │
├──────────────────────┬──────────────────────────┤
│  LEFT (65%)          │  RIGHT (35%) - Sticky     │
│                      │                           │
│  GOA BEACH GETAWAY   │  ┌─────────────────────┐  │
│  by TripVibes ✅      │  │ ₹4,500 / person     │  │
│  ⭐ 4.7 (38 reviews) │  │                     │  │
│                      │  │ IF INSTANT:          │  │
│  ITINERARY           │  │ [Book Now - ₹4,500] │  │
│  Day 1: Pune→Goa     │  │                     │  │
│    - Pickup 6AM      │  │ IF REQUEST_BASED:    │  │
│    - Beach visit     │  │ [Request to Join]   │  │
│    - Dinner          │  │ (status badge if    │  │
│  Day 2: Water sports │  │  already requested) │  │
│    - Parasailing     │  │                     │  │
│    - Dudhsagar falls │  │ ✅ Escrow protected  │  │
│  Day 3: Goa→Pune     │  │ ✅ Free cancel 48h   │  │
│                      │  │ ✅ Verified organizer│  │
│                      │  │ [Chat with Organizer]│ │
│  WHAT'S INCLUDED     │  └─────────────────────┘  │
│  ✅ AC bus transport  │                           │
│  ✅ 3★ hotel (twin)  │                           │
│  ✅ All meals         │                           │
│  ✅ Water sports      │                           │
│  ❌ Personal expenses │                           │
│  ❌ Travel insurance  │                           │
│                      │                           │
│  CANCELLATION POLICY │                           │
│  - 48h+ before: Full │                           │
│  - 24-48h: 50%       │                           │
│  - <24h: No refund   │                           │
│                      │                           │
│  ABOUT THE ORGANIZER │                           │
│  TripVibes ✅         │                           │
│  ⭐ 4.7 | 38 reviews │                           │
│  120 trips completed │                           │
│  "Active since 2023" │                           │
│                      │                           │
│  REVIEWS             │                           │
│  ⭐⭐⭐⭐⭐ "Amazing trip│                           │
│  well organized..."  │                           │
│  - Priya, Nov 2025   │                           │
│                      │                           │
│  ⭐⭐⭐⭐ "Good but bus │                           │
│  was late by 1 hour" │                           │
│  - Rahul, Oct 2025   │                           │
├──────────────────────┴──────────────────────────┤
│  SIMILAR TRIPS TO GOA                             │
│  [Trip Card] [Trip Card] [Trip Card]              │
└─────────────────────────────────────────────────┘
```

**SEO target:** "Goa trip from Pune December 2025", "Goa group tour ₹4500"

---

### Page 5: Booking & Payment

```
┌─────────────────────────────────────────────────┐
│  BOOKING: Goa Beach Getaway                       │
├─────────────────────────────────────────────────┤
│                                                   │
│  Trip Summary                                     │
│  ┌─────────────────────────────────────┐          │
│  │ Goa Beach Getaway by TripVibes      │          │
│  │ Dec 6-8, 2025 | 3D/2N              │          │
│  │ AC Bus + 3★ Hotel + All Meals       │          │
│  └─────────────────────────────────────┘          │
│                                                   │
│  Number of travelers: [1] [2] [3] [+]             │
│                                                   │
│  Traveler 1 (You)                                 │
│  Name:    [Pre-filled from profile]               │
│  Phone:   [Pre-filled]                            │
│  Age:     [__]                                    │
│  Gender:  [M/F/Other]                             │
│  Emergency Contact: [Name] [Phone]                │
│                                                   │
│  Traveler 2 (if applicable)                       │
│  Name: [__]  Phone: [__]  Age: [__]               │
│                                                   │
│  ─────────────────────────────────────            │
│  PRICE BREAKDOWN                                  │
│  Trip cost:           ₹4,500 x 1 = ₹4,500        │
│  Trip protection:     ₹149 (optional) [✅]        │
│  ──────────────────────────────────               │
│  Total:               ₹4,649                      │
│                                                   │
│  ✅ Your money is held safely in escrow            │
│  ✅ Released to organizer after trip completion     │
│  ✅ Full refund if organizer cancels               │
│                                                   │
│  [Pay ₹4,649 with Razorpay]                       │
│  (UPI / Cards / Net Banking / Wallets)             │
│                                                   │
│  By booking, you agree to Terms & Cancellation     │
│  Policy.                                           │
└─────────────────────────────────────────────────┘
```

---

### Page 6: Booking Confirmation

```
┌─────────────────────────────────────────────────┐
│                                                   │
│  ✅ BOOKING CONFIRMED!                            │
│                                                   │
│  Booking ID: #TRP-2025-0847                       │
│  Goa Beach Getaway | Dec 6-8                      │
│  1 traveler | ₹4,649 paid                         │
│                                                   │
│  Payment Status: Held in Escrow ✅                 │
│                                                   │
│  WHAT'S NEXT:                                     │
│  1. Organizer will confirm within 24 hours        │
│  2. You'll receive pickup details via chat         │
│  3. Join the trip group chat                       │
│                                                   │
│  [Chat with Organizer]  [View My Bookings]        │
│                                                   │
│  📧 Confirmation sent to your email                │
│  📱 SMS sent to your phone                         │
└─────────────────────────────────────────────────┘
```

---

### Page 7: User Dashboard (Traveler)

```
┌─────────────────────────────────────────────────┐
│  LOGO           [Search]         🔔  [Profile]   │
├──────────┬──────────────────────────────────────┤
│ SIDEBAR  │  MY TRIPS                             │
│          │                                       │
│ Upcoming │  UPCOMING                             │
│ Past     │  ┌──────────────────────────────┐     │
│ Messages │  │ Goa Beach Getaway            │     │
│ Profile  │  │ Dec 6-8 | ₹4,649            │     │
│ Settings │  │ Status: Confirmed ✅          │     │
│          │  │ [Chat] [View Details] [Cancel]│     │
│          │  └──────────────────────────────┘     │
│          │                                       │
│          │  PAST TRIPS                           │
│          │  ┌──────────────────────────────┐     │
│          │  │ Manali Adventure             │     │
│          │  │ Nov 15-18 | ₹5,200           │     │
│          │  │ Status: Completed ✅          │     │
│          │  │ [Leave Review] [View Details] │     │
│          │  └──────────────────────────────┘     │
│          │                                       │
│          │  MESSAGES                              │
│          │  TripVibes: "Pickup at 6AM..."  2h    │
│          │  GoWander: "Trip confirmed!"    1d    │
└──────────┴──────────────────────────────────────┘
```

---

### Page 8: Organizer Dashboard

```
┌─────────────────────────────────────────────────┐
│  LOGO        ORGANIZER DASHBOARD       [Profile] │
├──────────┬──────────────────────────────────────┤
│ SIDEBAR  │  OVERVIEW                             │
│          │  ┌────────┐ ┌────────┐ ┌────────┐    │
│ Overview │  │Active  │ │Bookings│ │Revenue │    │
│ My Trips │  │Trips: 5│ │This Mo:│ │This Mo:│    │
│ Requests │  │        │ │32      │ │₹1.2L   │    │
│ Bookings │  └────────┘ └────────┘ └────────┘    │
│ Messages │                                       │
│ Reviews  │  PENDING REQUESTS (3)                  │
│ Payments │  ┌──────────────────────────────┐     │
│ Profile  │  │ Priya S. wants to join       │     │
│          │  │ Goa Beach Getaway (2 ppl)    │     │
│          │  │ "Hi, excited about this!"    │     │
│          │  │ [Approve] [Reject]           │     │
│          │  └──────────────────────────────┘     │
│          │                                       │
│          │  MY ACTIVE TRIPS                      │
│          │  ┌──────────────────────────────┐     │
│ [+ New   │  │ Goa Beach Getaway            │     │
│  Trip]   │  │ Dec 6-8 | 12/20 booked      │     │
│          │  │ Revenue: ₹54,000             │     │
│          │  │ [Edit] [View Bookings]       │     │
│          │  └──────────────────────────────┘     │
│          │                                       │
│          │  RECENT BOOKINGS                      │
│          │  Priya S. booked Goa trip    2h ago   │
│          │  Rahul M. booked Goa trip    5h ago   │
│          │                                       │
│          │  RECENT REVIEWS                       │
│          │  ⭐⭐⭐⭐⭐ "Amazing!" - Sneha   1d ago  │
│          │  ⭐⭐⭐⭐ "Good trip" - Amit     3d ago  │
└──────────┴──────────────────────────────────────┘
```

---

### Page 9: Create/Edit Trip (Organizer)

```
┌─────────────────────────────────────────────────┐
│  CREATE NEW TRIP                                  │
├─────────────────────────────────────────────────┤
│                                                   │
│  BASIC INFO                                       │
│  Trip Title:      [Goa Beach Getaway           ]  │
│  Destination:     [Goa     ▼]                     │
│  Trip Type:       [Beach ▼] (Adventure/Weekend/   │
│                    Trekking/Cultural/Road Trip)    │
│  Description:     [Rich text editor            ]  │
│                                                   │
│  DATES & CAPACITY                                 │
│  Start Date:      [Dec 6, 2025]                   │
│  End Date:        [Dec 8, 2025]                   │
│  Group Size:      Min [10]  Max [20]              │
│  Booking Deadline: [Dec 4, 2025]                  │
│                                                   │
│  PRICING                                          │
│  Price per person: [₹4,500]                       │
│  Early bird price: [₹4,000] (optional)            │
│  Early bird deadline: [Nov 25]                    │
│                                                   │
│  INCLUSIONS (checkboxes)                          │
│  ☑ Transport  Type: [AC Bus ▼]                    │
│  ☑ Stay       Type: [3★ Hotel ▼]                  │
│  ☑ Meals      Which: [All ▼]                      │
│  ☑ Activities List: [Water sports, sightseeing]   │
│  ☐ Insurance                                      │
│                                                   │
│  ITINERARY                                        │
│  Day 1: [Title] [Description]  [+ Add Activity]  │
│  Day 2: [Title] [Description]  [+ Add Activity]  │
│  [+ Add Day]                                      │
│                                                   │
│  BOOKING MODE                                     │
│  ◉ Instant Book  — travelers pay directly          │
│  ○ Request-Based — you screen travelers first      │
│                                                   │
│  CANCELLATION POLICY                              │
│  [Flexible ▼]                                     │
│   - Flexible: Full refund 48h before              │
│   - Moderate: Full refund 72h, 50% after          │
│   - Strict: No refunds                            │
│                                                   │
│  PHOTOS (upload directly to Cloudinary)            │
│  [Upload up to 8 photos]                          │
│  [📷] [📷] [📷] [+ Add]                            │
│                                                   │
│  PICKUP INFO                                      │
│  Pickup Location: [Pune - Shivajinagar Bus Stop]  │
│  Pickup Time:     [6:00 AM]                       │
│                                                   │
│  [Preview]  [Save Draft]  [Publish Trip]          │
└─────────────────────────────────────────────────┘
```

---

### Page 10: In-App Chat

```
┌─────────────────────────────────────────────────┐
│  MESSAGES                                         │
├──────────┬──────────────────────────────────────┤
│ CONTACTS │  CHAT: TripVibes (Organizer)          │
│          │                                       │
│ TripVibes│  ┌────────────────────────────┐       │
│  ● Online│  │ TripVibes: Hi! Thanks for  │       │
│          │  │ booking. Pickup is at       │       │
│ GoWander │  │ Shivajinagar at 6AM.       │       │
│  ○ 2h ago│  │                    10:30AM │       │
│          │  ├────────────────────────────┤       │
│          │  │ You: Got it! Can I bring   │       │
│          │  │ a friend? 1 more seat?     │       │
│          │  │                    10:45AM │       │
│          │  ├────────────────────────────┤       │
│          │  │ TripVibes: Yes! Ask them   │       │
│          │  │ to book through the        │       │
│          │  │ platform.                  │       │
│          │  │                    10:50AM │       │
│          │  └────────────────────────────┘       │
│          │                                       │
│          │  ⚠️ Sharing phone numbers or           │
│          │  payment details is not allowed.       │
│          │                                       │
│          │  [Type a message...]     [Send]        │
└──────────┴──────────────────────────────────────┘
```

**Anti-leakage:** Chat filters auto-detect phone numbers, UPI IDs, Instagram handles.

---

### Page 11: Review Page (Post-Trip)

```
┌─────────────────────────────────────────────────┐
│  REVIEW YOUR TRIP                                 │
├─────────────────────────────────────────────────┤
│                                                   │
│  Goa Beach Getaway by TripVibes                   │
│  Dec 6-8, 2025                                    │
│                                                   │
│  Overall Rating:  ⭐ ⭐ ⭐ ⭐ ⭐                     │
│                                                   │
│  Rate specific aspects:                           │
│  Organization:    ⭐ ⭐ ⭐ ⭐ ⭐                     │
│  Value for Money: ⭐ ⭐ ⭐ ⭐ ☆                     │
│  Safety:          ⭐ ⭐ ⭐ ⭐ ⭐                     │
│  As Described:    ⭐ ⭐ ⭐ ⭐ ☆                     │
│                                                   │
│  Was the trip as listed?  [Yes / Partially / No]  │
│                                                   │
│  Write your review:                               │
│  [                                             ]  │
│  [                                             ]  │
│                                                   │
│  Upload trip photos (optional):                   │
│  [📷] [📷] [+ Add]                                 │
│                                                   │
│  [Submit Review]                                  │
│                                                   │
│  ℹ️ Only travelers who completed this trip can     │
│  leave a review.                                   │
└─────────────────────────────────────────────────┘
```

---

### Page 12: Auth Pages (Login / Signup)

```
SIGNUP:
┌─────────────────────────────────┐
│  Join TripCompare               │
│                                 │
│  I am a: [Traveler] [Organizer] │
│                                 │
│  Full Name:  [___________]      │
│  Email:      [___________]      │
│  Phone:      [+91________]      │
│  Password:   [___________]      │
│                                 │
│  [Sign Up with Google]          │
│  [Sign Up with Email]           │
│                                 │
│  Already have an account? Login │
└─────────────────────────────────┘

LOGIN:
┌─────────────────────────────────┐
│  Welcome Back                   │
│                                 │
│  Email/Phone: [___________]     │
│  Password:    [___________]     │
│                                 │
│  [Login]                        │
│  [Login with Google]            │
│  [Forgot Password?]             │
│                                 │
│  New here? Sign Up              │
└─────────────────────────────────┘
```

**Organizer signup** has additional step: verification docs upload (Aadhaar/PAN + business proof).

---

## 5. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 14 + Tailwind CSS | SSR for SEO, fast, modern React |
| **UI Components** | shadcn/ui | Beautiful, accessible, customizable |
| **Backend** | Express + TypeScript (separate `apps/api`) | Clean separation, independent deploy, Socket.IO support |
| **Database** | PostgreSQL (via Supabase or Neon) | Relational data, scalable, free tier |
| **ORM** | Prisma | Type-safe, great DX |
| **Auth** | JWT (access + refresh) + bcrypt + Google OAuth | Lightweight, no vendor lock-in, httpOnly cookies |
| **Payments** | Razorpay (Escrow mode) | Indian payments, escrow built-in |
| **File Storage** | Cloudinary | Trip photos, user avatars, CDN built-in |
| **Chat** | Socket.IO | Real-time in-app messaging with anti-leakage filters |
| **Hosting** | Vercel (FE) + Railway/Render (BE) | Free tiers, independent scaling |
| **Search** | PostgreSQL full-text (MVP) | Good enough for launch; Algolia later |
| **Cache** | Upstash Redis | Rate limiting, session cache, Socket.IO adapter |
| **Logging** | Pino | Structured JSON logging, fastest Node.js logger |

> **Note:** Full architecture details, folder structure, and design patterns are in [`docs/engineering/tech-stack.md`](../engineering/tech-stack.md).

---

## 6. Database Schema (Key Entities)

```
SOFT-DELETE MIXIN (applied to every table below):
├── is_active (boolean, default: true)
├── is_deleted (boolean, default: false)
├── created_at (timestamp)
├── updated_at (timestamp)
├── deleted_at (timestamp, nullable)
NOTE: NEVER hard-delete rows. All queries filter WHERE is_deleted = false.

USERS
├── id (cuid)
├── name
├── email (unique)
├── phone (unique, nullable)
├── password_hash
├── google_id (unique, nullable)
├── role (traveler | organizer | admin)
├── avatar_url
├── aadhaar_verified (boolean)
├── [mixin fields]

ORGANIZER_PROFILES
├── id
├── user_id → USERS (unique)
├── business_name
├── description
├── verification_status (pending | approved | rejected)
├── rating (avg float)
├── total_reviews
├── total_trips_completed
├── documents (JSON - Aadhaar, PAN, etc.)
├── [mixin fields]

TRIPS
├── id
├── organizer_id → ORGANIZER_PROFILES
├── title
├── slug (unique, for SEO URLs)
├── destination
├── trip_type (adventure | weekend | trekking | beach | cultural | road_trip)
├── description
├── itinerary (JSON - day-wise)
├── start_date
├── end_date
├── booking_deadline (nullable, default: start_date - 24h)
├── price_per_person (integer, whole rupees)
├── early_bird_price
├── early_bird_deadline
├── min_group_size
├── max_group_size
├── current_bookings (count — only CONFIRMED, atomic increment)
├── inclusions (JSON - transport, stay, meals, activities)
├── cancellation_policy (flexible | moderate | strict)
├── pickup_location
├── pickup_time
├── photos (array of Cloudinary URLs)
├── status (draft | active | full | completed | cancelled)
├── [mixin fields]

BOOKINGS
├── id
├── booking_ref (TRP-2025-XXXX, unique)
├── trip_id → TRIPS
├── user_id → USERS
├── num_travelers
├── traveler_details (JSON - name, phone, age, gender per person)
├── emergency_contact (JSON)
├── amount_paid (integer, whole rupees)
├── trip_protection (boolean)
├── razorpay_order_id
├── razorpay_payment_id
├── escrow_status (held | released | refunded)
├── booking_status (pending_payment | confirmed | cancelled | completed | refunded | expired)
├── expires_at (nullable — PENDING_PAYMENT expires after 30min)
├── [mixin fields]

REVIEWS
├── id
├── trip_id → TRIPS
├── booking_id → BOOKINGS (unique)
├── user_id → USERS
├── overall_rating (1-5)
├── organization_rating
├── value_rating
├── safety_rating
├── accuracy_rating
├── comment
├── photos (JSON)
├── [mixin fields]

CONVERSATIONS
├── id
├── trip_id → TRIPS
├── traveler_id → USERS
├── organizer_profile_id → ORGANIZER_PROFILES
├── last_message_at
├── [mixin fields]

MESSAGES
├── id
├── conversation_id → CONVERSATIONS
├── sender_id → USERS
├── content (text, filtered for phone/UPI)
├── is_flagged (boolean)
├── [mixin fields]

WEBHOOK_EVENTS (audit log — no soft-delete)
├── id
├── event_id (unique — Razorpay event ID for idempotency)
├── event (string)
├── payload (JSON)
├── status (processing | completed | failed)
├── created_at
├── updated_at
```

> **Note:** Full Prisma schema with exact types, relations, and indexes is in [`docs/engineering/tech-stack.md`](../engineering/tech-stack.md) Section 10.

---

## 7. Third-Party Integrations

| Service | Purpose | Cost |
|---------|---------|------|
| **Razorpay** | Payments + Escrow | 2% per transaction |
| **Google OAuth** | Social login | Free |
| **Cloudinary** | Image hosting + optimization | Free tier (25K transforms/mo) |
| **Resend or Nodemailer** | Transactional emails (booking confirmation) | Free tier |
| **MSG91 or Twilio** | OTP / SMS notifications | ~₹0.15-0.25 per SMS |
| **Google Analytics** | Traffic tracking | Free |
| **Vercel** | Hosting | Free tier (hobby) |
| **Supabase** | DB + Realtime (for chat) | Free tier (500MB, 50K requests) |

**Estimated monthly cost (MVP): ₹0-2,000/month** (mostly free tiers)

---

## 8. SEO Strategy (Built Into MVP)

| Page | Target Keywords |
|------|----------------|
| Home | "group trips from Pune", "weekend travel Pune" |
| Destination pages | "Goa trip from Pune", "Manali group tour" |
| Trip detail | "Goa group trip December 2025 ₹4500" |
| Blog (Phase 2) | "best weekend trips near Pune", "group travel tips" |

**Technical SEO from Day 1:**
- SSR via Next.js (Google can crawl)
- Dynamic `<title>` and `<meta>` per trip
- Clean URLs: `/trips/goa-beach-getaway-dec-2025`
- Schema.org markup for trips (Event/TravelAction)
- Sitemap auto-generation

---

## 9. Anti-Leakage Features in MVP

| Feature | Implementation |
|---------|---------------|
| Masked contact info | Organizer phone/Instagram never shown publicly |
| Chat content filters | Regex detection for phone numbers, UPI IDs, @instagram handles |
| Escrow payments | Razorpay Route/Escrow — money held until trip completion |
| Booking-only reviews | Review button only appears for completed bookings |
| Price match promise | Manual for now — user reports, admin verifies |

---

## 10. Timeline & Progress

| Week | Milestone | Status |
|------|-----------|--------|
| **Week 1-2** | Project setup, auth, DB schema, basic UI shell | ✅ Done |
| **Week 3-4** | Trip CRUD (organizer), trip listing/search (traveler) | ✅ Done |
| **Week 5-6** | Trip detail page, comparison feature, SEO setup | ✅ Done |
| **Week 7-8** | Razorpay integration, booking flow, escrow | ⬜ Not started |
| **Week 9-10** | Chat system, review system, organizer dashboard | ⬜ Not started |
| **Week 11-12** | Admin panel, testing, bug fixes, deploy | ⬜ Not started |

**Total: ~12 weeks for a solo developer / 6-8 weeks with 2 developers**

### Detailed Progress Tracker

#### ✅ Infrastructure & Setup
- [x] Monorepo structure (Turborepo) with `apps/api`, `apps/web`, `packages/shared`
- [x] Docker Compose (PostgreSQL, Redis, API, Web, Migrate)
- [x] TypeScript configs (base + per-app) with path aliases
- [x] ESLint, Prettier, EditorConfig
- [x] Prisma schema (14 MVP tables, 20+ indexes, soft-delete mixin)
- [x] Seed data (`prisma/seed.ts`)
- [x] Environment config + validation
- [x] Pino structured logging (singleton)
- [x] CORS whitelist config
- [x] Redis client (Upstash, graceful null)

#### ✅ Shared Package (`packages/shared`)
- [x] Auth types (`SignupDto`, `LoginDto`, `AuthTokens`, `AuthResponse`, `JwtPayload`)
- [x] Trip types (`TripSummary`, `TripDetail`, `TripFilters`, `CreateTripDto`, `UpdateTripDto`)
- [x] Destination types
- [x] API response types (`ApiResponse<T>`, `ApiError`, `PaginationMeta`)
- [x] Auth validators (Zod: `signupSchema`, `loginSchema`)
- [x] Trip validators (Zod: `createTripSchema`, `tripFiltersSchema`)
- [x] Design tokens (`tokens.json` — colors, typography, spacing)

#### ✅ Backend — Auth Module
- [x] `UserRepository` — findById, findByEmail, create, emailExists, updatePassword
- [x] `RefreshTokenRepository` — create, findByHash, revokeByHash, revokeAllForUser, deleteExpired
- [x] `AuthService` — signup, login, refresh, logout, logoutAll, getMe, verifyAccessToken
- [x] `AuthController` — all endpoints with httpOnly cookie for refresh
- [x] Auth routes (`POST /auth/signup`, `login`, `refresh`, `logout`, `logoutAll`, `GET /me`)
- [x] Auth middleware (Bearer token verification)
- [x] Role middleware (`requireRole(...roles)` RBAC)
- [x] Validation middleware (Zod)
- [x] Rate limiting middleware (Upstash Redis — general, auth, webhook tiers)
- [x] Request logger middleware (Pino structured logging)
- [x] Error handler middleware (typed errors, Pino logging)
- [x] Typed errors (`AppError`, `NotFoundError`, `ValidationError`, `AuthError`, `ConflictError`, `ForbiddenError`)
- [x] `asyncHandler` decorator

#### ✅ Backend — Trip Module
- [x] `TripRepository` — search (filters + pagination), findBySlug, findById, create, update
- [x] `DestinationRepository` — findAll, findById, findBySlug, findPopular
- [x] `OrganizerProfileRepository` — findById, findByUserId
- [x] `TripService` — search, getBySlug, create, update (with slug generation)
- [x] `DestinationService` — getAll, getById, getPopular
- [x] `TripController` — search, getBySlug, create, update
- [x] `DestinationController` — getAll, getPopular
- [x] Trip routes (`GET /trips`, `GET /trips/:slug`, `POST /trips`, `PUT /trips/:id`)
- [x] Destination routes (`GET /destinations`, `GET /destinations/popular`)
- [x] Health route (`GET /health`)
- [x] DI wiring in `config/dependencies.ts`
- [x] Prisma client extensions (soft-delete via `$extends`)

#### ✅ Frontend — Design System & Shared Components
- [x] Tailwind config with design tokens (colors, typography, spacing)
- [x] `globals.css` — component classes (`.btn-*`, `.card`, `.input`, `.badge-*`, `.skeleton`)
- [x] Animations (shimmer, fadeIn, slideUp, slideDown, `prefers-reduced-motion`)
- [x] `Alert` component (success/warning/error/info variants)
- [x] `Avatar` component (initials + size)
- [x] `AuthGuard` component (route protection)
- [x] `Modal` component (accessible dialog)
- [x] `ProgressBar` component
- [x] `Spinner` component (with `role="status"` a11y)
- [x] `StarRating` component
- [x] `Tabs` component
- [x] `Toast` provider + `useToast` hook
- [x] `Tooltip` component
- [x] `DataStates` (ErrorState/EmptyState patterns)
- [x] `APP_NAME` constant from env

#### ✅ Frontend — Auth Pages
- [x] Login page (Zod client-side validation, field errors, redirect if authed)
- [x] Signup page (Zod validation, role selection, `isAppApiError` guard)
- [x] Dashboard page (user info, logout, `AuthGuard` protected)
- [x] Zustand auth store (persist + hydrate)
- [x] Axios api-client (interceptors, token refresh, `AppApiError` type guard)

#### ✅ Frontend — Home Page
- [x] Hero section with search bar
- [x] Popular destinations (grid, `next/image`, destination links)
- [x] Trending trips (card grid)
- [x] Why Book section (trust badges)
- [x] Header (navigation, auth state)
- [x] Footer (links, branding)
- [x] `APP_NAME` used in metadata + layout

#### ✅ Frontend — Trip Listing & Search (Page 2)
- [x] Trips list page (`/trips`) with search + filters
- [x] `TripCard` component (image, price, rating, seats, booking mode)
- [x] `TripCardSkeleton` (shimmer loading)
- [x] `TripGrid` (data grid + pagination)
- [x] `TripFilters` (destination, trip type, price range with debounce, sort, mobile drawer)
- [x] `useTrips` hook (TanStack Query)
- [x] `useDestinations` / `usePopularDestinations` hooks
- [x] `useDebounce` hook
- [x] Route-level `loading.tsx` and `error.tsx`

#### ✅ Frontend — Trip Comparison (Page 3)
- [x] Compare page (`/trips/compare`) — side-by-side table
- [x] `TripComparisonTable` (price, dates, group size, inclusions, ratings)
- [x] `CompareBar` (floating bar with selected trips)
- [x] `GlobalCompareBar` (app-wide compare queue)
- [x] `CompareQueueProvider` + `useCompareQueue` context
- [x] `useCompareTrips` hook
- [x] Route-level `loading.tsx` and `error.tsx`

#### ✅ Frontend — Trip Detail Page (Page 4)
- [x] Trip detail page (`/trips/[slug]`)
- [x] `TripDetailHeader` (photo gallery with `next/image`, share with toast)
- [x] `TripBookingCard` (price, seats, booking CTA, trust badges)
- [x] `TripItinerary` (day-wise itinerary)
- [x] `TripOrganizerCard` (organizer profile, rating)
- [x] `TripReviews` (review list with ratings)
- [x] `useTripDetail` hook
- [x] Route-level `loading.tsx`

#### ✅ Frontend — Tests
- [x] Vitest + React Testing Library + MSW setup
- [x] Test factories (`tests/helpers/factories.ts`)
- [x] AuthGuard tests (4 tests)
- [x] Toast tests (7 tests)
- [x] Design system component tests (23 tests)
- [x] CompareBar tests (8 tests)
- [x] TripComparisonTable tests (11 tests)
- [x] Compare page tests (7 tests)
- [x] useCompareTrips hook tests (4 tests)
- **Total: 64 tests passing**

#### 🟡 In Progress — Organizer Dashboard
- [x] `BookingRepository` — findByTripId (paginated, filtered), getTripBookingSummary
- [x] `TripRequestRepository` — findByTripId (paginated, filtered), updateStatus
- [x] `TripService` — getTripBookings, getTripRequests, getTripBookingSummary, respondToTripRequest
- [x] `TripController` — 4 new endpoints for trip participants dashboard
- [x] Trip participants routes (`GET /trips/:id/bookings`, `requests`, `summary`, `PATCH /trips/:id/requests/:requestId`)
- [x] DI wiring for BookingRepository + TripRequestRepository
- [x] Trip participants dashboard page (`/dashboard/trips/[id]/users`)
- [x] `TripStatsBar` component (paid & booked, revenue, pending requests, seats left)
- [x] `BookingCard` + `RequestCard` components (participant cards with status badges)
- [x] `ParticipantDrawer` (slide-out detail view with traveler details)
- [x] `RequestActionModal` (approve/reject with optional note)
- [x] `ParticipantFilters` (search + status filter)
- [x] `useTripBookings`, `useTripRequests`, `useTripSummary`, `useRespondToRequest` hooks
- [x] "Participants" button on trip list cards
- [x] Trip name + ID shown on participants page header
- [x] Preview page (`/preview/trip-users`) with mock data for auth-free UI review
- [ ] **Organizer dashboard home** — overview stats, recent bookings, recent reviews
- [ ] **Organizer trip list** — edit, publish, delete, stop/resume bookings (partially wired)

#### 🟡 In Progress — Backend Tests
- [x] Trip service unit tests (existing trip methods)
- [x] Trip participants service tests (`trip-users.service.test.ts` — 24 test cases)
- [ ] Route integration tests
- [ ] Repository unit tests

#### ⬜ Not Started — Booking Lifecycle (Critical Missing Pieces)
- [ ] **Booking creation on payment** — When approved request's user pays:
  - Create `Booking` with `CONFIRMED` status
  - Link booking to `TripRequest` via `bookingId`
  - Update `TripRequest.status` → `CONVERTED`
  - Atomically increment `Trip.currentBookings`
  - Create `PaymentTransaction` record
- [ ] **Instant booking flow** — For `INSTANT` mode trips:
  - Create `Booking` with `PENDING_PAYMENT` status + 30min expiry
  - On payment webhook → `CONFIRMED` + increment `currentBookings`
  - On expiry → `EXPIRED` + release held seat
- [ ] **Seat reservation on approval** — When request is approved, temporarily hold seats:
  - Prevent double-approval beyond capacity
  - Release held seats if 48h payment window expires
- [ ] **Approval expiry cron** — Scheduled job to:
  - Find APPROVED requests where `approvalExpiresAt < now`
  - Set status → `EXPIRED`
  - Release any held seats
  - Notify traveler of expiry
- [ ] **Booking cancellation** — Cancel flow with refund per cancellation policy:
  - Decrement `Trip.currentBookings` atomically
  - Create REFUND `PaymentTransaction`
  - Razorpay refund API call
- [ ] **Trip status auto-transitions** —
  - `ACTIVE` → `FULL` when `currentBookings >= maxGroupSize`
  - `ACTIVE/FULL` → `COMPLETED` after `endDate` passes
  - Escrow release trigger on completion

#### ⬜ Not Started — Razorpay Integration
- [ ] **Razorpay checkout** — Create Razorpay order, render checkout, handle success/failure
- [ ] **Payment webhooks** — `payment.captured`, `payment.failed`, `refund.processed`
- [ ] **Escrow hold/release** — Route/Transfer API for escrow management
- [ ] **Webhook idempotency** — Deduplicate via `WebhookEvent.eventId`

#### ⬜ Not Started — Other Features
- [ ] **Booking form UI** — Traveler details form, price breakdown, Razorpay checkout
- [ ] **Booking confirmation page** — Success screen with next steps
- [ ] **Review system** — post-trip review form, review listing
- [ ] **Chat system** — Socket.IO, conversations, message anti-leakage filters
- [ ] **User dashboard** — my trips, my bookings, messages
- [ ] **Admin panel** — organizer approvals, dispute handling, platform stats
- [ ] **Google OAuth** — social login
- [ ] **Email notifications** — booking confirmation, trip updates
- [ ] **SEO** — Schema.org markup, sitemap generation

---

## 11. MVP Success Metrics

| Metric | Target (Month 1-3) |
|--------|-------------------|
| Organizers onboarded | 15-20 |
| Trips listed | 50+ |
| Bookings | 100+ |
| Reviews collected | 30+ |
| Repeat users | 10%+ |
| Revenue | ₹50K-1L (validation, not profit) |

---

TODO
1. Login.signup page OTP verification for number and gmail
  - future please update login/signup flow with login with OTP
2. travel is redirect to dashboard please fix it
3. dont allow Orgainze to go to trips list page only dashboard
4. compare ui is viislbe in all pages please show in trips list page only not in dashboard or in my-bookings page 
*This MVP plan aligns with the aggregator model and anti-leakage strategy defined in the [R&D document](../rnd/group-travel-market-research.md).*

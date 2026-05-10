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
| **Cache** | Redis (ioredis) | Rate limiting, session cache, Socket.IO adapter |
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

| Week           | Milestone                                                  | Status                                                                        |
| ----------------| ------------------------------------------------------------| -------------------------------------------------------------------------------|
| **Week 1-2**   | Project setup, auth, DB schema, basic UI shell             | ✅ Done                                                                        |
| **Week 3-4**   | Trip CRUD (organizer), trip listing/search (traveler)      | ✅ Done                                                                        |
| **Week 5-6**   | Trip detail page, comparison feature, SEO setup            | ✅ Done                                                                        |
| **Week 7-8**   | Razorpay integration, booking flow, escrow                 | ✅ Done                                                                        |
| **Week 9-10**  | OTP auth, organizer dashboard, wallet, payments, cron jobs | ✅ Done                                                                        |
| **Week 11-12** | Admin panel, chat system, review system, deploy            | ✅ Done (chat ✅, reviews ✅, SEO ✅, lifecycle ✅, admin ✅, constants refactor ✅) |

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
- [x] Redis client (ioredis, graceful null)

#### ✅ Shared Package (`packages/shared`)
- [x] Auth types (`SignupDto`, `LoginDto`, `AuthTokens`, `AuthResponse`, `JwtPayload`)
- [x] Trip types (`TripSummary`, `TripDetail`, `TripFilters`, `CreateTripDto`, `UpdateTripDto`)
- [x] Destination types
- [x] API response types (`ApiResponse<T>`, `ApiError`, `PaginationMeta`)
- [x] Auth validators (Zod: `signupSchema`, `loginSchema`)
- [x] Trip validators (Zod: `createTripSchema`, `tripFiltersSchema`)
- [x] Design tokens (`tokens.json` — colors, typography, spacing)

#### ✅ Backend — Auth Module
- [x] `UserRepository` — findById, findByEmail, create, emailExists, updatePassword, updateProfile
- [x] `RefreshTokenRepository` — create, findByHash, revokeByHash, revokeAllForUser, deleteExpired
- [x] `VerificationCodeRepository` — create, findLatest, markUsed, deleteExpired
- [x] `AuthService` — signup, login, refresh, logout, logoutAll, getMe, verifyAccessToken, updateProfile (reissues JWT on role change)
- [x] `OtpService` — sendOtp, verifyOtp (phone + email channels, rate limiting, expiry)
- [x] `FirebaseAuthService` — verifyIdToken, loginOrCreate (Google sign-in via Firebase)
- [x] `AuthController` — all endpoints with httpOnly cookie for refresh
- [x] `OtpController` — send-otp, verify-otp endpoints
- [x] `FirebaseAuthController` — POST /auth/firebase endpoint
- [x] Auth routes (`POST /auth/signup`, `login`, `refresh`, `logout`, `logoutAll`, `GET /me`, `PATCH /auth/profile`)
- [x] OTP routes (`POST /auth/send-otp`, `POST /auth/verify-otp`)
- [x] Firebase auth route (`POST /auth/firebase`)
- [x] Auth middleware (Bearer token verification)
- [x] Role middleware (`requireRole(...roles)` RBAC)
- [x] Validation middleware (Zod)
- [x] Rate limiting middleware (ioredis + sliding window Lua — general, auth, otp, webhook tiers)
- [x] Request logger middleware (Pino structured logging)
- [x] Error handler middleware (typed errors, Pino logging)
- [x] Typed errors (`AppError`, `NotFoundError`, `ValidationError`, `AuthError`, `ConflictError`, `ForbiddenError`)
- [x] `asyncHandler` decorator
- [x] OTP providers (MSG91 + mock provider with DI)
- [x] Email providers (Nodemailer + mock provider with DI)

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
- [x] `DataStates` (ErrorState/EmptyState patterns with `title` + `message` + retry)
- [x] `Pagination` component (shared, ellipsis logic, link + button modes, accessible)
- [x] `APP_NAME` constant from env

#### ✅ Frontend — Auth Pages
- [x] Login page — email/password, phone OTP, email OTP, Google sign-in (4 login methods)
- [x] Signup page (Zod validation, role selection, `isAppApiError` guard)
- [x] Onboarding flow — phone input → OTP verify → name input → profile setup
- [x] Profile page (`/profile`) — view/edit name, role switching (TRAVELER ↔ ORGANIZER)
- [x] Dashboard page (user info, logout, `AuthGuard` protected)
- [x] Zustand auth store (persist + hydrate, `setAuth` for role change token refresh)
- [x] Axios api-client (interceptors, token refresh, `AppApiError` type guard)
- [x] `useUpdateProfile` hook (invalidates queries, updates auth store on role change)

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
- [x] Shared `Pagination` component (replaces all inline pagination — ellipsis, prev/next, link + button modes)
- [x] Organizer role redirect (organizers auto-redirect to `/dashboard`)
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

#### ✅ Frontend Tests (277 tests passing)
- [x] Vitest + React Testing Library + MSW setup
- [x] Test factories (`tests/helpers/factories.ts`, `booking.factory.ts`, `trip.factory.ts`)
- [x] AuthGuard tests (4 tests)
- [x] Toast tests (7 tests)
- [x] Design system component tests (23 tests)
- [x] CompareBar tests (8 tests)
- [x] TripComparisonTable tests (11 tests)
- [x] Compare page tests (7 tests)
- [x] useCompareTrips hook tests (4 tests)
- [x] BookingPage tests (13 tests)
- [x] MyBookingsList tests (15 tests)
- [x] Pagination component tests (14 tests — rendering, button mode, link mode, ellipsis logic)
- [x] Auth form tests — phone-input (8), name-input (7), onboarding (8), OTP verify (8)
- [x] Profile page tests (profile-page.test.tsx)
- [x] Payment tests — badges (10), filters, summary cards (8), transaction list (8+)
- [x] Wallet tests — filters (6), transaction list (7+), tx-type-badge (7)
- [x] Traveler details accordion tests
- [x] Transfer points table tests (6)
- [x] Shared input tests — email (8), phone (8), number (8)
- [x] useWallet hook tests (5)

#### ✅ Organizer Dashboard
- [x] `BookingRepository` — findByTripId (paginated, filtered), getTripBookingSummary
- [x] `TripRequestRepository` — findByTripId (paginated, filtered), updateStatus, findExpiredOrRejectedForUser, resetToPending, expireApprovedRequests
- [x] `TripService` — getTripBookings, getTripRequests, getTripBookingSummary, respondToTripRequest, createTripRequest (re-application after EXPIRED/REJECTED)
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
- [x] Dashboard home page — overview stats (active trips, bookings, revenue, pending requests) with `StatCard` links
- [x] Organizer trip list page (`/dashboard/trips`) — create, edit trips
- [x] Trip create/edit form (tabbed form with Enter-key protection)
- [x] Trip edit history page (`/dashboard/trips/[id]/history`)
- [x] Trip payments page (`/dashboard/trips/[id]/payments`)
- [x] Pending requests page (`/dashboard/requests`)
- [x] `useOrganizerStats` hook
- [x] `StatCard` component (clickable with `href` prop, non-clickable variant)

#### ✅ Backend Tests (587+ tests passing, 28 test files)
- [x] Auth service unit tests (`auth.service.test.ts` — 48 tests: signup, login, refresh, logout, getMe, updateProfile)
- [x] Firebase auth service tests (`firebase-auth.service.test.ts` — 6 tests)
- [x] OTP service unit tests (`otp.service.test.ts` — 29 tests)
- [x] Trip service unit tests (`trip.service.test.ts` — 42 tests)
- [x] Trip request create tests (`trip-request-create.test.ts` — 23 tests: validation, creation, re-application after EXPIRED/REJECTED)
- [x] Trip participants service tests (`trip-users.service.test.ts` — 27 tests)
- [x] Booking service unit tests (`booking.service.test.ts` — 50 tests: createBooking, cancelBooking, getMyBookings, getMyBookingSummary, confirmBooking, verifyAndConfirmPayment)
- [x] Payment service tests (`payment.service.test.ts` — 33 tests)
- [x] Payment history service tests (`payment-history.service.test.ts` — 18 tests)
- [x] Wallet service tests (`wallet.service.test.ts` — 30 tests)
- [x] Destination service tests (`destination.service.test.ts` — 11 tests)
- [x] Cron jobs tests (`cron-jobs.test.ts` — 7 tests: booking expiry, request expiry, token/code cleanup, graceful shutdown)
- [x] Trip repository tests (`trip.repository.test.ts` — 14 tests)
- [x] Auth routes integration tests (`auth.routes.test.ts` — 15 tests)
- [x] Middleware tests (rate-limit: 4, validate: 5)
- [x] Utility tests (email: 10, phone: 6, rate-limiter: 6)
- [x] Validator tests (auth schema: 37 tests)
- [x] Redis config tests (8 tests)
- [x] Booking lifecycle tests (`booking-lifecycle.test.ts` — 35 tests)
- [x] Trip lifecycle service tests (`trip-lifecycle.service.test.ts` — 16 tests)
- [x] Admin service tests (`admin.service.test.ts` — 24 tests: approval queue, organizer detail, approve/reject, platform stats, admin bookings)
- [ ] Repository unit tests (remaining repos)
- [ ] Route integration tests (remaining routes)

#### ✅ Backend — Booking & Payment Module
- [x] `BookingRepository` — create, findActiveByUserAndTrip, findWithPaymentDetails, updateStatus, generateBookingRef (retry + collision check)
- [x] `PaymentTransactionRepository` — create, updatePaymentId
- [x] `TripRepository.findByIdForBooking` — includes organizer payment fields (razorpayAccountId, commissionRate)
- [x] `TripRepository.atomicIncrementBookings` — raw SQL with optimistic locking (version column)
- [x] `TripRepository.atomicDecrementBookings` — rollback on capture failure
- [x] `TripRequestRepository.findApprovedForUser` — REQUEST_BASED mode check
- [x] `BookingService.createBooking` — idempotent, validates trip/seats/deadline/acceptingBookings, REQUEST_BASED approval check, Razorpay order creation, 30min expiry
- [x] `BookingService.confirmBooking` — atomic seat reservation, payment capture, rollback on failure
- [x] `BookingService.verifyAndConfirmPayment` — HMAC-SHA256 signature verification, authorization check
- [x] `BookingService.cancelBooking` — refund % per cancellation policy (FLEXIBLE/MODERATE/STRICT), atomic seat release
- [x] `BookingService.getMyBookings` — paginated with tab filters (all/upcoming/completed/cancelled)
- [x] `BookingService.getMyBookingSummary` — tab count badges
- [x] `PaymentService` — createOrder, capturePayment, verifySignature, initiateRefund (Razorpay SDK)
- [x] `MockPaymentService` — dev-only mock for local testing without Razorpay credentials
- [x] `BookingController` — createBooking, verifyPayment, cancelBooking, getMyBookings, getMyBookingSummary
- [x] `WebhookController` — Razorpay webhook handler (raw body, before JSON parser)
- [x] Booking routes (`POST /bookings`, `POST /bookings/:id/verify-payment`, `POST /bookings/:id/cancel`, `GET /bookings/my`, `GET /bookings/my/summary`)
- [x] Webhook routes (`POST /webhooks/razorpay`) — placed before JSON parser in server.ts
- [x] Razorpay config (`config/razorpay.ts`) — SDK initialization
- [x] Cron jobs (`utils/cron-jobs.ts`) — booking expiry, approval expiry, verification code cleanup, refresh token cleanup
- [x] DI wiring for all new repos, services, controllers
- [x] Razorpay Route/Transfer conditional logic — skips transfers for mock accounts in dev, auto-enables for real linked accounts in production
- [x] Shared types: `CreateBookingDto`, `CreateBookingResponse`, `VerifyPaymentDto`, `VerifyPaymentResponse`, `MyBookingFilters`
- [x] Shared validators: `createBookingSchema` (numTravelers, isPrimary, emergencyContact), `verifyPaymentSchema`
- [x] Prisma schema: `TravelerDetail.emergencyContactName/Phone`, `PaymentTransaction`, `WebhookEvent`, `Trip.version`
- [x] Docker Compose: Razorpay env vars (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)

#### ✅ Frontend — Booking Flow (Pages 5 & 6)
- [x] Booking page (`/trips/[slug]/book`) with 5 render states (loading, error, fullyBooked, deadlinePassed, notAccepting, success, form)
- [x] `TravelerForm` — React Hook Form + Zod, field array, numTravelers selector, early bird price, sessionStorage persistence on refresh
- [x] `PriceSummary` — sidebar card with price breakdown, early bird indicator, trust badges, cancellation policy
- [x] `BookingSuccess` — confirmation screen with booking ref, escrow badge, next steps
- [x] `BookingPageSkeleton` — shimmer loading state
- [x] `useCreateBooking` hook — POST /bookings mutation with error toast
- [x] `useVerifyPayment` hook — POST /bookings/:id/verify-payment, invalidates bookingKeys + tripKeys
- [x] `loadRazorpayScript` — dynamic script loading, singleton promise pattern
- [x] `getEffectivePrice` — shared utility for early bird price logic (`lib/trip-utils.ts`)
- [x] `AuthGuard` wrapping booking page
- [x] Razorpay checkout modal integration (real test keys: `rzp_test_*`)

#### ✅ Frontend — My Bookings (Page 7)
- [x] My bookings page (`/my-bookings`) with loading, error, empty states
- [x] `MyBookingsList` — tab filters, booking cards with status badges, pagination
- [x] Cancel booking modal with reason input
- [x] `useMyBookings`, `useCancelBooking` hooks
- [x] Feature documentation (`docs/engineering/fe/booking-page.md`)

#### ✅ Booking Lifecycle (Critical Pieces — Completed)
- [x] **Instant booking flow** — PENDING_PAYMENT → Razorpay checkout → verify signature → capture payment → CONFIRMED
- [x] **Request-based booking** — Checks for approved, non-expired TripRequest before allowing payment
- [x] **Seat reservation** — Atomic increment with optimistic locking (version column), rollback on capture failure
- [x] **Booking cancellation** — Refund per policy (Flexible: full 48h before / Moderate: 50% / Strict: none), atomic seat release
- [x] **Booking expiry** — 30min payment window, cron job for cleanup
- [x] **Approval expiry** — 48h payment window for approved requests, cron job for cleanup
- [x] **Idempotency** — Returns existing PENDING_PAYMENT order on duplicate request, returns success for already CONFIRMED

#### ✅ Trip Lifecycle Auto-Transitions
- [x] **ACTIVE → FULL** — `trip.repository.ts:markFullIfAtCapacity()` atomic SQL, called after seat increment in `confirmBooking()`
- [x] **FULL → ACTIVE revert** — `trip.repository.ts:revertFullIfUnderCapacity()` atomic SQL, called after cancellation
- [x] **ACTIVE/FULL → COMPLETED** — `trip-lifecycle.service.ts:completeEndedTrips()` cron (every 30min, batch 50)
- [x] **Escrow release** — `trip-lifecycle.service.ts:releaseUnreleasedEscrows()` cron, `on_hold_until` = endDate + 90 days
- [x] **Razorpay transfer hold release** — SDK `transfers.edit` with raw HTTP fallback, lazy-fetch for missing transfer IDs
- [x] **Fire-and-forget webhook** — `handlePaymentCaptured` marks CAPTURED immediately, fetches transfer ID non-blocking
- [x] **Zero `any` types** — `types/razorpay.types.ts` with proper Razorpay entity types

#### ✅ Razorpay Integration
- [x] **Razorpay checkout** — Create order, render checkout modal, handle success/failure/dismiss
- [x] **Payment verification** — HMAC-SHA256 signature verification (FE callback + webhook backup)
- [x] **Escrow/Route** — Transfer array built for real linked accounts, skipped for dev mock accounts
- [x] **Webhook handler** — Raw body parsing, placed before JSON parser, idempotent via WebhookEvent
- [x] **Test keys** — Working with `rzp_test_*` keys, Card + Netbanking verified

#### ✅ Backend — Wallet Module
- [x] `WalletRepository` — findByUserId, getOrCreate, credit, debit, getTransactions (paginated)
- [x] `WalletService` — getBalance, getTransactions, credit, debit
- [x] `WalletController` — GET /wallet/balance, GET /wallet/transactions
- [x] Wallet routes with auth middleware
- [x] Wallet types + validators in shared package

#### ✅ Backend — Payment History Module
- [x] `PaymentHistoryService` — getMyPayments, getPaymentSummary
- [x] `PaymentHistoryController` — GET /payments/my, GET /payments/my/summary
- [x] Payment history routes
- [x] Admin payments endpoint

#### ✅ Frontend — Wallet Page
- [x] Wallet page (`/wallet`) with balance card + transaction list
- [x] `WalletTransactionList` — desktop table + mobile cards, pagination
- [x] `WalletTxTypeBadge`, `WalletTxCard` components
- [x] Wallet filters (type, date range)
- [x] `useWalletBalance`, `useWalletTransactions` hooks

#### ✅ Frontend — My Payments Page
- [x] My payments page (`/my-payments`) with summary cards + transaction list
- [x] `PaymentTransactionList` — table with status/type badges, pagination
- [x] `TravelerPaymentSummaryCards` component
- [x] Payment filters (status, type, date range)
- [x] `useMyPayments`, `useMyPaymentSummary` hooks

#### ✅ Backend — Cron Jobs (Background Maintenance)
- [x] `expireStaleBookings` — polls Razorpay before expiring PENDING_PAYMENT bookings (5 min interval)
- [x] `expireStaleRequests` — expires APPROVED trip requests past 48h window (5 min interval)
- [x] `cleanupExpiredCodes` — deletes old verification codes (1 hour interval)
- [x] `cleanupStaleTokens` — deletes expired refresh tokens (1 hour interval)
- [x] `startCronJobs` — single public API, DI for all repos, returns cleanup function
- [x] Graceful shutdown — `stopCrons()` called before server close
- [x] Re-application logic — users can re-apply after EXPIRED/REJECTED request (`resetToPending` with `$transaction`)

#### ✅ Google / Firebase Auth
- [x] Firebase Admin SDK integration (`config/firebase.ts`)
- [x] `FirebaseAuthService` — verifyIdToken, loginOrCreate (Google sign-in)
- [x] `FirebaseAuthController` — POST /auth/firebase
- [x] Frontend Google sign-in button on login/signup pages

#### ✅ Backend — Review Module
- [x] `ReviewRepository` — CRUD, paginated queries
- [x] `ReviewService` — post-trip review logic, authorization
- [x] `ReviewController` — endpoints for creating/listing reviews
- [x] Review routes mounted
- [x] Review service tests (`review.service.test.ts`)
- [x] Prisma migration for review reply & edited fields

#### ✅ Frontend — Review System
- [x] `ReviewFormModal` component (post-trip review form)
- [x] `ReviewCard` component (review listing)
- [x] `TripReviews` component (review section on trip detail)
- [x] `OrganizerReviewCard` + `OrganizerReviewsSection` components
- [x] Organizer reviews dashboard page (`/dashboard/trips/[id]/reviews`)
- [x] `useReviews` hook

#### ✅ Backend — Chat Module
- [x] `ConversationRepository` + `MessageRepository`
- [x] `ChatService` — full business logic + authorization + anti-leakage filter
- [x] `ChatController` + chat routes mounted at `/api/v1/chat`
- [x] Anti-leakage filter (`chat-filter.ts` — regex for phone, UPI, Instagram, WhatsApp, email, URLs)
- [x] Socket.IO integration (`socket/index.ts`, `chat.handler.ts`, `presence.handler.ts`, `socket-auth.middleware.ts`)
- [x] HTTP server created explicitly in `index.ts` for Socket.IO attachment
- [x] Chat service tests (26 tests) + filter tests (18 tests)
- [x] Prisma migration for chat enums and fields

#### ✅ Frontend — Chat System
- [x] Socket client (`lib/socket.ts`)
- [x] Zustand chat store (`store/chat.store.ts` — typing, presence, unread, optimistic messages)
- [x] `chatKeys` query key factory
- [x] `use-chat.ts` hook (conversations, messages, send, typing, read, presence, reactions)
- [x] `use-admin-chat.ts` hook (flagged messages)
- [x] Chat components: ChatLayout, ChatWindow, ChatHeader, ConversationSidebar, ConversationItem, MessageBubble, MessageInput, TypingIndicator, OnlineIndicator, SupportChatButton, ChatWithOrganizerButton
- [x] Messages page (`/messages`)
- [x] Admin flagged messages page (`/admin/chat`)

#### ✅ SEO (Full Implementation)
- [x] `NEXT_PUBLIC_SITE_URL` env var across all configs (`.env.example`, docker-compose, Dockerfile)
- [x] `SITE_URL` constant in `lib/constants.ts`, `metadataBase` in root `layout.tsx`
- [x] `trailingSlash: false` in `next.config.js`
- [x] `lib/api-server.ts` — server-side fetch using `API_URL_INTERNAL` (Docker) with ISR `revalidate`
- [x] BE sitemap endpoint (`GET /api/v1/sitemap-data`) — trips, destinations, organizers
- [x] SSR trip detail page (`/trips/[slug]/page.tsx`) — `generateMetadata()`, OG image, canonical URL, `revalidate: 300`
- [x] `trip-detail-client.tsx` — extracted client component receiving `trip` prop
- [x] `useTripDetail(slug, initialData)` — SSR hydration support
- [x] Schema.org JSON-LD (`lib/structured-data.ts`) — `buildTripJsonLd`, `buildBreadcrumbJsonLd`, `buildWebsiteJsonLd`, `buildOrganizationJsonLd`
- [x] Dynamic sitemap (`app/sitemap.ts`) — calls `/api/v1/sitemap-data` with `revalidate: 3600`
- [x] Robots (`app/robots.ts`) — blocks dashboard/admin/private pages
- [x] Enhanced metadata — Home page OG + JSON-LD + canonical, trips layout SEO title/desc, auth layout noindex

#### ✅ Shared Constants Refactor
- [x] `constants/roles.ts` — `USER_ROLES`, `SIGNUP_ROLES` as const tuples, derived `UserRole` / `SignupRole` types
- [x] `constants/booking-status.ts` — `BOOKING_STATUSES`, `TRIP_REQUEST_STATUSES` as const tuples, derived types
- [x] `constants/verification-status.ts` — `VERIFICATION_STATUSES`, `APPROVE_REJECT_ACTIONS` as const tuples, derived types
- [x] All shared types (`auth.types.ts`, `user.types.ts`, `booking.types.ts`, `chat.types.ts`, `trip-request.types.ts`, `admin.types.ts`) use imported types from constants
- [x] All Zod validators (`auth.schema.ts`, `booking.schema.ts`, `admin.schema.ts`) use `z.enum()` with constant tuples
- [x] BE repos use shared types (`UserRole`, `VerificationStatus`, `BookingStatusConst`) instead of inline strings

#### ✅ Admin Panel (Full Implementation)

**Backend:**
- [x] `NotificationRepository` — create() for in-app notifications (uses `Prisma.InputJsonValue`)
- [x] `OrganizerProfileRepository` — findAllAdmin (paginated, status filter), findByIdAdmin, countPending
- [x] `UserRepository` — countAll, countByRole (uses `UserRole` type)
- [x] `TripRepository` — countByStatus, countByType
- [x] `BookingRepository` — countByStatusAdmin, getRevenueTrend (raw SQL), findAllAdmin, findByIdAdmin
- [x] `MessageRepository` — countFlagged (filters `isDeleted: false`)
- [x] `AdminService` — getApprovalQueue, getOrganizerDetail, approveOrReject (with notifications), getPlatformStats (`Promise.all` batched), getBookings (typed `AdminBookingFilters`), getBookingDetail
- [x] `AdminController` — thin controller with asyncHandler
- [x] `admin.routes.ts` — all behind `authMiddleware` + `requireRole('ADMIN')` + Zod validation
- [x] Wired in `dependencies.ts`, mounted at `/api/v1/admin` in `server.ts`
- [x] Admin service tests (24 tests — approval queue, organizer detail, approve/reject, platform stats, admin bookings)

**Frontend:**
- [x] `adminKeys` query key factory with `organizersBase()` / `bookingsBase()` (no trailing `undefined`), `'detail'` segment for collision prevention
- [x] `lib/admin-utils.ts` — shared `BOOKING_STATUS_VARIANT`, `PAYMENT_STATUS_VARIANT`, `BOOKING_STATUS_COLORS` (from design tokens)
- [x] `use-admin-stats.ts` — platform stats hook
- [x] `use-admin-organizers.ts` — list + detail + approve/reject mutation (invalidates `organizersBase()`)
- [x] `use-admin-bookings.ts` — list + detail hooks (with `staleTime: 30_000`)
- [x] `use-admin-chat.ts` — flagged messages (refactored to `chatKeys.flagged()`)
- [x] `admin-sidebar.tsx` — desktop sidebar + mobile bottom nav
- [x] `revenue-chart.tsx` — Recharts LineChart (design token colors, whole ₹ display)
- [x] `bookings-chart.tsx` — Recharts BarChart (shared `BOOKING_STATUS_COLORS`)
- [x] `trip-type-chart.tsx` — Recharts PieChart (design token colors)
- [x] `organizer-approval-card.tsx` — card with approve/reject buttons
- [x] `approval-action-dialog.tsx` — AlertDialog with `ApproveRejectAction` type
- [x] Admin layout (`AuthGuard ADMIN` + Header + AdminSidebar + mobile padding)
- [x] Admin overview page — StatCards + 3 Recharts charts + quick actions + `EmptyState`
- [x] Organizer approvals page — tabs (PENDING/APPROVED/REJECTED) + `Button` pagination
- [x] Bookings list page — table + mobile cards + debounced search + status filter (incl. REFUNDED)
- [x] Booking detail page — traveler details (nullable fields) + payment transactions + `EmptyState`
- [x] `error.tsx` on all 4 admin routes
- [x] Header admin link (`/admin`)

**API Endpoints:**
- `GET /api/v1/admin/organizers` — paginated approval queue
- `GET /api/v1/admin/organizers/:id` — organizer detail
- `PATCH /api/v1/admin/organizers/:id/status` — approve/reject + notification
- `GET /api/v1/admin/stats` — platform overview + charts
- `GET /api/v1/admin/bookings` — admin booking list
- `GET /api/v1/admin/bookings/:id` — booking detail with travelers + payments

**Bug Fixes Applied During Review:**
1. Currency display — removed `/100` division (DB stores whole ₹), uses `formatCurrency` from `lib/format.ts`
2. Inline role/status strings in repos → shared constant types
3. Query key invalidation — no trailing `undefined`, `organizersBase()`/`bookingsBase()` for broad invalidation
4. Search debounce — `useDebounce(search, 300)` on admin bookings
5. Hardcoded hex colors → `tokens.json` design tokens
6. Duplicate `STATUS_VARIANT` → shared `lib/admin-utils.ts`
7. `ApprovalActionDialog` inline string → `ApproveRejectAction` type
8. `notification.repository` `as never` → `Prisma.InputJsonValue`
9. Admin empty states → `EmptyState` component
10. Missing REFUNDED in booking status filter
11. `adminKeys.bookingDetail` key collision → `'detail'` segment
12. Missing `staleTime` on `useAdminBookingDetail`

#### ⬜ Not Started — Remaining Features
- [ ] **Email notifications** — booking confirmation, trip updates, organizer approval/rejection (providers built, templates pending)

#### ⬜ Not Started — Viral & Differentiator Features

> These 8 features transform TripCompare from "a well-built aggregator" into **"the only safe, transparent, and community-driven way to book group trips in India."** No competitor — MakeMyTrip, Tripoto, GoGaffl, Zostel — offers ANY of these. Each feature solves a real pain point AND has a built-in sharing/growth mechanic.

---

##### 1. Destination Pages (`/destinations/[slug]`)

**What:** Rich, SEO-optimized landing pages for each destination — showing all trips to that destination, aggregated reviews, average pricing, best time to visit, and (future) Local Intel tips.

**Why we need it:**
- Destinations are our **primary SEO entry points** — travelers Google "Goa trips from Pune", not "TripCompare.com"
- We already have the `Destination` model with data, but **zero public-facing pages** for it
- Every competitor that grew organically (Tripoto: ₹7.9 Cr, Thrillophilia: 194+ packages) did it through destination pages
- Each destination page becomes a **permanent indexed asset** that compounds traffic over time

**How it makes us stand out:**
- `/destinations/goa` shows 15 trips side-by-side with price comparison — Instagram can't do this
- Aggregated stats: "Average Goa trip: ₹4,800 | 3D/2N | 142 verified reviews" — builds instant trust
- Future-ready for Local Intel tab (community tips) and Trip Replays (social proof photos)
- **Structured data (Schema.org)** → rich snippets in Google search results

**Scope:**
- [ ] BE: `DestinationService.getBySlug()` with trip count, avg price, avg rating aggregation
- [ ] BE: `GET /api/v1/destinations/:slug` endpoint with trip listing + stats
- [ ] FE: `/destinations/[slug]/page.tsx` — SSR with `generateMetadata()` for SEO
- [ ] FE: Hero section (destination image, name, state, stats)
- [ ] FE: Trips tab (reuse existing TripGrid with destination filter pre-applied)
- [ ] FE: Reviews tab (aggregated reviews from all trips to this destination)
- [ ] FE: "Best Time to Visit" + "Average Price" info cards
- [ ] FE: "Trips to Goa" CTA section at bottom → conversion funnel
- [ ] SEO: Canonical URLs, OG images, breadcrumbs, JSON-LD (TouristDestination schema)

---

##### 2. Organizer Public Profile (`/organizers/[id]`)

**What:** A public-facing profile page for each verified organizer — showing their bio, completed trips, ratings, reviews, response time, and trust metrics. The organizer's **portable reputation** on the platform.

**Why we need it:**
- Organizers currently have **no public presence** on the platform — travelers can't evaluate who they're booking with
- Instagram organizers have profiles with followers/posts — we need an equivalent that's **trust-verified**
- Organizer profiles are the foundation for the future Trust Score feature
- Good organizers will **share their profile link** as social proof: "Check my 4.8★ rating on TripCompare"

**How it makes us stand out:**
- **Verified badge** — Aadhaar verified, bank linked, admin-approved. Instagram has blue ticks for celebrities; we have verified badges for trip organizers
- **Data-driven trust** — "47 trips completed, 98% on-time, 182 reviews, < 2h response time" — this level of transparency doesn't exist anywhere
- **Review moat** — organizers invest years building reputation here → can't leave the platform (like restaurants staying on Zomato for reviews)
- **SEO indexed** — `/organizers/tripvibes` ranks for "TripVibes reviews", "TripVibes trips"

**Scope:**
- [ ] BE: `OrganizerProfileService.getPublicProfile()` — aggregates stats from trips, bookings, reviews, chat response time
- [ ] BE: `GET /api/v1/organizers/:id/public` endpoint
- [ ] FE: `/organizers/[id]/page.tsx` — SSR with `generateMetadata()`
- [ ] FE: Profile header (avatar, business name, verified badge, rating, member since)
- [ ] FE: Stats grid (trips completed, total travelers, avg rating, response time)
- [ ] FE: Active trips tab (upcoming trips by this organizer)
- [ ] FE: Reviews tab (all reviews across their trips, sorted by newest)
- [ ] FE: "Chat with Organizer" CTA (reuse existing ChatWithOrganizerButton)
- [ ] SEO: JSON-LD (Organization/LocalBusiness schema), OG image

---

##### 3. Wishlist / Save Trips

**What:** Heart icon on every trip card and detail page. Travelers save trips to a personal wishlist (`/wishlist`). Enables "browse now, book later" behavior and creates re-engagement loops.

**Why we need it:**
- **70%+ of travelers browse multiple times before booking** — without save, they leave and forget
- Currently there's **no way to bookmark** a trip — travelers are forced to screenshot or remember URLs
- Wishlist creates a **natural re-engagement trigger**: "Your saved Goa trip has only 3 seats left!"
- It's **table stakes** — Airbnb, MakeMyTrip, Amazon all have it. Missing it feels broken.

**How it makes us stand out:**
- **FOMO notifications on saved trips:** "Price dropped on your saved trip!" / "Only 2 seats left!" → drives conversion
- **Social wishlist sharing:** "Check out the trips I'm considering for December" → friends discover platform
- **Data goldmine:** Wishlist data reveals demand → show organizers "200 people saved Goa trips for December" → they create supply
- **Conversion funnel:** Browse → Save → Get notified → Book (reduces the drop-off gap)

**Scope:**
- [ ] DB: `Wishlist` model (userId, tripId, createdAt) with `@@unique([userId, tripId])`
- [ ] BE: `WishlistRepository` — add, remove, findByUser (paginated), isWishlisted (batch check)
- [ ] BE: `WishlistService` — toggle, getMyWishlist, isWishlisted
- [ ] BE: `WishlistController` — `POST /wishlist/:tripId/toggle`, `GET /wishlist`, `GET /wishlist/check?tripIds=...`
- [ ] Shared: `WishlistItem` type, validators
- [ ] FE: `WishlistButton` component (heart icon, optimistic toggle, auth check)
- [ ] FE: Integrate into `TripCard` and `TripBookingCard` (trip detail page)
- [ ] FE: `/wishlist` page with saved trip grid, remove button, empty state
- [ ] FE: `useWishlist` hook (list + toggle mutation + batch check query)
- [ ] FE: Query key factory: `wishlistKeys`

---

##### 4. Transparent Price Breakdown

**What:** Every trip listing shows a clear, structured cost breakdown — exactly where the traveler's money goes (transport, stay, meals, activities, organizer fee, platform fee). Plus comparison against average prices for similar trips.

**Why we need it:**
- **#3 pain point in our research:** "Is ₹5,000 fair? Am I overpaying?" — travelers suspect organizers overcharge
- **No travel platform in India shows this.** Not MakeMyTrip, not Tripoto, not GoGaffl. First-mover advantage.
- Comparison feature becomes 10x more meaningful — "Trip A charges ₹1,500 for hotel, Trip B charges ₹800. Now I know why."
- Builds **radical transparency** that media will cover: "This startup shows where every rupee of your trip goes"

**How it makes us stand out:**
- **Instant trust:** Travelers see ₹5,000 = transport ₹1,200 + hotel ₹1,500 + meals ₹800 + activities ₹500 + organizer fee ₹600 + platform fee ₹400
- **Comparison stat:** "📊 Compared to average: ₹4,800 for similar Goa 3D/2N trips" — validates or questions the price
- **WhatsApp shareable:** "Look at this — they actually show where your money goes!" → organic forwards
- **Organizer pitch:** "Good organizers benefit from transparency. Only overchargers fear it." → attracts quality supply
- **PR angle:** "First travel platform in India to guarantee price transparency" → free media coverage

**Scope:**
- [ ] DB: `PriceBreakdown` JSON field on Trip model (or structured fields: transportCost, stayCost, mealsCost, activityCost, organizerFee, platformFee)
- [ ] BE: Add price breakdown fields to `CreateTripDto` / `UpdateTripDto`
- [ ] BE: `TripService` — compute average prices for similar trips (same destination + duration + trip type)
- [ ] BE: Include price breakdown in trip detail response
- [ ] Shared: `PriceBreakdownItem` type, Zod validator for breakdown fields
- [ ] FE: Trip creation form — optional price breakdown section (organizer fills during listing)
- [ ] FE: `PriceBreakdownCard` component on trip detail page (visual bar chart or pie)
- [ ] FE: "Compared to average" stat line
- [ ] FE: Price breakdown row in comparison table (`/trips/compare`)

---

##### 5. Local Intel (Community Tips — SEO & Content Flywheel)

**What:** Crowd-sourced, category-organized destination tips from **verified travelers** — a community wiki per destination. 8 fixed categories: Places to Visit, Places to Eat, Local Transport, Hidden Gems, Safety Tips, Money Hacks, Accommodation, Pro Tips. Upvotes (no downvotes), 1-level threaded comments, report-based moderation.

> Full design in [`docs/rnd/local-intel-rnd.md`](../rnd/local-intel-rnd.md)

**Why we need it:**
- **This is how Tripoto grew** — 90% UGC → massive long-tail SEO → organic traffic → bookings → ₹7.9 Cr revenue
- 50 destinations × 8 categories = **400 indexed SEO pages from day one**, growing with every contribution
- Travelers come back **between bookings** to read tips → solves the "only visit when booking" retention problem
- Post-trip is the highest-intent moment for UGC — travelers WANT to share fresh memories
- Creates a **content → booking flywheel**: read tip about Goa → see "Trips to Goa" → book → complete → write tips → ∞

**How it makes us stand out:**
- **No group travel aggregator has this** — Tripoto has long blogs (30-min write, low contribution rate), we have short 2-min tips (high contribution rate)
- **Verified-only contributions** — only travelers with COMPLETED bookings can post. Every tip is backed by a real trip. This destroys fake/sponsored content.
- **SEO moat:** `/destinations/goa/tips/hidden-gems` ranks for "hidden places in Goa", `/destinations/goa/tips/places-to-eat` ranks for "best food in Goa"
- **Community stickiness:** Upvotes + comments + author badges + leaderboard ("Goa's Top Contributors") → users invest identity on the platform
- **Shareable tip cards:** Auto-generated OG images when sharing on WhatsApp/Instagram → free marketing with platform branding

**Scope (MVP):**
- [ ] DB: `DestinationTip` (title, content, category, photos, destinationId, userId, bookingId, upvoteCount)
- [ ] DB: `TipVote` (tipId, userId — unique) — also used for comment upvotes
- [ ] DB: `TipComment` (tipId, userId, parentCommentId for 1-level threading, upvoteCount)
- [ ] DB: `TipReport` (tipId, userId, reason, status)
- [ ] BE: `TipRepository`, `TipService`, `TipController`
- [ ] BE: CRUD endpoints for tips, votes, comments, reports
- [ ] BE: Authorization — only verified travelers (COMPLETED booking to destination) can post
- [ ] BE: Auto-hide on 3+ reports → admin moderation queue
- [ ] Shared: Tip types, category enum, validators
- [ ] FE: `/destinations/[slug]/tips` page — category filter tabs, sort (Most Helpful/Newest/Most Discussed)
- [ ] FE: `TipCard` component (title, content, photos, author + trip name, upvote count, comments)
- [ ] FE: `TipComments` — 1-level threading, author badge, upvotable comments
- [ ] FE: "Share Intel" modal/form (category, title, content, photos)
- [ ] FE: Post-trip nudge: "You visited Goa! Share your intel for others 🎉"
- [ ] FE: WhatsApp share button on every tip
- [ ] FE: "Top Contributors" leaderboard per destination
- [ ] FE: Trip detail page → "Local Intel for Goa" section at bottom
- [ ] SEO: Category-level pages indexed, meta tags, structured data

---

##### 6. Solo → Squad (Travel Buddy Matching)

**What:** Vibe-based travel buddy matching system. 5-question vibe profile during onboarding (travel pace, energy, interests, budget, social style). Trip listings show "Who's Going" social proof (4 solo travelers, 2 couples, age range 22-31). Vibe Match % score. Pre-trip group chat unlocks after booking.

> Full design in [`docs/rnd/viral-features-rnd.md`](../rnd/viral-features-rnd.md) — Feature 3

**Why we need it:**
- **65% of urban Indian women feel unsafe traveling alone** — this is the single biggest barrier to solo group trip bookings
- Solo travelers want to join groups but feel awkward being "the one who doesn't know anyone"
- No platform solves the **"who will I be traveling with?"** anxiety — travelers book blind and hope for the best
- Pre-trip chat builds bonds → travelers post trip photos tagging the platform → organic social media content

**How it makes us stand out:**
- **Social proof on listings:** "4 solo travelers already booked" → removes "am I the only solo person?" anxiety. No other platform shows this.
- **Gender ratio + age range** on listings → women can make informed safety decisions before booking
- **Vibe Match %** is inherently shareable — "I'm 92% vibe match with this Goa trip 🎯" → Instagram stories, WhatsApp
- **Pre-trip group chat** → travelers meet before traveling → builds excitement + coordinates logistics → makes the trip itself better
- **Word of mouth:** "I went solo and made 5 friends through TripCompare" — the best marketing story possible
- **Retention hook:** Solo travelers come back because they had a great social experience, not just a great trip

**Scope:**
- [ ] DB: `VibeProfile` on User model (travelPace, energy, interests[], budget, socialStyle)
- [ ] DB: Extend Booking/TripRequest to track solo vs group booking type
- [ ] BE: `VibeProfileService` — save/update profile, compute match % between user and trip's existing bookers
- [ ] BE: `GET /api/v1/trips/:id/whos-going` — anonymized demographic summary (solo count, couple count, age range, gender split)
- [ ] BE: Vibe match algorithm (weighted similarity on 5 dimensions)
- [ ] Shared: `VibeProfile` type, quiz question schema
- [ ] FE: Vibe quiz during onboarding (5 fun visual questions, skippable)
- [ ] FE: Profile page → edit vibe profile
- [ ] FE: Trip detail page → "Who's Going" section (demographics, vibe match badge)
- [ ] FE: Pre-trip group chat (extend existing Socket.IO chat → `ConversationType.TRIP_GROUP`)
- [ ] FE: Solo buddy match suggestion card (optional, same gender + similar vibe)

---

##### 7. Trip Replay (Social Proof Wall)

**What:** After trip completion, all travelers are prompted to upload photos/short captions to a shared **Trip Replay** page — a chronological photo timeline of the real trip experience. Shareable link with auto-generated OG image.

> Full design in [`docs/rnd/viral-features-rnd.md`](../rnd/viral-features-rnd.md) — Feature 6

**Why we need it:**
- **"What will this trip actually be like?"** — listings show promise, travelers want to see the REAL experience from REAL people
- Stock photos and organizer-curated images → low trust. Traveler-uploaded photos from actual trips → high trust.
- Trip Replays give future bookers **social proof on steroids** — 18 real travelers, real photos, real captions
- Post-trip engagement keeps travelers on the platform AFTER the trip (most platforms lose users here)
- Each Trip Replay becomes an **indexed SEO page** with authentic content — Google loves UGC

**How it makes us stand out:**
- **Travelers share THEIR photos from Trip Replay** → friends see platform branding → free marketing
- **Shareable Trip Replay links:** "Check out my trip! [link]" → friends discover platform, see trip details, book the next one
- **Organizer marketing:** "Look at my last 10 Trip Replays" → builds reputation better than any bio or Instagram post
- **Social proof pipeline:** Trip Replay → future traveler sees real photos → books confidently → completes trip → adds to Replay → ∞
- **No competitor has this** — GoGaffl has no post-trip UGC, Tripoto has blogs (long-form, low participation), Instagram is fragmented

**Scope:**
- [ ] DB: `TripReplay` (tripId, userId, bookingId, photos[], caption, dayNumber, createdAt)
- [ ] BE: `TripReplayService` — submit replay entry (only COMPLETED booking travelers), get replay by tripId
- [ ] BE: `GET /api/v1/trips/:id/replay` — chronological photo timeline, `POST /api/v1/trips/:id/replay`
- [ ] BE: Post-trip notification nudge (24h after trip completion)
- [ ] Shared: `TripReplayEntry` type, validators
- [ ] FE: `/trips/[slug]/replay` page — photo timeline grouped by day, traveler avatars + captions
- [ ] FE: "Add to Trip Replay" modal (select day, upload photos, write caption)
- [ ] FE: Trip detail page → "Trip Replay" tab/section (if replay entries exist)
- [ ] FE: Post-trip prompt in My Bookings: "Share your trip photos! 📸"
- [ ] FE: WhatsApp/social share button with auto-generated OG image
- [ ] SEO: Trip Replay pages indexed with `generateMetadata()`, real traveler photos as OG images

---

##### 8. Organizer Trust Score (Multi-Dimensional)

**What:** A computed, multi-dimensional trust score (0-100) for each organizer — not just a star rating, but a **transparent breakdown** of exactly why you should (or shouldn't) trust them. Components: identity verification, track record, listing accuracy, responsiveness, financials, community rating.

> Full design in [`docs/rnd/viral-features-rnd.md`](../rnd/viral-features-rnd.md) — Feature 8

**Why we need it:**
- **"Can I trust this organizer?"** is the #1 booking anxiety — Instagram followers ≠ trustworthiness
- A 4.7★ rating tells you something, but a **94/100 Trust Score** with 9 visible dimensions tells you everything
- Good organizers invest years building their Trust Score → **can't leave the platform** (competitive moat, like Zomato restaurant ratings)
- Computed from **existing data** — reviews, bookings, disputes, chat response time, verification status. Low build cost, high trust impact.

**How it makes us stand out:**
- **Good organizers WANT this** — it's free marketing: "I have a 94/100 Trust Score on TripCompare" → they share it
- **Travelers share the standard:** "Only book organizers with 90+ Trust Score" → creates a platform-native trust benchmark
- **Media angle:** "This platform makes trip organizer accountability transparent" → PR coverage
- **Competitive moat:** Once organizers have a high Trust Score, switching cost is enormous — their reputation lives here
- **Beyond star ratings:** Breakdown shows Aadhaar verified ✅, 47 trips completed, 98% listing accuracy, 96% on-time, 0 disputes, < 2h response time → travelers see the FULL picture

**Score Components (computed, not self-reported):**

| Component | Source | Weight |
|-----------|--------|--------|
| Identity verified (Aadhaar + PAN + bank) | OrganizerProfile.verificationStatus | 15% |
| Trips completed | Trip.status = COMPLETED count | 15% |
| Listing accuracy | TripShield dispute rate (future) | 10% |
| On-time record | Traveler review accuracy ratings | 10% |
| Average rating | Review.overallRating avg | 20% |
| Review volume | Review count (log-scaled) | 10% |
| Chat response time | Message response time avg | 10% |
| Dispute/cancellation rate | Cancelled trips + refund requests / total | 10% |

**Scope:**
- [ ] BE: `TrustScoreService` — compute score from existing repos (reviews, bookings, trips, chat, organizer profile)
- [ ] BE: `GET /api/v1/organizers/:id/trust-score` endpoint
- [ ] BE: Cache score in Redis (recompute daily via cron or on-demand with TTL)
- [ ] Shared: `TrustScore` type (overall score + component breakdown)
- [ ] FE: `TrustScoreBadge` component (circular score indicator, used on trip cards + organizer profile)
- [ ] FE: `TrustScoreBreakdown` component (full breakdown card on organizer profile page)
- [ ] FE: Trip detail → organizer section shows Trust Score badge
- [ ] FE: Trip card → optional Trust Score mini-badge
- [ ] FE: Comparison table → Trust Score row

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
1. ~~Login/signup page OTP verification for number and gmail~~ ✅ Done (phone OTP, email OTP, Google sign-in)
2. ~~Traveler is redirected to dashboard — please fix~~ ✅ Done (organizer redirect to /dashboard, traveler stays on /trips)
3. ~~Don't allow Organizer to go to trips list page, only dashboard~~ ✅ Done (header hides Explore Trips for ORGANIZER, /trips redirects organizers)
4. ~~Compare UI visible in all pages — show in trips list page only~~ ✅ Done (GlobalCompareBar scoped to `/trips` via pathname check)
5. ~~When clicking signin button, no loader shown~~ (needs verification — low priority)
6. ~~Please check pagination~~ ✅ Done (shared Pagination component with ellipsis: < 1 ... 4 5 6 ... 20 >)
7. ~~Modals are in viewport — fix it~~ (needs verification — low priority)
8. ~~Trip is getting created even without clicking create trip~~ ✅ Fixed (Enter key prevention on form)
9. ~~Uploaded image of trip is not visible~~ (needs verification — low priority)
10. ~~Please have cron job for expiry trip request + removing tokens~~ ✅ Done (4 cron jobs: bookings, requests, codes, tokens)
11. ~~Nav bar is not consistent in all pages~~ ✅ Fixed (header role-based nav links)
12. ~~Show proper error message if we are showing error in UI~~ ✅ Done (ErrorState with title + message props)
13. ~~Admin Manual Cashback (Post-Trip Completion)~~ ✅ Done
    - BE: 6 admin cashback methods + 1 wallet cashback endpoint, 15 new tests (602 total)
    - FE: `/admin/cashback` (3 tabs: Issue, By User, By Trip), `/admin/cashback/[tripId]` (issue page), `/admin/cashback/user/[userId]` (drill-down)
    - Traveler wallet shows `tripName` on CASHBACK transactions
    - Duplicate prevention via `@@unique([type, referenceModel, referenceId])` on WalletTransaction
    - Cashback capped at booking `totalAmount`, withdraw OFF by default (Phase 2)
*This MVP plan aligns with the aggregator model and anti-leakage strategy defined in the [R&D document](../rnd/group-travel-market-research.md).*

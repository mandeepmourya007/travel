# QA Test Flows — Organizer Role

All flows an organizer can perform. For each flow: steps to test, expected result, and DB tables/columns to verify.

> **Pre-condition:** Organizer must be invited by Admin (invite token required for signup). All organizer routes require `role = ORGANIZER`.

---

## 1. Signup via Admin Invite

**Steps**
1. Receive invite email with link `/signup/organizer/:token`
2. Enter name, email, password
3. Submit

**Expected**
- Account created with role ORGANIZER
- OrganizerProfile record auto-created
- Invite token marked as used

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `User` | `role` | `ORGANIZER` |
| `User` | `email` | entered email |
| `OrganizerProfile` | `userId` | new user ID |
| `OrganizerProfile` | `status` | `PENDING` (awaiting admin approval) |
| `OrganizerInvite` | `token` | used invite token |
| `OrganizerInvite` | `acceptedAt` | current timestamp |
| `Wallet` | `userId` | new organizer ID |

---

## 2. Complete Organizer Profile

**Steps**
1. After signup, fill in business name, description, profile photo
2. Save

**Expected**
- OrganizerProfile updated

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `OrganizerProfile` | `businessName` | entered value |
| `OrganizerProfile` | `description` | entered value |
| `OrganizerProfile` | `logoUrl` | Cloudinary URL (if uploaded) |

---

## 3. Upload KYC Documents

**Steps**
1. Go to `/dashboard/settings/verification`
2. Upload required documents (government ID, business proof, etc.)
3. Submit for review

**Expected**
- Documents saved; status set to PENDING_REVIEW

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `DocumentReview` | `organizerId` | current organizer profile ID |
| `DocumentReview` | `docType` | e.g. `GOVT_ID`, `BUSINESS_PROOF` |
| `DocumentReview` | `fileUrl` | Cloudinary URL |
| `DocumentReview` | `status` | `PENDING_REVIEW` |
| `DocumentReview` | `submittedAt` | current timestamp |

---

## 4. View Admin Comments on KYC Docs

**Steps**
1. Go to `/dashboard/settings/verification`
2. View comments left by admin on documents

**Expected**
- Admin feedback visible per document

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `DocumentReviewComment` | `organizerId` | current organizer |
| `DocumentReviewComment` | `docType` | specific document type |
| `DocumentReviewComment` | `body` | admin's comment text |
| `DocumentReviewComment` | `authorRole` | `ADMIN` |

---

## 5. Connect Bank Account (Razorpay)

**Steps**
1. Go to `/dashboard/settings/bank`
2. Enter bank account details
3. Submit → Razorpay account linking

**Expected**
- Razorpay linked account ID saved

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `OrganizerProfile` | `razorpayAccountId` | Razorpay linked account ID (non-null) |
| `OrganizerProfile` | `bankVerified` | `true` |

---

## 6. Create a Trip (Draft)

**Steps**
1. Go to `/dashboard/trips/create`
2. Fill in trip name, description, destination, start/end dates, price, inclusions/exclusions, itinerary, images
3. Click "Save as Draft"

**Expected**
- Trip saved with DRAFT status; not visible to public

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Trip` | `organizerId` | current organizer profile ID |
| `Trip` | `status` | `DRAFT` |
| `Trip` | `name` | entered value |
| `Trip` | `destinationId` | selected destination |
| `Trip` | `startDate` / `endDate` | entered dates |
| `Trip` | `pricePerPerson` | entered price |
| `Trip` | `slug` | auto-generated from name |
| `TripEditHistory` | `tripId` | new trip |
| `TripEditHistory` | `editedBy` | current user ID |

---

## 7. Add Vehicle & Seat Layout

**Steps**
1. On trip edit page, go to "Vehicles" section
2. Click "Add Vehicle"
3. Enter vehicle name, capacity, seat layout (rows, columns)
4. Save

**Expected**
- Vehicle created with generated seat records

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripVehicle` | `tripId` | current trip |
| `TripVehicle` | `name` | entered vehicle name |
| `TripVehicle` | `capacity` | total seat count |
| `VehicleSeat` | `vehicleId` | new vehicle |
| `VehicleSeat` | `seatNumber` | e.g. A1, A2, B1... |
| `VehicleSeat` | `status` | `AVAILABLE` |
| Count of `VehicleSeat` | — | equals vehicle capacity |

---

## 8. Edit Vehicle Seat Layout

**Steps**
1. On existing vehicle, click "Edit"
2. Change rows/columns or mark certain seats as unavailable
3. Save

**Expected**
- Seat layout updated; existing booked seats must remain untouched

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripVehicle` | `updatedAt` | current timestamp |
| `VehicleSeat` | `status` | `UNAVAILABLE` for blocked seats |
| `VehicleSeat` (booked) | `status` | `BOOKED` (unchanged) |

---

## 9. Delete a Vehicle

**Steps**
1. On trip edit page, click delete on a vehicle with no bookings

**Expected**
- Vehicle and its seats removed

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripVehicle` | `id` | record deleted (or soft-deleted) |
| `VehicleSeat` | `vehicleId` | no seats with this vehicle ID |

---

## 10. Publish a Trip

**Steps**
1. On a DRAFT trip, click "Publish"

**Expected**
- Trip status changes to ACTIVE; now visible on public search

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Trip` | `status` | `ACTIVE` |
| `Trip` | `publishedAt` | current timestamp |
| `Trip` | `acceptingBookings` | `true` |

---

## 11. Toggle Accepting Bookings

**Steps**
1. On an ACTIVE trip, click "Pause Bookings" toggle

**Expected**
- New bookings blocked; existing bookings unaffected

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Trip` | `acceptingBookings` | `false` |
| `Booking` (existing) | `status` | unchanged |

---

## 12. Edit a Published Trip

**Steps**
1. On an ACTIVE trip, click "Edit"
2. Change price, description, itinerary, etc.
3. Save

**Expected**
- Trip updated; edit recorded in history

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Trip` | `updatedAt` | current timestamp |
| `TripEditHistory` | `tripId` | this trip |
| `TripEditHistory` | `changedFields` | JSON list of changed fields |
| `TripEditHistory` | `editedBy` | current user |

---

## 13. View Trip Edit History

**Steps**
1. On a trip, click "Edit History" or view audit log

**Expected**
- Paginated list of all changes with timestamp and editor

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripEditHistory` | `tripId` | current trip |
| `TripEditHistory` | `editedAt` | descending order |

---

## 14. Duplicate a Trip

**Steps**
1. On an existing trip, click "Duplicate"

**Expected**
- New DRAFT trip created with same data (new slug, DRAFT status)

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Trip` | `status` | `DRAFT` (new copy) |
| `Trip` | `slug` | different from original |
| `Trip` | `organizerId` | same organizer |
| `TripEditHistory` | `action` | `DUPLICATE` |

---

## 15. Delete a Trip

**Steps**
1. On a DRAFT trip (no bookings), click "Delete"

**Expected**
- Trip soft-deleted; no longer visible

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Trip` | `deletedAt` | current timestamp (soft delete) |
| `Trip` | `status` | `DELETED` or hidden from public |

---

## 16. View Trip Bookings (Participants Dashboard)

**Steps**
1. Go to `/dashboard/trips` → click a trip → "Participants" tab

**Expected**
- List of confirmed travelers with their details

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Booking` | `tripId` | current trip |
| `Booking` | `status` | `CONFIRMED` |
| `TravelerDetail` | `bookingId` | each booking |
| `TravelerDetail` | `name`, `age` | traveler info |

---

## 17. View Pending Booking Requests

**Steps**
1. Go to `/dashboard/requests`
2. View requests awaiting approval

**Expected**
- List of all PENDING requests across all trips

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripRequest` | `status` | `PENDING` |
| `TripRequest` | `organizerId` | current organizer |

---

## 18. Approve a Booking Request

**Steps**
1. On a pending request, click "Approve"

**Expected**
- Request status → APPROVED; Booking created; traveler notified

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripRequest` | `status` | `APPROVED` |
| `TripRequest` | `reviewedAt` | current timestamp |
| `Booking` | `status` | `CONFIRMED` |
| `Booking` | `tripRequestId` | linked to the request |
| `Notification` | `userId` | traveler's user ID (approval notification) |

---

## 19. Reject a Booking Request

**Steps**
1. On a pending request, click "Reject" → provide reason

**Expected**
- Request status → REJECTED; traveler notified

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripRequest` | `status` | `REJECTED` |
| `TripRequest` | `rejectionReason` | entered reason |
| `TripRequest` | `reviewedAt` | current timestamp |
| `Notification` | `userId` | traveler's user ID (rejection notification) |

---

## 20. View Trip Booking Summary

**Steps**
1. On a trip, view summary panel (e.g. header of participants page)

**Expected**
- Confirmed count, pending count, and revenue displayed correctly

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Booking` | `tripId` + `status=CONFIRMED` | count matches UI |
| `TripRequest` | `tripId` + `status=PENDING` | count matches UI |
| `PaymentTransaction` | `tripId` + `status=CAPTURED` | sum matches revenue shown |

---

## 21. View Organizer Dashboard Stats

**Steps**
1. Go to `/dashboard`

**Expected**
- Total trips, total bookings, and total revenue shown correctly

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Trip` | `organizerId` | total trip count matches |
| `Booking` | `status=CONFIRMED` per organizer | booking count matches |
| `PaymentTransaction` | `status=CAPTURED` per organizer | revenue sum matches |

---

## 22. View Seat Map (Organizer View)

**Steps**
1. On a trip with vehicles, open organizer seat map view

**Expected**
- All seats visible; each labeled as AVAILABLE / BOOKED / HELD / UNAVAILABLE with traveler name on booked seats

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `VehicleSeat` | `status` | matches each seat's display |
| `VehicleSeat` | `bookingId` | non-null for booked seats |
| `TravelerDetail` | `bookingId` | traveler name matches seat tooltip |

---

## 23. View Payout Statement

**Steps**
1. Go to `/dashboard` (payments/payout section)

**Expected**
- List of trip payouts with escrow and settled amounts

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `PaymentTransaction` | `organizerId` | current organizer |
| `PaymentTransaction` | `type` | `PAYOUT` or `ESCROW` |
| `PaymentTransaction` | `amount` | matches payout amounts shown |

---

## 24. Reply to a Review

**Steps**
1. Go to `/dashboard/reviews`
2. Find an unanswered review → click "Reply"
3. Enter reply text → submit

**Expected**
- Reply saved; visible on trip page under review

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Review` | `organizerReply` | entered reply text |
| `Review` | `repliedAt` | current timestamp |

---

## 25. Chat with Traveler

**Steps**
1. From dashboard or booking detail, open conversation with a traveler
2. Send message

**Expected**
- Message delivered; traveler can see it

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Conversation` | `participants` | includes organizer user ID |
| `Message` | `senderId` | organizer user ID |
| `Message` | `content` | sent text |

---

## 26. Request a New Trip Category

**Steps**
1. During trip creation, select "Request New Category"
2. Enter category name and description
3. Submit

**Expected**
- Category request created with PENDING status

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripTypeRequest` | `requestedBy` | organizer user ID |
| `TripTypeRequest` | `name` | entered category name |
| `TripTypeRequest` | `status` | `PENDING` |

---

## 27. View My Category Requests

**Steps**
1. In trip creation or settings, view "My Category Requests"

**Expected**
- List of requested categories with their PENDING / APPROVED / REJECTED status

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripTypeRequest` | `requestedBy` | current organizer |
| `TripTypeRequest` | `status` | reflects admin decision |

---

## 28. Upload Assets via Signed URL

**Steps**
1. During trip creation, upload image/photo
2. System requests Cloudinary signed URL, then uploads directly

**Expected**
- Upload succeeds; returned Cloudinary URL saved in trip

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Trip` | `images` | contains new Cloudinary URL |

---

## 29. View Notifications

**Steps**
1. Check notification bell

**Expected**
- Organizer receives notifications for: new booking requests, cancellations, new reviews

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Notification` | `userId` | organizer user ID |
| `Notification` | `type` | e.g. `NEW_BOOKING_REQUEST`, `BOOKING_CANCELLED`, `NEW_REVIEW` |
| `Notification` | `readAt` | `null` until read |

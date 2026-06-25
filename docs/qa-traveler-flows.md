# QA Test Flows — Traveler Role

All flows a traveler can perform. For each flow: steps to test, expected result, and DB tables/columns to verify.

---

## 1. Signup — Email & Password

**Steps**
1. Go to `/signup`
2. Enter name, email, password, confirm password
3. Submit form

**Expected**
- Redirect to `/onboarding` to complete profile
- User receives verification email (if SMTP configured)

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `User` | `email` | entered email (lowercase) |
| `User` | `role` | `TRAVELER` |
| `User` | `passwordHash` | bcrypt hash (not plain text) |
| `User` | `emailVerified` | `false` (until OTP verified) |
| `User` | `createdAt` | current timestamp |
| `Wallet` | `userId` | matches new user ID |
| `Wallet` | `balance` | `0` |

---

## 2. Signup — Phone OTP

**Steps**
1. Go to `/login/phone`
2. Enter phone number → click "Send OTP"
3. Enter received OTP
4. Complete onboarding if first time

**Expected**
- OTP sent via SMS
- On success: user logged in and redirected to home or onboarding

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `VerificationCode` | `phone` | entered phone |
| `VerificationCode` | `expiresAt` | future timestamp |
| `VerificationCode` | `used` | `true` after verification |
| `User` | `phone` | entered phone |
| `User` | `phoneVerified` | `true` |

---

## 3. Signup — Email OTP

**Steps**
1. Go to `/login/email-otp`
2. Enter email → click "Send OTP"
3. Enter received OTP

**Expected**
- OTP email sent
- On success: user logged in

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `VerificationCode` | `email` | entered email |
| `VerificationCode` | `used` | `true` after verification |
| `User` | `emailVerified` | `true` |

---

## 4. Login — Google OAuth

**Steps**
1. Go to `/login`
2. Click "Continue with Google"
3. Complete Google consent screen

**Expected**
- Redirected back to app, logged in
- New user created if first time

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `User` | `googleId` | Google subject ID |
| `User` | `emailVerified` | `true` |
| `RefreshToken` | `userId` | matches user ID |
| `RefreshToken` | `expiresAt` | future date |

---

## 5. Complete Onboarding Profile

**Steps**
1. After signup, land on `/onboarding/profile`
2. Enter display name, optionally phone/avatar
3. Submit

**Expected**
- Profile saved, redirect to home `/`

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `User` | `name` | entered name |
| `User` | `avatarUrl` | Cloudinary URL (if uploaded) |
| `User` | `onboardingComplete` | `true` |

---

## 6. Browse & Search Trips

**Steps**
1. Go to `/trips`
2. Apply filters: destination, date range, price range, trip type
3. Sort by price / duration / rating

**Expected**
- Results update; only ACTIVE trips shown
- Pagination works

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Trip` | `status` | `ACTIVE` only in results |
| `Trip` | `acceptingBookings` | `true` for bookable trips |
| `Trip` | `destinationId` | matches selected destination filter |
| `Trip` | `startDate` | within filtered date range |

---

## 7. View Trip Details

**Steps**
1. From search results, click a trip card
2. View trip at `/trips/:slug`

**Expected**
- Full details shown: itinerary, photos, pricing, vehicle seats, organizer info, reviews
- Seat availability counts correct

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Trip` | `slug` | matches URL slug |
| `TripVehicle` | `tripId` | matches trip |
| `VehicleSeat` | `status` | `AVAILABLE` / `BOOKED` counts match UI |
| `Review` | `tripId` | reviews belong to this trip |

---

## 8. Compare Trips

**Steps**
1. On search page, select "Compare" checkbox on 2–3 trips
2. Click "Compare" button → go to `/trips/compare`

**Expected**
- Side-by-side comparison of price, duration, inclusions, rating

**DB Verification**
- No write. Verify `Trip` records for each selected trip are ACTIVE.

---

## 9. Instant Booking

**Steps**
1. On trip detail page, click "Book Now"
2. Fill in traveler details (name, age, ID type)
3. Select seats from interactive seat map
4. Click "Pay" → Razorpay checkout opens
5. Complete payment

**Expected**
- Booking confirmed; confirmation screen shown
- Seats locked

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Booking` | `userId` | logged-in user |
| `Booking` | `tripId` | booked trip |
| `Booking` | `status` | `CONFIRMED` |
| `Booking` | `totalAmount` | correct amount |
| `TravelerDetail` | `bookingId` | linked to booking |
| `TravelerDetail` | `name`, `age` | entered values |
| `VehicleSeat` | `bookingId` | selected seat linked to booking |
| `VehicleSeat` | `status` | `BOOKED` |
| `PaymentTransaction` | `bookingId` | linked |
| `PaymentTransaction` | `status` | `CAPTURED` |
| `PaymentTransaction` | `razorpayPaymentId` | non-null |

---

## 10. Request-Based Booking (Organizer Approval Flow)

**Steps**
1. On a trip that requires organizer approval, click "Request to Book"
2. Fill in traveler details
3. Submit request

**Expected**
- Request created with PENDING status
- Traveler sees "Awaiting Approval" in bookings

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripRequest` | `userId` | logged-in user |
| `TripRequest` | `tripId` | requested trip |
| `TripRequest` | `status` | `PENDING` |
| `TravelerDetail` | `tripRequestId` | linked to request |

---

## 11. Seat Selection (Seat Hold)

**Steps**
1. During booking checkout, view interactive seat map
2. Click available seats to hold them

**Expected**
- Selected seats temporarily reserved (held state)
- Held seats cannot be selected by another user during the hold window

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `VehicleSeat` | `status` | `HELD` during hold window |
| `VehicleSeat` | `heldByUserId` | logged-in user ID |
| `VehicleSeat` | `heldUntil` | future timestamp within hold TTL |

---

## 12. Verify Payment After Razorpay

**Steps**
1. After Razorpay redirect, frontend calls verify-payment
2. System validates Razorpay signature

**Expected**
- Booking confirmed; payment status updated to CAPTURED

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `PaymentTransaction` | `status` | `CAPTURED` |
| `PaymentTransaction` | `razorpaySignature` | non-null, valid |
| `Booking` | `status` | `CONFIRMED` |

---

## 13. View My Bookings

**Steps**
1. Go to `/my-bookings`
2. Switch tabs: Upcoming / Completed / Cancelled

**Expected**
- Each tab shows correct bookings; counts match tab badges

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Booking` | `userId` | current user only |
| `Booking` | `status` | `CONFIRMED` (upcoming), `COMPLETED`, `CANCELLED` per tab |

---

## 14. Cancel a Booking

**Steps**
1. Go to `/my-bookings` → find an upcoming booking
2. Click "Cancel" → provide reason
3. Confirm cancellation

**Expected**
- Booking status updated to CANCELLED
- Refund issued to wallet (if within cancellation policy)

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Booking` | `status` | `CANCELLED` |
| `Booking` | `cancellationReason` | entered reason |
| `PaymentTransaction` | `status` | `REFUNDED` (if applicable) |
| `Wallet` | `balance` | increased by refund amount |
| `WalletTransaction` | `type` | `REFUND` |
| `WalletTransaction` | `amount` | refund amount |
| `VehicleSeat` | `status` | `AVAILABLE` (released back) |
| `VehicleSeat` | `bookingId` | `null` |

---

## 15. View Payment History

**Steps**
1. Go to `/my-payments`

**Expected**
- List of all payments made; each shows trip name, amount, date, status

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `PaymentTransaction` | `userId` | current user only |
| `PaymentTransaction` | `status` | any (CAPTURED, REFUNDED, PENDING) |

---

## 16. Wallet — View Balance & Transactions

**Steps**
1. Go to `/wallet`
2. View balance
3. View transaction history

**Expected**
- Balance shown correctly
- History shows REFUND and CASHBACK entries

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Wallet` | `userId` | current user |
| `Wallet` | `balance` | matches sum of wallet transactions |
| `WalletTransaction` | `type` | `REFUND` or `CASHBACK` |
| `WalletTransaction` | `amount` | positive for credits |

---

## 17. Chat — Message Organizer

**Steps**
1. On trip detail page, click "Message Organizer"
2. Type and send a message

**Expected**
- Conversation created (or existing one opened)
- Message delivered and visible in chat

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Conversation` | `tripId` | current trip |
| `Conversation` | `participants` | traveler + organizer user IDs |
| `Message` | `conversationId` | linked conversation |
| `Message` | `senderId` | current traveler |
| `Message` | `content` | sent text |
| `Message` | `readAt` | `null` initially |

---

## 18. View Unread Message Count

**Steps**
1. Check badge on the messages icon in nav

**Expected**
- Badge count matches total unread messages

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Message` | `readAt` | `null` = unread |
| Count | — | matches badge number |

---

## 19. Submit a Review

**Steps**
1. After a trip is completed, go to the booking
2. Click "Write a Review"
3. Enter rating (1–5), title, body
4. Submit

**Expected**
- Review saved; visible on trip detail page

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Review` | `bookingId` | linked booking |
| `Review` | `userId` | current traveler |
| `Review` | `tripId` | reviewed trip |
| `Review` | `rating` | 1–5 |
| `Review` | `body` | entered text |
| `Trip` | `avgRating` | recalculated to include new review |

---

## 20. Edit a Review

**Steps**
1. Go to a completed booking that has a review
2. Click "Edit Review"
3. Update rating or body
4. Save

**Expected**
- Review updated; trip average rating recalculated

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Review` | `updatedAt` | current timestamp |
| `Review` | `rating` | new value |
| `Review` | `body` | new value |

---

## 21. View Notifications

**Steps**
1. Click notification bell in nav
2. Click individual notification to navigate

**Expected**
- Unread notifications shown; clicking marks as read

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Notification` | `userId` | current user |
| `Notification` | `readAt` | `null` before click, timestamp after |

---

## 22. Update Profile

**Steps**
1. Go to `/profile`
2. Update name, avatar, phone or email
3. Save

**Expected**
- Changes persisted; avatar uploaded to Cloudinary

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `User` | `name` | updated value |
| `User` | `avatarUrl` | new Cloudinary URL |
| `User` | `phone` | updated value |

---

## 23. View Pending Booking Requests

**Steps**
1. Go to `/my-bookings` → "Pending" tab

**Expected**
- Shows request-based bookings awaiting organizer approval

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `TripRequest` | `userId` | current user |
| `TripRequest` | `status` | `PENDING` |

---

## 24. Check Trip Booking Status

**Steps**
1. Visit a trip page the user has already booked

**Expected**
- UI shows "You've booked this trip" or "Request pending" instead of booking CTA

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `Booking` or `TripRequest` | `userId` + `tripId` | record exists for current user |

---

## 25. Logout

**Steps**
1. Click "Logout" from profile menu

**Expected**
- Session ended; redirected to `/login`

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `RefreshToken` | `revoked` | `true` for current session token |

---

## 26. Logout All Devices

**Steps**
1. Go to profile settings → "Logout from all devices"

**Expected**
- All active sessions terminated

**DB Verification**
| Table | Column | Expected Value |
|-------|--------|----------------|
| `RefreshToken` | `revoked` | `true` for ALL tokens belonging to user |

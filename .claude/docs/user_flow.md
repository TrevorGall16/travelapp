# USER_FLOW.md

**For:** Builder AI  
**Project:** Solo Travel Social App (NomadMeet - Working Title) 
**Purpose:** Define every screen-by-screen user journey so the Builder AI can implement navigation and logic without asking for clarification.

---

## CORE PRINCIPLE
Every flow must be implementable without ambiguity. Each step = one distinct screen state or action. If a step has conditions (authenticated vs guest, empty vs populated), both branches must be described.

---

## FLOW 1: FIRST LAUNCH & ONBOARDING
**Trigger:** User opens app for the first time (no session exists)

1. **Splash Screen:** App logo, 1.5 second display, auto-navigate to Onboarding.
2. **Onboarding Screen 1:** Full-screen illustration + headline "Meet travelers, not tourists" + CTA button "Get Started" + secondary link "I already have an account".
3. **Onboarding Screen 2:** Illustration + headline "Drop a pin. Find your people." + CTA "Next".
4. **Onboarding Screen 3:** Illustration + headline "Real meetups. Real moments." + CTA "Create My Profile".
5. **Auth Screen:** Google OAuth or Apple Sign In. No email/password option.
6. **Profile Setup (Mandatory):** - Upload profile photo (face required — enforced by instruction text). Cannot skip.
   - Enter display name (first name only, max 20 characters).
   - Select home country from searchable dropdown.
   - *State:* "Next" button disabled until all three are filled.
7. **Profile Setup (Optional):** - Short bio (max 160 characters).
   - Instagram handle (auto-strips the `@`).
   - CTA "Done" (skippable).
8. **Permissions Screen:** Request location permission ("While Using App" only). Explanation: "NomadMeet needs your location to show events near you and let others find your events." 
   - Buttons: "Allow Location" and "Not Now".
   - If denied: navigate to Map but show non-dismissible prompt.
   - If accepted: navigate to Main Map Screen.

---

## FLOW 2: MAIN MAP SCREEN (HOME / TAB 1)
**Trigger:** Authenticated user with complete profile

**Default state (events exist nearby):**
1. Full-screen interactive map (Apple Maps on iOS, Google Maps on Android).
2. User's own location shown as a standard blue dot.
3. Event pins visible on map within 5km radius.
4. Pin design: Teardrop shape containing category emoji. Verified host pins have an electric blue ring. Max 50 individual pins visible; clusters beyond that using `supercluster`.
5. Top bar: City name + Toggle button for Map/List view.
6. Floating Action Button (FAB) bottom-right: "+" (electric blue) to create event.
7. Bottom navigation bar (3 tabs): Map (active) | My Events | Profile.

**Empty state (no events nearby):** Map visible, no pins. Banner shows "No events nearby. Drop a pin to start one!" FAB still visible.

**List View Toggle:** Vertical scroll of event cards sorted by expiry soonest first. Remembers last selected sort filter for the session.

**Interactions:**
* **Tap event pin or cluster:** Cluster expands. Pin opens Event Card Bottom Sheet (Flow 4).
* **Tap FAB "+":** Navigate to Create Event Modal (Flow 3).

---

## FLOW 3: CREATE EVENT
**Trigger:** User taps "+" FAB on Map Screen

1. **Event Creation Modal:** Full screen overlay or large bottom sheet.
2. **Fields (in order):**
   - Title: min 10 chars, max 60 chars.
   - Category selector: Beer/Bar 🍺 | Food 🍜 | Sightseeing 🏛️ | Adventure 🧗 | Culture 🎭 | Other 📍.
   - Location: defaults to current GPS. User can drag pin.
   - Description (optional): max 300 characters.
   - Expiry time: 2h / 4h / 8h / Tomorrow morning (9:00 AM local time).
   - Verified Toggle (Verified users only): "Verified travelers only".
3. **Publish button:** Disabled until title, category, and location are valid.
4. **On Publish:** Optimistic UI update — pin appears immediately. User auto-joins as host, Stream channel created. Toast: "Your event is live! 🎉"

**Limits:** Free users max 1 active event. If limit reached, show paywall bottom sheet: "Create unlimited events with Verified status — €4.99".

---

## FLOW 4: VIEW EVENT (EVENT CARD)
**Trigger:** User taps an event pin on the map or an event in a list

1. **Event Card Bottom Sheet:** Slides up showing:
   - Event title + Category emoji.
   - Host name, avatar, verified badge.
   - Countdown timer (Green >60m, Yellow 60-30m, Red <30m).
   - "Discovery Area" label for the pin location.
   - "Official Meetup Point" section (shows address if set, or "Not decided yet").
   - Participant count + up to 5 avatars.
   - Buttons: "Join Event" (primary, electric blue), Share, Report.
2. **Tap "Join Event":** Confirm join -> add user to participant list -> add user to Stream group chat -> navigate to Group Chat Screen.

---

## FLOW 5: GROUP CHAT (FULL SCREEN)
**Trigger:** User joins an event OR taps an event from "My Events"

1. **Header Bar:** Back arrow, Event title, Participant count button ("👥 X"), "..." menu.
2. **Meetup Banner (Permanently fixed below header):**
   - If set: Shows label, distance ("12 min walk" or "180m away"), "Set by [name]", "Open in Maps" button.
   - If not set: Shows "No meetup point yet" in muted text.
   - *Never scrolls away.*
3. **Participant Avatar Strip:** Horizontal scroll of avatars below the meetup banner.
4. **Chat Feed:** Stream.io UI. WhatsApp-style bubbles (own = right/electric blue, others = left/gray with name).
5. **Input Bar:** Attachment button (📎), Text field (max 500 chars), Send button.
   - Tap 📎: Options for "Photo Library", "Camera", and "Poll".
   - Tap "Poll": Creates a Stream poll message to vote on meetup ideas.

**Meetup Point Flow (Host Only):**
- Tap "..." -> "Set/Update Meetup Point".
- Mapbox mini-map opens -> drag pin -> optional label (max 50 chars).
- Confirm -> updates Stream channel custom data -> banner updates for all instantly.
- Rate limit: max 3 updates per hour.

---

## FLOW 6: MY EVENTS (TAB 2)
**Trigger:** User taps "My Events" in bottom nav

1. **Screen Layout:** Simple vertical list of all events the user is currently participating in (hosted and joined).
2. **List Items:** Condensed event cards showing Title, Host, Countdown timer, and last chat message preview.
3. **Action:** Tap any row to open the Group Chat (Flow 5).

---

## FLOW 7: VERIFIED TRAVELER BADGE
**Trigger:** User taps "Get Verified" on Profile OR hits the free event limit

1. **Verified Badge Screen:** Explanation of perks. CTA: "Get Verified — €4.99" (One-time IAP via RevenueCat).
2. **Payment Success:** User prompted to enter Instagram handle.
3. **Submission State:** UI shows "Verification Pending". DB row `verified` = 'pending'.
4. **Admin Rejection (Manual):** User receives push notification. Profile UI changes to "Verification Rejected: Please ensure your Instagram is public" with a "Resubmit" button. Tapping resubmit allows changing the handle without a new charge.
5. **Admin Approval (Manual):** Badge appears instantly on profile and map pins (electric blue ring).

---

## FLOW 8: PROFILE & SETTINGS (TAB 3)
**Trigger:** User taps "Profile" in bottom nav

1. **Own Profile View:** Large circular photo, Name, Verified badge, Country flag, Bio, IG link, "Events Hosted" count.
2. **Buttons:** "Edit Profile", "Settings" icon (top right).
3. **Settings Screen:**
   - Account: Email (read-only), Restore Purchases, Sign Out, Delete Account.
   - Notifications: Toggles for New messages, Meetup updated, Expiry warnings.
   - Privacy: Blocked Users list.
   - Legal: Contact Us, ToS, Privacy Policy.
4. **Delete Account (Red text):** Tap -> Warning screen -> User must type "DELETE" -> Calls Edge Function -> Wipes Supabase DB, Auth, and Stream user -> Navigates to Splash.

---

## FLOW 9: POST-EXPIRY (MODEL B)
**Trigger:** Event timer reaches zero

1. **Immediate State:** Event pin vanishes from map. Meetup point locks (padlock icon). Chat becomes read-only for everyone.
2. **Host View:** Sees a one-time "Reopen Chat" button.
3. **If Reopened:** Header turns slate gray (#64748B). "Post-event mode" banner replaces meetup banner. Previous participants can chat again. No new joins allowed.
4. **Hard Deletion:** 7 days post-expiry, Edge Function deletes the event row, Stream channel, and all associated media entirely.

---

## FLOW 10: OFFLINE STATE
**Trigger:** Device loses internet connection

1. **UI Changes:** Top banner appears: "You're offline — reconnect to see live events".
2. **Map:** Frozen with last loaded pins.
3. **Chat:** Input disabled. Meetup banner remains visible using locally cached data + maps deep link URL.
4. **Recovery:** Auto-reconnects and refreshes state when connection is restored.

---

## NAVIGATION FOLDER STRUCTURE (EXPO ROUTER)
```text
app/
├── _layout.tsx (Root layout, initializes providers & deep linking)
├── (auth)/
│   ├── splash.tsx
│   ├── index.tsx (Login)
│   └── setup.tsx (Profile setup)
│
├── (tabs)/
│   ├── _layout.tsx (Bottom Tab Navigator)
│   ├── index.tsx (Map - Tab 1)
│   ├── my-events.tsx (Tab 2)
│   └── profile.tsx (Tab 3)
│
├── event/
│   ├── create.tsx (Modal)
│   └── [id].tsx (Group Chat / View Event)
│
├── user/
│   └── [id].tsx (Other user profile)
│
└── settings/
    ├── index.tsx
    └── verified.tsx
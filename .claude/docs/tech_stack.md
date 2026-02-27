# TECH_STACK.md

**For:** Builder AI  
**Project:** Solo Travel Social App (NomadMeet - Working Title)  
**Purpose:** Define the exact technologies, libraries, and strict boundaries for this project. The Builder AI must use these specific packages and absolutely nothing else for core functionality.

---

## CORE RULES FOR BUILDER AI
1. **Never eject:** This is a strictly managed Expo project. Do not use any library that requires native code modifications (`ios/` or `android/` folders).
2. **No redundant libraries:** If a feature can be built with the approved stack below, do not install a new package.
3. **TypeScript Strict Mode:** All code must be strongly typed. No `any` types.
4. **Zero-UI-Library Policy:** Do not install UI Kitten, React Native Paper, Tamagui, or NativeBase. Build components from scratch using the styling engine defined below.

---

## 1. FRONTEND CORE
* **Framework:** React Native with Expo (Latest SDK).
* **Routing:** Expo Router (File-based navigation).
* **Language:** TypeScript.
* **State Management:** Zustand.
  * *Constraint:* Do not use Redux, MobX, or Context API for global state. Restrict global state to `authStore`, `locationStore`, and `mapStore`.
* **Styling:** NativeWind (Tailwind CSS for React Native) or standard `StyleSheet`.
  * *Constraint:* Keep styling simple and close to the metal. 

---

## 2. BACKEND & INFRASTRUCTURE
* **Database & Auth:** Supabase.
* **Database Engine:** PostgreSQL with the PostGIS extension enabled.
  * *Constraint:* All location queries must use native PostGIS functions (e.g., `ST_DWithin`). Do not calculate map distances in client-side JavaScript.
* **Backend Logic:** Supabase Edge Functions (Deno / TypeScript).
* **Background Jobs:** `pg_cron` calling `pg_net` to trigger Edge Functions for event expiry.
  * *Constraint:* Do not use Database Webhooks. They fail under batch loads.

---

## 3. REAL-TIME & COMMUNICATIONS
* **Chat Engine & Media:** Stream.io React Native SDK (`stream-chat-expo`).
  * *Constraint:* Stream handles all chat messages, chat image attachments, and polls natively. Supabase is strictly forbidden from storing chat text or chat images. NO video support in V1.
* **Map Live Updates:** Supabase Realtime (Postgres CDC).
* **Push Notifications:** Expo Push Notifications (`expo-notifications`).

---

## 4. MAP & LOCATION
* **Location Tracking:** `expo-location`.
  * *Constraint:* Foreground "While Using App" tracking only. No background tracking in V1.
* **Map Rendering:** `react-native-maps`.
  * *Constraint:* Use Apple Maps natively on iOS and Google Maps natively on Android. **DO NOT use Mapbox (`react-native-mapbox-gl`).**
* **Pin Clustering:** `supercluster` (Logic) + custom map markers.
  * *Constraint:* Build the clustering layer cleanly using `supercluster` directly to maintain 60fps with up to 50 individual pins.

---

## 5. FORMS, VALIDATION & UTILS
* **Form Handling:** React Hook Form.
* **Schema Validation:** Zod.
  * *Constraint:* Validate all inputs (Create Event, Edit Profile) via Zod before sending to Supabase or Stream.
* **Date/Time:** `date-fns`.
  * *Constraint:* Do not use Moment.js.
* **Deep Linking:** Handled natively via Expo Router (`expo-linking`).

---

## 6. MEDIA & ASSETS
* **Image Loading:** `expo-image`.
  * *Constraint:* Do not use React Native's standard `<Image>` component. Use `expo-image` for aggressive caching and performance.
* **Icons:** Lucide React Native (`lucide-react-native`).
* **Image Uploads (Profile):** `expo-image-picker`.
  * *Constraint:* Profile photos are uploaded to Supabase Storage. Chat photos go through Stream.io.

---

## 7. MONETIZATION
* **Payments:** RevenueCat (`react-native-purchases`).
  * *Constraint:* **DO NOT install the Stripe native SDK.** Use RevenueCat to handle Apple/Google In-App Purchases for the €4.99 Verified Traveler badge to prevent App Store rejection.

---

## 8. DESTRUCTIVE ACTIONS & TEARDOWN
* **Account Deletion:** Must be handled by a Supabase Edge Function (`delete-user-account`) using the `@supabase/supabase-js` admin client. 
  * *Constraint:* The client app must never possess the permissions to delete users from the auth schema directly. The Edge Function must completely wipe the Stream user, Supabase Auth user, and cascade delete all database rows.

---

## 9. ENVIRONMENT VARIABLES (EXACT NAMES)
The Builder AI must use these exact variable names. Never hardcode keys.

```bash
# Supabase (Client Safe)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Supabase (Server Only - Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=

# Stream.io
EXPO_PUBLIC_STREAM_API_KEY=
STREAM_SECRET_KEY= # Server Only

# RevenueCat
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
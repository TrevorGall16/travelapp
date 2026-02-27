# OVERVIEW.md

**For:** Builder AI  
**Project:** Solo Travel Social App (NomadMeet - Working Title) 

---

## 1. Project Type
Mobile App (Geo-Social Map and Real-Time Chat).

## 2. One-Sentence Summary
A real-time map where solo travelers drop pins to create spontaneous meetup events, join each other's events, and coordinate the actual meetup through a reliable group chat with a built-in authoritative meeting point system.

## 3. Core Purpose
The goal is to allow users to instantly broadcast their location and activity intent so they can coordinate real-world meetups with nearby travelers.

## 4. Target Users
Solo backpackers, digital nomads, and expats looking for immediate, low-stakes social interaction without heavy planning or scheduling.

## 5. Feature List
* **Map Discovery:** User grants location (Input) → Renders 5km radius with live activity pins (Output) → Immediate situational awareness of nearby events (User Benefit).
* **Event Creation:** User selects category and location (Input) → Drops public pin and creates dedicated Stream.io channel (Output) → Fast, friction-free gathering (User Benefit).
* **Meetup Point Coordination:** Host sets location or users vote via Stream Poll (Input) → Permanently anchors a meetup banner in the chat (Output) → Single source of truth for the physical meeting (User Benefit).
* **Persistent Group Chat:** User sends text/photo (Input) → Broadcasts to event channel (Output) → Seamless coordination (User Benefit).
* **Verified Badge:** User completes €4.99 IAP and links Instagram (Input) → Admin approves blue checkmark (Output) → Increased trust and primary platform monetization (User Benefit).

## 6. Constraints & Priorities
* **Tech Restriction:** Strictly managed Expo. No native code ejection.
* **Infrastructure Strictness:** Supabase handles all auth and map data; Stream.io handles all chat data, chat media, and polls. Zero overlap.
* **Map Provider:** Free native maps only (`react-native-maps` using Apple Maps and Google Maps). No Mapbox.
* **Resource Limit:** Operations run entirely via automated Edge Functions and pg_cron. Zero manual server maintenance required.
* **Metadata Pre-Locking:** For iOS/Android submission, the "Marketing URL" and "Support URL" must be set to the canonical root domain on Day 1.
* **Primary Domain Authority:** The canonical domain format is strict HTTPS without 'www' to prevent indexing mismatches.

## 7. Success Criteria
* **Primary Metric:** Did strangers physically stand together at the same coordinates?
* App cold start < 2.5 seconds.
* Map rendering of 50+ clustered pins maintains steady 60fps.
* Crash-free session rate > 99%.

---
*End of Overview Document*
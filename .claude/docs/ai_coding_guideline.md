# AI_CODING_GUIDELINES.md

**For:** Builder AI  
**Project:** Solo Travel Social App (NomadMeet)  
**Purpose:** Define coding standards, error handling, and security practices. 

---

## 1. THE AUTONOMY OVERRIDE (FLEXIBILITY RULE)
These guidelines are meant to ensure a secure, maintainable app. However, **compilation and functionality take priority**. 
* If a strict stylistic rule or architectural boundary causes a persistent build failure or dependency clash, you are authorized to adapt and use standard React Native best practices to fix the bug.
* Do not get stuck in a loop trying to enforce a rigid pattern if it breaks the app. Fix the error, leave a comment explaining the deviation, and move on.

---

## 2. REACT NATIVE & EXPO BEST PRACTICES
* **Hook Integrity (Critical):** Conditional return statements must *never* be placed before React hooks (e.g., `useMemo`, `useEffect`, `useState`). This ensures consistent hook order and prevents fatal runtime crashes.
* **Component Size:** Keep files small and focused (max ~300 lines if possible). If a screen gets too large, break the UI into smaller components in a `components/` folder.
* **KISS (Keep It Simple, Stupid):** Prefer simple, readable code over complex premature optimizations. 
* **State Updates:** All asynchronous operations (like Supabase fetches) must include a cleanup check or `isMounted` ref to prevent "State update on unmounted component" memory leaks.

---

## 3. ERROR HANDLING & RECOVERY
* **Prevent Silent Failures:** Always catch errors. 
* **Separate Audiences:** * *Developers:* Use `console.error` with the format `[Error Type] - [Component/File] - Message` for debugging.
  * *Users:* Never expose stack traces or raw database errors. Show friendly UI Toasts (e.g., "Something went wrong. Please try again.").
* **Network Recovery:** If a Supabase fetch fails, implement a 1-time retry logic before showing the fallback/error state.
* **Navigation Errors:** Use Expo Router's Error Boundaries (`ErrorBoundary` component) to catch route failures so the whole app doesn't crash from a bad deep link.

---

## 4. MOBILE SECURITY (NON-NEGOTIABLE)
* **No Client-Side Secrets:** Never store API secret keys in frontend code, `app.json`, or `expo-constants`. They are easily extractable from the `.ipa` or `.apk`. 
* **Environment Variables:** Only variables prefixed with `EXPO_PUBLIC_` can be used in the client code. All other keys belong in Supabase Edge Functions.
* **Authorization > Authentication:** Do not rely on frontend UI hiding to protect data. Always ensure Supabase Row-Level Security (RLS) is doing the actual blocking.
* **Input Validation:** Treat all user input as untrusted. Validate inputs (especially event creation and profile edits) using `zod` before sending them to Supabase or Stream.io.

---

## 5. UI & STYLING APPROACH
* Check existing files for style patterns before creating new ones. 
* Rely on the system default Light/Dark mode. 
* Do not over-engineer the UI with complex animations for V1. Focus on snappy, immediate state updates (Optimistic UI) over heavy visual flair.

## 6. DEFENSIVE PROGRAMMING (THE "NO HAPPY PATHS" RULE)
The Builder AI must assume the internet is unreliable, APIs will return empty or malformed data, and users will rapidly tap buttons.
* **Zero-Guards & Math Blind Spots:** Never trust external data lengths or numerical values. Every single math operation or array mapping must have a zero-guard. (e.g., If calculating a layout based on `array.length`, explicitly check `if (array.length <= 1) return fallback;` to prevent division by zero or index out-of-bounds crashes).
* **Race Conditions & UI Locks:** Every asynchronous action (e.g., creating an event, joining a chat, paying for a badge) must implement an `isSubmitting` state lock. The UI button must be disabled and show a loading spinner the instant it is tapped to prevent concurrent API spamming and duplicate database entries.
* **Deep Offline Caching:** Do not build "shallow" offline support. If a screen claims to be offline-capable, all heavy data required to render the UI (e.g., the Meetup Point banner, cached map pins) must be stored locally via Zustand's persist middleware or standard AsyncStorage so the UI does not visually collapse when the connection drops.

## 7. RELEASE HYGIENE & CI/CD VERSIONING
* **Versioning as a Pre-Commit Requirement:** You must increment the `version` (e.g., "1.0.1") and `ios.buildNumber` / `android.versionCode` integers in `app.json` before triggering any EAS build. Apple and Google will instantly reject duplicate version strings.
* **No Hardcoded System Styling:** Do not hardcode specific font families (like 'Courier' or 'Roboto') that override native UI expectations. Let React Native default to the system fonts (San Francisco on iOS, Roboto on Android) for a premium, native feel. 
* **Boilerplate Cleanup:** Before the first production build, you must locate and delete all default Expo/React Native placeholder tests (e.g., default `<Text>Open up App.js to start working on your app!</Text>` components or placeholder `App.test.tsx` files). Stale tests will crash the automated CI/CD pipeline.
---
*End of AI Coding Guidelines*


```markdown
# DEPLOYMENT_AND_APP_STORE.md

**For:** Builder AI  
**Project:** Solo Travel Social App (NomadMeet)
**Purpose:** Define the exact `app.json` configuration, build commands, and App Store metadata. The Builder AI must use these configurations to ensure successful deployment and prevent App Store/Google Play rejection.

---

## 1. EXPO APP CONFIGURATION (`app.json`)

The Builder AI must configure the `app.json` with these exact permissions and settings. If the explanation strings for iOS are generic, Apple will reject the app.

```json
{
  "expo": {
    "name": "NomadMeet",
    "slug": "nomadmeet",
    "scheme": "nomadmeet",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "ios": {
      "bundleIdentifier": "com.nomadmeet.app",
      "supportsTablet": false,
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "NomadMeet needs your location to show events near you and let others find your events.",
        "NSCameraUsageDescription": "NomadMeet needs camera access to let you take a profile picture and send photos in event chats.",
        "NSPhotoLibraryUsageDescription": "NomadMeet needs photo library access to let you upload a profile picture and share photos in event chats."
      }
    },
    "android": {
      "package": "com.nomadmeet.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-location",
      "expo-image-picker",
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ]
    ]
  }
}

```

---

## 2. APP STORE METADATA & COMPLIANCE

Apple and Google strictly enforce rules for User Generated Content (UGC). The app already includes the required blocking and reporting features. The following metadata must be strictly adhered to during submission:

### 2.1 Categorization

* **Primary Category:** Social Networking
* **Secondary Category:** Travel
* **Age Rating:** 17+ (Required due to alcohol/nightlife context and live group chat)

### 2.2 Required URLs (Day 1 Lock)

To prevent App Store fields from being permanently greyed out/locked down the road, these must be set correctly on the very first submission:

* **Marketing URL:** `https://nomadmeet.com` (Must be canonical root domain, no 'www')
* **Support URL:** `https://nomadmeet.com`
* **Privacy Policy URL:** `https://nomadmeet.com/privacy`

### 2.3 User Generated Content (UGC) Requirements

When submitting to Apple, the App Review notes **MUST** explicitly state:

> "NomadMeet is a UGC social networking app. We have implemented EULA acceptance upon account creation. Users can block abusive users and report inappropriate content directly from user profiles and event chat screens. Reported content is reviewed by admins within 24 hours."

---

## 3. THE APP REVIEW LOGIN TRAP

Because the app uses Google/Apple SSO exclusively and lacks an email/password flow, App Reviewers will not use their personal social accounts to test the app.

**The Builder AI must implement one of the following for App Review:**

1. A hidden developer tap-gesture on the Splash Screen that bypasses OAuth and logs into a hardcoded Supabase test account.
2. OR: Temporarily enable Email/Password auth in Supabase *strictly* for a specific `appreview@nomadmeet.com` account, providing a hidden UI element on the Auth screen to enter it.

---

## 4. EAS BUILD & DEPLOYMENT COMMANDS

The Builder AI must construct the deployment pipeline using Expo Application Services (EAS).

### 4.1 Production Build

To generate the `.ipa` (iOS) and `.aab` (Android) files:

```bash
eas build --profile production --platform all

```

### 4.2 Over-The-Air (OTA) Updates

For pushing Javascript/UI bug fixes without going through App Store review:

```bash
eas update --branch production --message "Fix: [description]"

```

*(Constraint: OTA updates cannot be used if native libraries in `app.json` or `package.json` change).*

---

*End of Deployment and App Store Document*

```
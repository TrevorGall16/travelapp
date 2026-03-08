# NomadMeet Core UI Manifest

Mandatory constraints that every screen and component must follow.

---

## NAV_RULE_01

No UI element shall ever render behind the Bottom Navigation Bar.

## NAV_RULE_02

All screen containers must use `paddingBottom: insets.bottom + TAB_BAR_HEIGHT`.
The canonical `TAB_BAR_HEIGHT` is exported from `app/(tabs)/_layout.tsx`.

## CHAT_RULE_01

Sent messages = Right / Received = Left.
Avatars, Timestamps, and Date Separators are **MANDATORY** on every chat screen.

## EVENT_RULE_01

Active Event Limit = `COUNT(events) WHERE status='active' AND expires_at > NOW()`.
Expired or ended events must never count toward the user's active event cap.

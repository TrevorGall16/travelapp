-- ============================================================================
-- Push notification trigger: auto-send push when a notification row is inserted
-- ============================================================================
-- This trigger fires AFTER INSERT on `notifications` and calls the
-- `send-push-notification` Edge Function to deliver the push.
-- Runs as SECURITY DEFINER to access service role.

-- Ensure push_token column exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'push_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN push_token TEXT DEFAULT NULL;
  END IF;
END $$;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_push_token
  ON profiles(id) WHERE push_token IS NOT NULL;

-- ── Trigger function ─────────────────────────────────────────────────────────
-- Calls send-push-notification Edge Function via pg_net (async HTTP).
-- Falls back silently if pg_net is not enabled.

CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _token TEXT;
  _title TEXT;
  _body TEXT;
  _sender_name TEXT;
  _data JSONB;
BEGIN
  -- Look up the target user's push token
  SELECT push_token INTO _token
    FROM profiles
    WHERE id = NEW.user_id;

  -- No token → skip
  IF _token IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender name for personalization
  IF NEW.from_user_id IS NOT NULL THEN
    SELECT display_name INTO _sender_name
      FROM profiles
      WHERE id = NEW.from_user_id;
  END IF;

  -- Build title + body based on notification type
  CASE NEW.type
    WHEN 'friend_request' THEN
      _title := 'New Connection Request';
      _body := COALESCE(_sender_name, 'Someone') || ' wants to connect with you.';
    WHEN 'request_accepted' THEN
      _title := 'Connection Accepted';
      _body := 'You and ' || COALESCE(_sender_name, 'someone') || ' are now connected!';
    WHEN 'event_invite' THEN
      _title := 'Event Invitation';
      _body := COALESCE(NEW.body, COALESCE(_sender_name, 'Someone') || ' invited you to an event.');
    WHEN 'system' THEN
      _title := 'NomadMeet';
      _body := COALESCE(NEW.body, 'You have a new notification.');
    ELSE
      _title := 'NomadMeet';
      _body := COALESCE(NEW.body, 'You have a new notification.');
  END CASE;

  -- Build data payload for deep linking
  _data := jsonb_build_object(
    'type', NEW.type,
    'notification_id', NEW.id
  );
  IF NEW.from_user_id IS NOT NULL THEN
    _data := _data || jsonb_build_object('from_user_id', NEW.from_user_id);
  END IF;
  IF NEW.event_id IS NOT NULL THEN
    _data := _data || jsonb_build_object('event_id', NEW.event_id);
  END IF;

  -- Send via Expo Push API directly (no Edge Function dependency)
  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'to', _token,
      'sound', 'default',
      'title', _title,
      'body', _body,
      'data', _data,
      'channelId', 'default'
    )::text
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block notification inserts if push fails
    RAISE WARNING '[Push] notify_push_on_insert failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ── Attach trigger ───────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_push_on_notification ON notifications;
CREATE TRIGGER trg_push_on_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_insert();

-- Migration: Fire a Database Webhook to sync-stream-member on event_participants INSERT.
-- This decouples Stream.io channel membership from the synchronous join-event flow.
-- The webhook calls the sync-stream-member Edge Function asynchronously, so a
-- Stream failure no longer blocks or fractures the user's join experience.

-- Supabase Database Webhooks are configured via the Dashboard (Database → Webhooks),
-- NOT via raw SQL triggers. This migration documents the required configuration.
--
-- Dashboard setup:
--   1. Go to Database → Webhooks → Create a new webhook
--   2. Table: event_participants
--   3. Events: INSERT
--   4. Type: Supabase Edge Function
--   5. Edge Function: sync-stream-member
--   6. HTTP Headers: Add Authorization = Bearer <SUPABASE_SERVICE_ROLE_KEY>
--   7. Timeout: 5000ms
--
-- Alternatively, use the pg_net + pg_cron approach below for a code-first webhook:

-- Enable pg_net extension (already enabled on most Supabase projects)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: calls sync-stream-member Edge Function via pg_net
CREATE OR REPLACE FUNCTION notify_sync_stream_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
  payload JSONB;
BEGIN
  edge_function_url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/sync-stream-member';
  service_role_key := current_setting('app.settings.service_role_key', true);

  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'event_participants',
    'record', jsonb_build_object(
      'event_id', NEW.event_id,
      'user_id', NEW.user_id
    )
  );

  -- Fire-and-forget HTTP POST via pg_net (async, non-blocking)
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to event_participants table
DROP TRIGGER IF EXISTS trg_sync_stream_member ON event_participants;
CREATE TRIGGER trg_sync_stream_member
  AFTER INSERT ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_sync_stream_member();

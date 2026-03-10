-- ============================================================================
-- Security Hardening: 2026-03-10
-- 1. Lock down notifications INSERT to service_role only
-- 2. Atomic join-event RPC with row-level locking
-- ============================================================================

-- ── 1. Notification INSERT policy: service_role only ────────────────────────
-- Drop the wide-open policy that allowed any authenticated user to insert.
-- After this, only the service_role (Edge Functions, triggers) can insert
-- notification rows. The push trigger (SECURITY DEFINER) is unaffected.
DROP POLICY IF EXISTS notifications_insert ON notifications;

-- No new INSERT policy is created for authenticated users.
-- service_role bypasses RLS entirely, so it can still insert.
-- This means: client code CANNOT insert into notifications.

-- ── 2. Atomic join-event RPC ────────────────────────────────────────────────
-- Uses SELECT ... FOR UPDATE to lock the event row, preventing two concurrent
-- join requests from overfilling an event past max_participants.
-- Returns a JSONB result with {ok, code, error, already_member}.

CREATE OR REPLACE FUNCTION join_event_atomic(
  p_user_id UUID,
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
  v_existing BOOLEAN;
BEGIN
  -- Lock the event row exclusively — blocks concurrent joins until this TX commits
  SELECT status, verified_only, participant_count, max_participants
    INTO v_event
    FROM events
    WHERE id = p_event_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Event not found.');
  END IF;

  IF v_event.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EVENT_EXPIRED', 'error', 'This event has already expired.');
  END IF;

  -- Verified-only gate
  IF v_event.verified_only THEN
    PERFORM 1 FROM profiles WHERE id = p_user_id AND verification_status = 'verified';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VERIFIED_ONLY', 'error', 'This event is for verified travelers only.');
    END IF;
  END IF;

  -- Check if already a participant (idempotent)
  SELECT EXISTS(
    SELECT 1 FROM event_participants
    WHERE event_id = p_event_id AND user_id = p_user_id
  ) INTO v_existing;

  IF v_existing THEN
    RETURN jsonb_build_object('ok', true, 'already_member', true);
  END IF;

  -- Capacity check (only for new joins)
  IF v_event.max_participants IS NOT NULL
     AND v_event.participant_count >= v_event.max_participants THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_REACHED', 'error', 'This event is full.');
  END IF;

  -- Insert participant — the DB trigger will increment participant_count
  INSERT INTO event_participants (event_id, user_id) VALUES (p_event_id, p_user_id);

  RETURN jsonb_build_object('ok', true, 'already_member', false);
END;
$$;

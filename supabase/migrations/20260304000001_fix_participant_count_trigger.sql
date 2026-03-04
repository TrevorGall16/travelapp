-- =============================================================================
-- Migration: fix_participant_count_trigger
-- Date:      2026-03-04
-- Purpose:   Replace the increment/decrement trigger with a COUNT(*) recompute
--            to prevent participant_count drift under race conditions or partial
--            transaction failures.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Drop existing trigger and function (safe — no-ops if they do not exist)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_participant_count ON event_participants;
DROP FUNCTION IF EXISTS update_participant_count();

-- -----------------------------------------------------------------------------
-- 2. Recreate function: always derive count from source of truth
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_participant_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id UUID;
BEGIN
  -- On DELETE the new row is gone so NEW is NULL; use OLD.
  -- On INSERT, OLD is NULL; use NEW.
  -- COALESCE handles both branches cleanly.
  _event_id := COALESCE(NEW.event_id, OLD.event_id);

  UPDATE events
  SET participant_count = (
    SELECT COUNT(*)
    FROM event_participants
    WHERE event_id = _event_id
  )
  WHERE id = _event_id;

  RETURN NULL; -- AFTER trigger; return value is ignored for row-level AFTER
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Create trigger: fires AFTER INSERT OR DELETE on event_participants
--    Statement-level (FOR EACH STATEMENT) would misidentify _event_id when
--    bulk operations touch multiple events, so we use FOR EACH ROW.
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_participant_count
AFTER INSERT OR DELETE
ON event_participants
FOR EACH ROW
EXECUTE FUNCTION update_participant_count();

-- -----------------------------------------------------------------------------
-- 4. Backfill: correct any counts that drifted before this migration ran.
--    Safe to run on a live database — UPDATE is idempotent here.
-- -----------------------------------------------------------------------------
UPDATE events e
SET participant_count = (
  SELECT COUNT(*)
  FROM event_participants ep
  WHERE ep.event_id = e.id
);

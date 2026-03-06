-- ============================================================================
-- connections: reciprocal friend/connection system
-- ============================================================================

CREATE TABLE IF NOT EXISTS connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_2     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate connection rows (order-independent).
  -- LEAST/GREATEST ensures (A,B) and (B,A) both hit the same constraint.
  CONSTRAINT unique_connection UNIQUE (
    LEAST(user_id_1, user_id_2),
    GREATEST(user_id_1, user_id_2)
  ),

  -- No self-connections
  CONSTRAINT no_self_connect CHECK (user_id_1 <> user_id_2)
);

CREATE INDEX idx_connections_user1 ON connections(user_id_1);
CREATE INDEX idx_connections_user2 ON connections(user_id_2);
CREATE INDEX idx_connections_status ON connections(status);

-- RLS
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Users can see their own connections
CREATE POLICY connections_select ON connections
  FOR SELECT USING (auth.uid() IN (user_id_1, user_id_2));

-- Users can send connection requests (they must be user_id_1)
CREATE POLICY connections_insert ON connections
  FOR INSERT WITH CHECK (auth.uid() = user_id_1 AND status = 'pending');

-- Users can accept requests sent TO them (they must be user_id_2)
CREATE POLICY connections_update ON connections
  FOR UPDATE USING (auth.uid() = user_id_2 AND status = 'pending')
  WITH CHECK (status = 'accepted');

-- Either party can delete/unfriend
CREATE POLICY connections_delete ON connections
  FOR DELETE USING (auth.uid() IN (user_id_1, user_id_2));


-- ============================================================================
-- reports: user/message reports from chat long-press or profile
-- ============================================================================

CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message_id    TEXT,          -- Stream message ID (nullable for profile reports)
  channel_id    TEXT,          -- Stream channel ID for context
  reason        TEXT NOT NULL DEFAULT 'inappropriate',
  details       TEXT,          -- Optional free-text from reporter
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_reported ON reports(reported_user_id);

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users can only insert reports as themselves
CREATE POLICY reports_insert ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Users can read their own reports (for "already reported" checks)
CREATE POLICY reports_select ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

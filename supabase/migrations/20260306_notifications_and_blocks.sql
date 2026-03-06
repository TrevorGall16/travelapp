-- ============================================================================
-- notifications: in-app notification feed
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
    'friend_request', 'request_accepted', 'event_invite', 'system'
  )),
  from_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  body          TEXT,
  read          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE NOT read;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- System and other users can insert notifications for a user
-- (insert policy is permissive — Edge Functions use service role anyway)
CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (true);

-- Users can mark their own notifications as read
CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY notifications_delete ON notifications
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- user_blocks: bidirectional user blocking
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Users can see blocks they created
CREATE POLICY blocks_select ON user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

-- Users can block others
CREATE POLICY blocks_insert ON user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Users can unblock
CREATE POLICY blocks_delete ON user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

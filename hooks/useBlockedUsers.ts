import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

/**
 * Returns a Set of user IDs blocked by the current user.
 * Fetches once on mount from the user_blocks table.
 */
export function useBlockedUsers(): Set<string> {
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id)
      .then(({ data }) => {
        if (data) {
          setBlocked(new Set(data.map((r: { blocked_id: string }) => r.blocked_id)));
        }
      });
  }, []);

  return blocked;
}

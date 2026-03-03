// lib/eventFormatters.ts — Pure date/time formatting helpers for events.

import { differenceInMinutes, formatDistanceToNow, isPast } from 'date-fns';

/** Formats an expiry Date for display in the Create Event form. */
export function formatExpiry(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `Today at ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
}

/** Returns a human-readable countdown label and a colour for an event's expiry. */
export function countdownLabel(expiresAt: string): { label: string; color: string } {
  const exp = new Date(expiresAt);
  if (isPast(exp)) return { label: 'Expired', color: '#EF4444' };

  const minsLeft = differenceInMinutes(exp, new Date());
  const color =
    minsLeft < 30 ? '#EF4444' : minsLeft < 60 ? '#F59E0B' : '#22C55E';

  if (minsLeft < 60) return { label: `${minsLeft}m left`, color };

  const h = Math.floor(minsLeft / 60);
  const m = minsLeft % 60;
  if (minsLeft < 1440) {
    return { label: m > 0 ? `${h}h ${m}m` : `${h}h left`, color };
  }
  return { label: formatDistanceToNow(exp, { addSuffix: true }), color: '#22C55E' };
}

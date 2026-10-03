/**
 * App settings — late-entry rules and configurable limits.
 * Stored as constants for now; in real mode these can be overridden via a Settings sheet tab.
 */
import { todayCairo } from './date';

/** Number of past days a regular user can edit entries for. Admin always overrides. */
export const LATE_ENTRY_DAYS = 7;

/** Whether late-entry enforcement is active. Admin can toggle this in Sheets. */
export const LATE_ENTRY_ENABLED = true;

/**
 * Check if a date is within the allowed editing window for a user.
 * Users can edit today and the last LATE_ENTRY_DAYS days.
 * Admin is always allowed.
 */
export function canEditDate(date: string, isAdmin: boolean): boolean {
  if (!LATE_ENTRY_ENABLED || isAdmin) return true;
  const today = todayCairo();
  const entry = new Date(date + 'T00:00:00Z');
  const now = new Date(today + 'T00:00:00Z');
  const diffMs = now.getTime() - entry.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  // Allow today (0) and up to LATE_ENTRY_DAYS days back; also allow 1 day ahead
  return diffDays >= -1 && diffDays <= LATE_ENTRY_DAYS;
}

/** Human-readable reason why editing is blocked. */
export function lateEntryReason(date: string): string {
  const today = todayCairo();
  const entry = new Date(date + 'T00:00:00Z');
  const now = new Date(today + 'T00:00:00Z');
  const diffDays = Math.floor((now.getTime() - entry.getTime()) / 86_400_000);
  if (diffDays > LATE_ENTRY_DAYS) {
    return `This entry is ${diffDays} days old. Users can only edit the last ${LATE_ENTRY_DAYS} days.`;
  }
  return 'Editing window has passed for this entry.';
}

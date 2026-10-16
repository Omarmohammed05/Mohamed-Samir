import type { Session } from './auth';
import type { EntryStatus } from './entry-store';

/**
 * Permissions module — all checks are server-side only.
 * The client never decides role or identity.
 *
 * Roles: operator, supervisor, engineer, admin
 */

export function isAdmin(session: Session | null): boolean {
  return session?.role === 'admin';
}

export function isOperator(session: Session | null): boolean {
  return session?.role === 'operator';
}

export function isSupervisor(session: Session | null): boolean {
  return session?.role === 'supervisor';
}

export function isEngineer(session: Session | null): boolean {
  return session?.role === 'engineer';
}

/** Any authenticated user. */
export function assertAuthenticated(session: Session | null): asserts session is Session {
  if (!session) throw new PermissionError('Not authenticated');
}

/** Admin only. */
export function assertAdmin(session: Session | null): asserts session is Session {
  if (!session || session.role !== 'admin') throw new PermissionError('Admin access required');
}

/** Operator, Supervisor, or Admin — roles that can create entries. */
export function canCreateEntry(session: Session | null): boolean {
  if (!session) return false;
  return ['operator', 'supervisor', 'admin'].includes(session.role);
}

/** Engineer cannot create entries. */
export function assertCanCreateEntry(session: Session | null): asserts session is Session {
  assertAuthenticated(session);
  if (!canCreateEntry(session)) throw new PermissionError('Engineers cannot create entries');
}

/** Supervisor, Engineer, or Admin — roles that can approve entries. */
export function canApproveEntry(session: Session | null): boolean {
  if (!session) return false;
  return ['supervisor', 'engineer', 'admin'].includes(session.role);
}

/**
 * Can the user edit an entry?
 * - Admin: all entries
 * - Operator: own entries before supervisor review (status "Operator")
 * - Supervisor: entries in review (status "Operator" or "Supervisor")
 * - Engineer: entries in review (status "Supervisor")
 */
export function canEditEntry(session: Session, entry: { status: EntryStatus; operator_name: string }): boolean {
  if (session.role === 'admin') return true;
  if (session.role === 'operator') {
    return entry.status === 'Operator' && entry.operator_name === session.name;
  }
  if (session.role === 'supervisor') {
    return entry.status === 'Operator' || entry.status === 'Supervisor';
  }
  if (session.role === 'engineer') {
    return entry.status === 'Supervisor';
  }
  return false;
}

/**
 * Can the user approve an entry at the current status?
 * - Supervisor: approve entries at status "Operator"
 * - Engineer: approve entries at status "Supervisor"
 * - Admin: approve any entry
 */
export function canApproveAtStatus(session: Session, status: EntryStatus): boolean {
  if (session.role === 'admin') return true;
  if (session.role === 'supervisor') return status === 'Operator';
  if (session.role === 'engineer') return status === 'Supervisor';
  return false;
}

/** Can the user view history? All roles can. */
export function canViewHistory(session: Session | null): boolean {
  return !!session;
}

/** Can the user manage card time ranges? Admin only. */
export function canManageCardConfig(session: Session | null): boolean {
  return session?.role === 'admin';
}

/** Can the user manage users? Admin only. */
export function canManageUsers(session: Session | null): boolean {
  return session?.role === 'admin';
}

/** Can the user change their own password? All roles. */
export function canChangePassword(session: Session | null): boolean {
  return !!session;
}

// ─── Legacy daily-entries helpers ───────────────────────
// Used by the /api/entries routes (the original daily log sheet).
// Users act on their own rows only; admin reads anything but edits in Sheets.

function isOwnRow(session: Session, owner: string): boolean {
  return session.email.toLowerCase() === owner.toLowerCase();
}

/** Any authenticated user (legacy name for the daily-entries routes). */
export function assertUser(session: Session | null): asserts session is Session {
  assertAuthenticated(session);
}

export function canReadEntry(session: Session, owner: string): boolean {
  return isAdmin(session) || isOwnRow(session, owner);
}

export function canWriteEntry(session: Session, owner: string): boolean {
  if (isAdmin(session)) return false; // admin edits happen in Sheets
  return isOwnRow(session, owner);
}

export function canDeleteEntry(session: Session, owner: string): boolean {
  if (isAdmin(session)) return false;
  return isOwnRow(session, owner);
}

export class PermissionError extends Error {
  status = 403;
}
